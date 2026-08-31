"""
routers/ask.py

POST /ask - worker asks a question (JSON body: question + machine_id).
POST /ask/with-media - same flow, multipart form with optional image.

Optional image is understood by Gemini (same depth as tip photos) and
merged into the retrieval query + answer context so the model can reason
about what the worker photographed on the machine.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from sqlalchemy.orm import Session

from schemas import AskRequest
from rag.embeddings import embed_text
from rag.chroma_store import collection
from rag.prompts import ANSWER_PROMPT
from rag.llm_provider import generate_text
from auth.worker_auth import require_worker
from db import get_db
from models import WorkerMachine, QuestionLog
from rag.image_storage import save_image, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES
from rag.image_understanding import understand_image

router = APIRouter()


def _assert_machine_assignment(db: Session, worker_id: str, machine_id: str):
    """
    Ensure the worker is assigned to this machine AND the machine still
    exists in the knowledge base. Gives a clear, user-friendly message
    instead of a raw backend error when the machine was deleted.
    """
    from rag.chroma_store import list_all_machine_ids

    mid = (machine_id or "").strip()
    if not mid:
        raise HTTPException(status_code=400, detail="Please select a machine.")

    known = set(list_all_machine_ids())
    if mid not in known:
        # Clean orphan assignment if any
        db.query(WorkerMachine).filter(
            WorkerMachine.worker_id == worker_id,
            WorkerMachine.machine_id == mid,
        ).delete(synchronize_session=False)
        try:
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(
            status_code=404,
            detail=(
                f"Machine '{mid}' is no longer available (it may have been removed by a supervisor). "
                "Refresh the page and pick another machine, or contact your supervisor."
            ),
        )

    assignment = (
        db.query(WorkerMachine)
        .filter(
            WorkerMachine.worker_id == worker_id,
            WorkerMachine.machine_id == mid,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned to this machine. Contact your supervisor.",
        )


def _normalize_history(history):
    """Keep last N turns, normalize roles, drop empty text."""
    if not history:
        return []
    out = []
    for turn in history:
        if isinstance(turn, dict):
            role = (turn.get("role") or "").strip().lower()
            text = (turn.get("text") or "").strip()
        else:
            role = (getattr(turn, "role", None) or "").strip().lower()
            text = (getattr(turn, "text", None) or "").strip()
        if not text:
            continue
        if role in ("worker", "user", "human"):
            role = "worker"
        elif role in ("ai", "assistant", "bot"):
            role = "ai"
        else:
            continue
        out.append({"role": role, "text": text[:1200]})
    # Context window: last 8 turns (~4 Q&A pairs)
    return out[-8:]


def _format_history_block(history) -> str:
    if not history:
        return ""
    lines = []
    for t in history:
        who = "Worker" if t["role"] == "worker" else "Assistant"
        lines.append(f"{who}: {t['text']}")
    return "\n".join(lines)


def _run_ask(
    *,
    question: str,
    machine_id: str,
    worker: dict,
    db: Session,
    image_description: str = "",
    image_visible_text: str = "",
    image_url: Optional[str] = None,
    history=None,
):
    question = (question or "").strip()
    if not question and not image_description:
        raise HTTPException(
            status_code=400,
            detail="Provide a question, or attach an image of the issue.",
        )

    prior = _normalize_history(history)
    history_block = _format_history_block(prior)

    # Retrieval: current question + recent worker questions (follow-ups need prior topic)
    prior_worker_bits = [
        t["text"] for t in prior if t["role"] == "worker"
    ][-3:]
    retrieval_query = question
    if prior_worker_bits:
        retrieval_query = (
            "Earlier in this conversation the worker asked:\n"
            + "\n".join(f"- {b}" for b in prior_worker_bits)
            + f"\n\nCurrent question: {question or '(see photo)'}"
        )
    if image_description:
        retrieval_query = (
            f"{retrieval_query}\n\n[Photo of issue]: {image_description}".strip()
            if retrieval_query
            else f"[Photo of issue]: {image_description}"
        )
    if image_visible_text:
        retrieval_query += f"\n[Readable text in photo]: {image_visible_text}"

    question_embedding = embed_text(retrieval_query)

    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=4,
        where={
            "$and": [
                {"machine_id": machine_id},
                {"status": "approved"},
            ]
        },
    )

    retrieved_chunks = results["documents"][0] if results["documents"] else []
    retrieved_metadatas = results["metadatas"][0] if results["metadatas"] else []
    retrieved_distances = (
        results["distances"][0] if results.get("distances") else []
    )

    if not retrieved_chunks:
        _log_question(db, worker["worker_id"], machine_id, 0)
        return {
            "answer": "I don't have any knowledge saved for this machine yet.",
            "sources_used": 0,
            "video_url": None,
            "image_url": image_url,
            "image_description": image_description or None,
            "tip_image_url": None,
        }

    context = "\n\n".join(retrieved_chunks)

    enriched_question = question or "What is wrong here based on this photo?"
    if history_block:
        enriched_question = (
            "This is a continuing conversation on the same machine. "
            "Use the prior turns only to resolve references (e.g. 'it', 'that noise', 'the same issue'). "
            "Do not invent details that are not in the knowledge context or prior turns.\n\n"
            f"Prior conversation:\n{history_block}\n\n"
            f"Current question: {enriched_question}"
        )
    if image_description:
        enriched_question += f"\n\nWorker attached a photo. Visual description: {image_description}"
    if image_visible_text:
        enriched_question += f"\nReadable text / codes in the photo: {image_visible_text}"

    prompt = ANSWER_PROMPT.format(context=context, question=enriched_question)
    answer_text = generate_text(prompt)

    # Tip media ONLY from the top match, and only when similarity is strong enough.
    # Vague questions often retrieve weak matches — attaching random tip video/photo is wrong.
    # Chroma distances are lower = closer (L2 / cosine-distance style).
    MEDIA_MAX_DISTANCE = 0.55
    video_url = None
    tip_image_url = None
    if retrieved_metadatas:
        top_meta = retrieved_metadatas[0] or {}
        top_dist = retrieved_distances[0] if retrieved_distances else None
        # If distance is missing, still require the top chunk text to look related:
        # only attach media when we have a numeric score under the threshold.
        if top_dist is not None and top_dist <= MEDIA_MAX_DISTANCE:
            video_url = top_meta.get("video_url") or None
            tip_image_url = top_meta.get("image_url") or None

    sources_used = len(retrieved_chunks)
    _log_question(db, worker["worker_id"], machine_id, sources_used)

    return {
        "answer": answer_text,
        "sources_used": sources_used,
        "video_url": video_url,
        # Worker's photo attached to this Ask (if any)
        "image_url": image_url,
        "image_description": image_description or None,
        # Photo stored on a retrieved approved tip (only if top match is close)
        "tip_image_url": tip_image_url,
    }


@router.post("/ask")
def ask(
    req: AskRequest,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """JSON body — text-only question (existing frontend contract)."""
    _assert_machine_assignment(db, worker["worker_id"], req.machine_id)
    return _run_ask(
        question=req.question,
        machine_id=req.machine_id,
        worker=worker,
        db=db,
        history=req.history,
    )


@router.post("/ask/with-media")
async def ask_with_media(
    question: str = Form(""),
    machine_id: str = Form(...),
    history: str = Form(""),
    image: Optional[UploadFile] = File(None),
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """
    Multipart ask — optional image of the issue on the machine.
    Image is stored under uploads/images and understood by Gemini before
    retrieval and answer generation.
    """
    _assert_machine_assignment(db, worker["worker_id"], machine_id)

    image_url = None
    image_description = ""
    image_visible_text = ""

    if image and image.filename:
        ct = (image.content_type or "").lower()
        if ct not in ALLOWED_IMAGE_TYPES and not ct.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="Only JPEG, PNG, WebP or GIF images are allowed.",
            )

        content = await image.read()
        if len(content) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=400,
                detail="Image is too large. Maximum size is 15 MB.",
            )

        await image.seek(0)
        image_url = await save_image(image, machine_id, prefix="ask")
        full_path = image_url.lstrip("/")

        try:
            understanding = understand_image(full_path)
            image_description = understanding.get("image_description", "")
            image_visible_text = understanding.get("visible_text", "")
            key_details = understanding.get("key_details") or []
            if key_details and isinstance(key_details, list):
                extra = "; ".join(str(k) for k in key_details if k)
                if extra:
                    image_description = (
                        f"{image_description}\nKey details: {extra}".strip()
                        if image_description
                        else f"Key details: {extra}"
                    )
        except Exception as e:
            print(f"Ask image understanding failed: {e}")
            image_description = ""
            image_visible_text = ""

    history_list = None
    if history and history.strip():
        try:
            import json as _json
            parsed = _json.loads(history)
            if isinstance(parsed, list):
                history_list = parsed
        except Exception:
            history_list = None

    return _run_ask(
        question=question,
        machine_id=machine_id,
        worker=worker,
        db=db,
        image_description=image_description,
        image_visible_text=image_visible_text,
        image_url=image_url,
        history=history_list,
    )


def _log_question(db: Session, worker_id: str, machine_id: str, sources_used: int):
    try:
        row = QuestionLog(
            id=uuid.uuid4().hex,
            worker_id=worker_id,
            machine_id=machine_id,
            sources_used=str(sources_used),
        )
        db.add(row)
        db.commit()
    except Exception:
        db.rollback()