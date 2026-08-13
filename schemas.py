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
    # No worker_name field - it's pulled automatically from the logged-in worker's account


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