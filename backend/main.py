"""
main.py

Creates the FastAPI app and wires up all routers. Stays intentionally
tiny - actual endpoint logic lives in routers/, auth logic in auth/,
RAG logic (chunking, embeddings, vector store, prompts) in rag/.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os

from routers import ask, knowledge, worker, admin, voice, tickets, analytics, interview, safety, daily_updates

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="SkillVault AI Backend")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads/videos", exist_ok=True)
os.makedirs("uploads/images", exist_ok=True)
os.makedirs("uploads/interview_audio", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(ask.router)
app.include_router(knowledge.router)
app.include_router(worker.router)
app.include_router(admin.router)
app.include_router(voice.router)
app.include_router(tickets.router)
app.include_router(analytics.router)
app.include_router(interview.router)
app.include_router(interview.admin_router)
app.include_router(safety.router)
app.include_router(safety.admin_router)
app.include_router(daily_updates.router)
app.include_router(daily_updates.admin_router)

@app.get("/")
def root():
    return {"message": "SkillVault AI backend is running."}