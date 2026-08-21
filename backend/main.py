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

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os

from routers import ask, knowledge, worker, admin, voice, tickets, analytics, interview , safety
# Rate limiter based on client IP
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="SkillVault AI Backend")

# Attach the limiter to the app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS - currently open for local development
# TODO: Restrict origins in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Video / Uploads support ----------
os.makedirs("uploads/videos", exist_ok=True)
os.makedirs("uploads/interview_audio", exist_ok=True)  # Tacit Knowledge Capture answer recordings
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ---------- Routers ----------
app.include_router(ask.router)
app.include_router(knowledge.router)
app.include_router(worker.router)
app.include_router(admin.router)
app.include_router(voice.router)
app.include_router(tickets.router)
app.include_router(analytics.router)
app.include_router(interview.router)         # /interview/*        - worker interview flow
app.include_router(interview.admin_router)   # /admin/interview-*  - admin session review
app.include_router(safety.router)            # /safety/*           - worker safety briefing
app.include_router(safety.admin_router)      # /admin/safety/*     - admin manage measures

@app.get("/")
def root():
    return {"message": "SkillVault AI backend is running."}