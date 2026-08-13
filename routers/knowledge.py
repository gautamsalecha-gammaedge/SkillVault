"""
routers/knowledge.py

POST /add-knowledge - logged-in worker submits a new tip/fix for a
machine. Saved to Chroma with status "pending" until an admin approves it.
"""

from fastapi import APIRouter, Depends

from schemas import AddKnowledgeRequest
from auth.worker_auth import require_worker
from rag.embeddings import embed_text
from rag.chroma_store import collection

router = APIRouter()


@router.post("/add-knowledge")
def add_knowledge(req: AddKnowledgeRequest, worker: dict = Depends(require_worker)):
    embedding = embed_text(req.text, task_type="RETRIEVAL_DOCUMENT")

    entry_id = f"{req.machine_id}-worker-{worker['worker_id']}-{hash(req.text) % 100000}"
    collection.upsert(
        ids=[entry_id],
        embeddings=[embedding],
        documents=[req.text],
        metadatas=[{
            "machine_id": req.machine_id,
            "source_type": "worker_input",
            "worker_id": worker["worker_id"],
            "worker_name": worker["name"],
            "status": "pending",
        }],
    )

    return {"status": "saved as pending, awaiting admin approval", "id": entry_id, "added_by": worker["name"]}