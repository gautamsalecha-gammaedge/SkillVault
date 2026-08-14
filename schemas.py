"""
schemas.py

Pydantic request models - what the frontend must send to each endpoint.
Kept in one file since they're small and every router needs a subset of them.
"""

from pydantic import BaseModel


class AskRequest(BaseModel):
    question: str
    machine_id: str


class AddKnowledgeRequest(BaseModel):
    text: str
    machine_id: str
    language_code: str = "en-IN"
    # No worker_name field - it's pulled automatically from the logged-in worker's account
    # language_code is only used to pick which language to phrase the spoken
    # confirmation in - it doesn't affect what gets stored.


class CheckKnowledgeRequest(BaseModel):
    text: str
    machine_id: str
    round: int = 1
    # round = which clarification round this check call represents.
    # round 1 = first attempt. round 2 = after the worker answered one
    # clarifying question. The backend forces completion at round >= 2,
    # regardless of what the model thinks, to cap the back-and-forth.


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