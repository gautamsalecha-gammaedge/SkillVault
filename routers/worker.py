"""
routers/worker.py

POST /worker/register - one-time worker account creation (saved in Postgres).
                         Starts out unapproved (is_approved=False) until an admin approves it.
POST /worker/login     - worker logs in, gets a token that expires after TOKEN_EXPIRY_HOURS.
                         Blocked with a 403 until the account has been approved by an admin.
"""

import secrets
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from db import get_db
from models import Worker, WorkerSession
from schemas import WorkerRegisterRequest, WorkerLoginRequest
from auth.security import hash_password, make_expiry_time
from config import TOKEN_EXPIRY_HOURS

router = APIRouter(prefix="/worker" , tags=["worker"])


@router.post("/register")
def worker_register(req: WorkerRegisterRequest, db: Session = Depends(get_db)):
    """A worker creates their account once - worker_id, password, and their name. Saved in Postgres.
    Starts unapproved - is_approved defaults to False until an admin approves it."""
    existing = db.query(Worker).filter(Worker.worker_id == req.worker_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="This worker ID is already registered. Please log in instead.")

    new_worker = Worker(
        worker_id=req.worker_id,
        password_hash=hash_password(req.password),
        name=req.name,
    )
    db.add(new_worker)
    db.commit()

    return {
        "status": "registered",
        "worker_id": req.worker_id,
        "name": req.name,
        "message": "Registration received. An admin must approve your account before you can log in.",
    }


@router.post("/login")
def worker_login(req: WorkerLoginRequest, db: Session = Depends(get_db)):
    """A worker logs in with their worker_id and password, and gets a token that expires after TOKEN_EXPIRY_HOURS.
    Blocked with a 403 if the account hasn't been approved by an admin yet."""
    worker = db.query(Worker).filter(Worker.worker_id == req.worker_id).first()
    if not worker:
        raise HTTPException(status_code=401, detail="Worker ID not found. Please register first.")

    if worker.password_hash != hash_password(req.password):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    if not worker.is_approved:
        raise HTTPException(status_code=403, detail="Your account is still waiting for admin approval.")

    token = secrets.token_hex(16)
    session = WorkerSession(token=token, worker_id=worker.worker_id, expires_at=make_expiry_time())
    db.add(session)
    db.commit()

    return {
        "token": token,
        "name": worker.name,
        "expires_in_hours": TOKEN_EXPIRY_HOURS,
        "message": "Login successful. Use this token in the Authorization header as 'Bearer <token>'.",
    }