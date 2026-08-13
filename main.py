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
import json
import hashlib
import secrets
from dotenv import load_dotenv
from google import genai
from google.genai import types
import chromadb
from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# --- Setup ---
load_dotenv()
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="skillvault_knowledge")

LLM_MODEL = "gemini-3.6-flash"

app = FastAPI(title="SkillVault AI Backend")
bearer_scheme = HTTPBearer()


# --- Admin login setup ---
ADMIN_USERNAME = os.environ["ADMIN_USERNAME"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

# Simple in-memory list of currently logged-in admin tokens.
# This resets every time the server restarts - fine for a demo, not for real production use.
active_admin_tokens = set()


def require_admin(credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)):
    token = credentials.credentials
    if token not in active_admin_tokens:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token. Please log in again.")
    return True


# --- Worker login setup ---
WORKERS_FILE = "workers.json"

# Simple in-memory record of currently logged-in workers: token -> {worker_id, name}
active_worker_tokens = {}


def load_workers() -> dict:
    """Reads the workers.json file and returns it as a dictionary. Creates an empty one if missing."""
    if not os.path.exists(WORKERS_FILE):
        return {}
    with open(WORKERS_FILE, "r") as f:
        return json.load(f)


def save_workers(workers: dict):
    """Writes the workers dictionary back to workers.json."""
    with open(WORKERS_FILE, "w") as f:
        json.dump(workers, f, indent=2)


def hash_password(password: str) -> str:
    """Turns a plain password into a scrambled, unreadable string, so we never store real passwords."""
    return hashlib.sha256(password.encode()).hexdigest()


def require_worker(credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)) -> dict:
    token = credentials.credentials
    if token not in active_worker_tokens:
        raise HTTPException(status_code=401, detail="Invalid or expired worker token. Please log in again.")
    return active_worker_tokens[token]


# --- Request shapes (what the frontend must send) ---
class AskRequest(BaseModel):
    question: str
    machine_id: str


class AddKnowledgeRequest(BaseModel):
    text: str
    machine_id: str
    # No worker_name field anymore - it's pulled automatically from the logged-in worker's account


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class WorkerRegisterRequest(BaseModel):
    worker_id: str
    password: str
    name: str


class WorkerLoginRequest(BaseModel):
    worker_id: str
    password: str


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
- Do not use technical jargon unless the worker's question used it first.

Tone and style rule (very important):
- Do not just give a short flat fact. Explain it the way a helpful senior coworker would, talking to someone standing next to the machine.
- Briefly say what the issue/answer is, then briefly explain why or what it means in practical terms, then say what to actually do about it.
- Keep it to 2-4 short sentences total. Human and conversational, not a robotic list of facts.
- Avoid sounding like a manual excerpt copy-pasted back. Rephrase it in your own simple words.

Language matching rule (very important):
- Detect the exact language AND script the worker used in their question, and reply in that same language and script.
- If the question is in English, reply fully in English.
- If the question is in Hindi written in Devanagari script (like "मशीन बंद क्यों हो रही है"), reply fully in Hindi, in Devanagari script.
- If the question is in Hinglish - Hindi words typed using English/Roman letters (like "machine band kyu ho rahi hai"), reply in that same Hinglish style, using Roman letters. Do NOT switch it to Devanagari script, and do NOT translate it into pure English.
- Never mix scripts in one answer. Match whatever script the worker actually typed or spoke in.

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

    # 2. Search Chroma for the most relevant chunks, filtered to this machine
    #    AND only content that's approved (manual content is auto-approved,
    #    worker content needs admin approval first)
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

    # 3. Ask Gemini to answer using only that context
    prompt = ANSWER_PROMPT.format(context=context, question=req.question)
    response = client.models.generate_content(model=LLM_MODEL, contents=prompt)

    return {
        "answer": response.text,
        "sources_used": len(retrieved_chunks),
    }


@app.post("/add-knowledge")
def add_knowledge(req: AddKnowledgeRequest, worker: dict = Depends(require_worker)):
    # 1. Embed the worker's knowledge text
    embedding = embed_text(req.text, task_type="RETRIEVAL_DOCUMENT")

    # 2. Save it to Chroma. worker_name comes automatically from the logged-in
    #    worker's account (via the 'worker' dict from require_worker) - not typed by hand.
    #    Status starts as "pending" and will NOT show up in /ask until an admin approves it.
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


@app.get("/")
def root():
    return {"message": "SkillVault AI backend is running."}


# --- Worker endpoints ---
@app.post("/worker/register")
def worker_register(req: WorkerRegisterRequest):
    """A worker creates their account once - worker_id, password, and their name."""
    workers = load_workers()

    if req.worker_id in workers:
        raise HTTPException(status_code=400, detail="This worker ID is already registered. Please log in instead.")

    workers[req.worker_id] = {
        "password_hash": hash_password(req.password),
        "name": req.name,
    }
    save_workers(workers)

    return {"status": "registered", "worker_id": req.worker_id, "name": req.name}


@app.post("/worker/login")
def worker_login(req: WorkerLoginRequest):
    """A worker logs in with their worker_id and password, and gets a token back."""
    workers = load_workers()

    if req.worker_id not in workers:
        raise HTTPException(status_code=401, detail="Worker ID not found. Please register first.")

    stored = workers[req.worker_id]
    if stored["password_hash"] != hash_password(req.password):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    token = secrets.token_hex(16)
    active_worker_tokens[token] = {"worker_id": req.worker_id, "name": stored["name"]}

    return {"token": token, "name": stored["name"], "message": "Login successful. Use this token in the Authorization header as 'Bearer <token>'."}


# --- Admin endpoints ---
@app.post("/admin/login")
def admin_login(req: AdminLoginRequest):
    if req.username != ADMIN_USERNAME or req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Incorrect username or password.")

    # Generate a random, hard-to-guess token and remember it as "logged in"
    token = secrets.token_hex(16)
    active_admin_tokens.add(token)

    return {"token": token, "message": "Login successful. Use this token in the Authorization header as 'Bearer <token>'."}


@app.get("/admin/pending")
def get_pending(machine_id: str, authorized: bool = Depends(require_admin)):
    """Returns all worker-added entries still waiting for admin approval, for one machine."""
    results = collection.get(
        where={
            "$and": [
                {"machine_id": machine_id},
                {"status": "pending"},
            ]
        }
    )
    entries = []
    for i in range(len(results["ids"])):
        entries.append({
            "id": results["ids"][i],
            "text": results["documents"][i],
            "worker_id": results["metadatas"][i].get("worker_id"),
            "worker_name": results["metadatas"][i].get("worker_name"),
        })
    return {"pending_entries": entries}


@app.post("/admin/approve/{entry_id}")
def approve_entry(entry_id: str, authorized: bool = Depends(require_admin)):
    """Marks a pending worker entry as approved, so it becomes searchable in /ask."""
    existing = collection.get(ids=[entry_id])
    if not existing["ids"]:
        raise HTTPException(status_code=404, detail="Entry not found.")

    metadata = existing["metadatas"][0]
    metadata["status"] = "approved"
    collection.update(ids=[entry_id], metadatas=[metadata])

    return {"status": "approved", "id": entry_id}


@app.delete("/admin/delete/{entry_id}")
def delete_entry(entry_id: str, authorized: bool = Depends(require_admin)):
    """Permanently deletes an entry (manual chunk or worker entry) by its ID."""
    collection.delete(ids=[entry_id])
    return {"status": "deleted", "id": entry_id}