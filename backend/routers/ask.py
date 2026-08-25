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
    assignment = (
        db.query(WorkerMachine)
        .filter(
            WorkerMachine.worker_id == worker_id,
            WorkerMachine.machine_id == machine_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned to this machine. Contact admin.",
        )


def _run_ask(
    *,
    question: str,
    machine_id: str,
    worker: dict,
    db: Session,
    image_description: str = "",
    image_visible_text: str = "",
    image_url: Optional[str] = None,
):
    question = (question or "").strip()
    if not question and not image_description:
        raise HTTPException(
            status_code=400,
            detail="Provide a question, or attach an image of the issue.",
        )

    retrieval_query = question
    if image_description:
        retrieval_query = (
            f"{question}\n\n[Photo of issue]: {image_description}".strip()
            if question
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

    if not retrieved_chunks:
        _log_question(db, worker["worker_id"], machine_id, 0)
        return {
            "answer": "I don't have any knowledge saved for this machine yet.",
            "sources_used": 0,
            "video_url": None,
            "image_url": image_url,
            "image_description": image_description or None,
        }

    context = "\n\n".join(retrieved_chunks)

    enriched_question = question or "What is wrong here based on this photo?"
    if image_description:
        enriched_question += f"\n\nWorker attached a photo. Visual description: {image_description}"
    if image_visible_text:
        enriched_question += f"\nReadable text / codes in the photo: {image_visible_text}"

    prompt = ANSWER_PROMPT.format(context=context, question=enriched_question)
    answer_text = generate_text(prompt)

    video_url = None
    for meta in retrieved_metadatas:
        if meta.get("video_url"):
            video_url = meta["video_url"]
            break

    sources_used = len(retrieved_chunks)
    _log_question(db, worker["worker_id"], machine_id, sources_used)

    return {
        "answer": answer_text,
        "sources_used": sources_used,
        "video_url": video_url,
        "image_url": image_url,
        "image_description": image_description or None,
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
    )


@router.post("/ask/with-media")
async def ask_with_media(
    question: str = Form(""),
    machine_id: str = Form(...),
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

    return _run_ask(
        question=question,
        machine_id=machine_id,
        worker=worker,
        db=db,
        image_description=image_description,
        image_visible_text=image_visible_text,
        image_url=image_url,
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