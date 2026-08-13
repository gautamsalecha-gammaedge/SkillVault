"""
main.py

Creates the FastAPI app and wires up all routers. Stays intentionally
tiny - actual endpoint logic lives in routers/, auth logic in auth/,
RAG logic (chunking, embeddings, vector store, prompts) in rag/.

Endpoints (see each router for details):
1. POST   /ask                -> routers/ask.py
2. POST   /add-knowledge      -> routers/knowledge.py
3. POST   /worker/register    -> routers/worker.py
4. POST   /worker/login       -> routers/worker.py
5. POST   /admin/login        -> routers/admin.py
6. GET    /admin/pending      -> routers/admin.py
7. POST   /admin/approve/{id} -> routers/admin.py
8. DELETE /admin/delete/{id}  -> routers/admin.py
9. GET    /                   -> health check, defined below

Run it with:
    uvicorn main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import ask, knowledge, worker, admin, voice

app = FastAPI(title="SkillVault AI Backend")

# Allows the browser-based frontend (opened as a local file, or served from
# a different origin/port) to actually call this API. Without this, the
# browser blocks the request before it reaches any endpoint - which is
# exactly what "Failed to fetch" in the voice test page means.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ask.router)
app.include_router(knowledge.router)
app.include_router(worker.router)
app.include_router(admin.router)
app.include_router(voice.router)


@app.get("/")
def root():
    return {"message": "SkillVault AI backend is running."}