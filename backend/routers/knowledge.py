"""
routers/knowledge.py

POST /add-knowledge - logged-in worker submits a new tip/fix for a
machine. Saved to Chroma with status "pending" until an admin approves it.

Language: language_code on both request schemas comes from Sarvam STT's
auto-detection (voice/stt.py) at the point the worker spoke their tip -
not from a stored app setting. It flows straight through: detected on
recording -> sent with /add-knowledge/check -> used to phrase the
clarifying question in the same language -> sent again with
/add-knowledge -> used for the spoken confirmation message. If the
worker typed instead of spoke, the frontend falls back to a default
(see schemas.py) since there's no audio to detect a language from.
"""

from fastapi import APIRouter, Depends

from schemas import AddKnowledgeRequest, CheckKnowledgeRequest
from auth.worker_auth import require_worker
from rag.embeddings import embed_text
from rag.chroma_store import collection
from rag.confirmations import get_confirmation_message
from rag.knowledge_review import review_knowledge

router = APIRouter(prefix="/Knowledge" , tags=["Knowledge"])


@router.post("/add-knowledge/check")
def check_knowledge(req: CheckKnowledgeRequest, worker: dict = Depends(require_worker)):
    """
    Reviews a tip BEFORE it's stored - checks whether it's specific enough
    to be useful on its own, and returns a grammar-polished version of the
    text either way. Doesn't save anything.

    Capped at 2 rounds: if req.round >= 2, this forces completion regardless
    of what the model thinks, so the worker is never asked more than one
    clarifying question per submission.

    req.language_code is forwarded into review_knowledge so any clarifying
    question comes back written in the same language the worker actually
    spoke/typed in, not guessed by the model from the text.
    """
    result = review_knowledge(req.text, req.machine_id, req.language_code)

    if req.round >= 2:
        result["complete"] = True
        result["question"] = None

    return result


@router.post("/add-knowledge")
def add_knowledge(req: AddKnowledgeRequest, worker: dict = Depends(require_worker)):
    embedding = embed_text(req.text, task_type="RETRIEVAL_DOCUMENT")
    import uuid
    entry_id = f"{req.machine_id}-worker-{worker['worker_id']}-{uuid.uuid4().hex[:12]}"

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

    return {
        "status": "saved as pending, awaiting admin approval",
        "id": entry_id,
        "added_by": worker["name"],
        "spoken_confirmation": get_confirmation_message(req.language_code),
    }