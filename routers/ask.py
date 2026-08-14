"""
routers/ask.py

POST /ask - worker asks a question, gets an answer grounded in the
knowledge base (manual chunks + approved worker tips) for one machine.
No auth required - any worker on the shop floor can ask.
"""

from fastapi import APIRouter

from schemas import AskRequest
from rag.embeddings import embed_text
from rag.chroma_store import collection
from rag.prompts import ANSWER_PROMPT
from rag.llm_provider import generate_text

router = APIRouter()


@router.post("/ask")
def ask(req: AskRequest):
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
    context = "\n\n".join(retrieved_chunks)

    if not context:
        return {"answer": "I don't have any knowledge saved for this machine yet."}

    prompt = ANSWER_PROMPT.format(context=context, question=req.question)
    answer_text = generate_text(prompt)

    return {
        "answer": answer_text,
        "sources_used": len(retrieved_chunks),
    }