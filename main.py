"""
main.py

The actual backend API server.

Two endpoints today:
1. POST /ask            -> worker asks a question, gets an answer grounded in the knowledge base
2. POST /add-knowledge   -> worker (or admin) adds a new piece of knowledge

Run it with:
    uvicorn main:app --reload

Then test with curl, Postman, or the auto-generated docs at http://127.0.0.1:8000/docs
"""

import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
import chromadb
from fastapi import FastAPI
from pydantic import BaseModel

# --- Setup ---
load_dotenv()
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="skillvault_knowledge")

LLM_MODEL = "gemini-3.6-flash"

app = FastAPI(title="SkillVault AI Backend")


# --- Request shapes (what the frontend must send) ---
class AskRequest(BaseModel):
    question: str
    machine_id: str


class AddKnowledgeRequest(BaseModel):
    text: str
    machine_id: str
    worker_name: str


# --- Helper functions ---
def embed_text(text: str, task_type: str = "RETRIEVAL_QUERY") -> list[float]:
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(task_type=task_type),
    )
    return result.embeddings[0].values


ANSWER_PROMPT = """You are a shop-floor assistant helping factory workers with machine questions.

You will be given:
1. Retrieved context (from the machine's manual and from experienced workers)
2. A worker's question

Rules:
- Answer using ONLY the information in the retrieved context below. Do not use outside knowledge.
- If the context doesn't contain enough information to answer, say so clearly instead of guessing.
- Keep the answer short, simple, and practical.
- Do not use technical jargon unless the worker's question used it first.

Retrieved context:
{context}

Worker's question:
{question}

Answer:"""


# --- Endpoints ---
@app.post("/ask")
def ask(req: AskRequest):
    # 1. Turn the question into an embedding
    question_embedding = embed_text(req.question)

    # 2. Search Chroma for the most relevant chunks, filtered to this machine only
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=4,
        where={"machine_id": req.machine_id},
    )

    retrieved_chunks = results["documents"][0] if results["documents"] else []
    context = "\n\n".join(retrieved_chunks)

    if not context:
        return {"answer": "I don't have any knowledge saved for this machine yet."}

    # 3. Ask Gemini to answer using only that context
    prompt = ANSWER_PROMPT.format(context=context, question=req.question)
    response = client.models.generate_content(model=LLM_MODEL, contents=prompt)

    return {
        "answer": response.text,
        "sources_used": len(retrieved_chunks),
    }


@app.post("/add-knowledge")
def add_knowledge(req: AddKnowledgeRequest):
    # 1. Embed the worker's knowledge text
    embedding = embed_text(req.text, task_type="RETRIEVAL_DOCUMENT")

    # 2. Save it to Chroma, tagged with machine_id and who said it
    entry_id = f"{req.machine_id}-worker-{req.worker_name}-{hash(req.text) % 100000}"
    collection.add(
        ids=[entry_id],
        embeddings=[embedding],
        documents=[req.text],
        metadatas=[{
            "machine_id": req.machine_id,
            "source_type": "worker_input",
            "worker_name": req.worker_name,
        }],
    )

    return {"status": "saved", "id": entry_id}


@app.get("/")
def root():
    return {"message": "SkillVault AI backend is running."}