"""
routers/ask.py

POST /ask - worker asks a question, gets an answer grounded in the
knowledge base (manual chunks + approved worker tips) for one machine.

Now also returns video_url if the best matching tip has a video.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from schemas import AskRequest
from rag.embeddings import embed_text
from rag.chroma_store import collection
from rag.prompts import ANSWER_PROMPT
from rag.llm_provider import generate_text
from auth.worker_auth import require_worker
from db import get_db
from models import WorkerMachine

router = APIRouter()


@router.post("/ask")
def ask(
    req: AskRequest,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    # 1. Check if this worker is assigned to the requested machine
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
            detail="You are not assigned to this machine. Contact admin."
        )

    # 2. Embed the question
    question_embedding = embed_text(req.question)

    # 3. Retrieve relevant approved chunks for this machine only
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
        return {
            "answer": "I don't have any knowledge saved for this machine yet.",
            "sources_used": 0,
            "video_url": None,
        }

    context = "\n\n".join(retrieved_chunks)

    # 4. Generate answer
    prompt = ANSWER_PROMPT.format(context=context, question=req.question)
    answer_text = generate_text(prompt)

    # 5. Find the first video_url from the retrieved tips (if any)
    video_url = None
    for meta in retrieved_metadatas:
        if meta.get("video_url"):
            video_url = meta["video_url"]
            break

    return {
        "answer": answer_text,
        "sources_used": len(retrieved_chunks),
        "video_url": video_url,
    }