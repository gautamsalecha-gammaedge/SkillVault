"""
routers/ask.py

POST /ask - worker asks a question, gets an answer grounded in the
knowledge base. Also logs the question for analytics.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from schemas import AskRequest
from rag.embeddings import embed_text
from rag.chroma_store import collection
from rag.prompts import ANSWER_PROMPT
from rag.llm_provider import generate_text
from auth.worker_auth import require_worker
from db import get_db
from models import WorkerMachine, QuestionLog

router = APIRouter()


@router.post("/ask")
def ask(
    req: AskRequest,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    assignment = (
        db.query(WorkerMachine)
        .filter(
            WorkerMachine.worker_id == worker["worker_id"],
            WorkerMachine.machine_id == req.machine_id,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned to this machine. Contact admin.",
        )

    question_embedding = embed_text(req.question)

    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=4,
        where={
            "$and": [
                {"machine_id": req.machine_id},
                {"status": "approved"},
            ]
        },
    )

    retrieved_chunks = results["documents"][0] if results["documents"] else []
    retrieved_metadatas = results["metadatas"][0] if results["metadatas"] else []

    if not retrieved_chunks:
        # Still log the attempt so analytics sees "questions with no knowledge"
        _log_question(db, worker["worker_id"], req.machine_id, 0)
        return {
            "answer": "I don't have any knowledge saved for this machine yet.",
            "sources_used": 0,
            "video_url": None,
        }

    context = "\n\n".join(retrieved_chunks)
    prompt = ANSWER_PROMPT.format(context=context, question=req.question)
    answer_text = generate_text(prompt)

    video_url = None
    for meta in retrieved_metadatas:
        if meta.get("video_url"):
            video_url = meta["video_url"]
            break

    sources_used = len(retrieved_chunks)
    _log_question(db, worker["worker_id"], req.machine_id, sources_used)

    return {
        "answer": answer_text,
        "sources_used": sources_used,
        "video_url": video_url,
    }


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
        # Never break /ask because analytics logging failed