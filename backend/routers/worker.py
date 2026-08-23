"""
routers/worker.py

POST /worker/register  - one-time worker account creation (saved in Postgres).
                          Starts out unapproved (is_approved=False) until an admin approves it.
                          worker_id is auto-generated and returned so the worker can log in later.
POST /worker/login      - worker logs in, gets a token that expires after TOKEN_EXPIRY_HOURS.
                          Blocked with a 403 until the account has been approved by an admin.
GET  /worker/me         - returns the logged-in worker's profile.
PUT  /worker/profile    - worker updates their own name / phone / address (not password, not worker_id).
GET  /worker/my-machines - returns only the machines this worker has been assigned.
GET  /worker/my-tips    - returns every knowledge entry this worker has personally
                          submitted, with each one's current status.
"""

import secrets
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from db import get_db
from models import Worker, WorkerSession, WorkerMachine
from schemas import WorkerRegisterRequest, WorkerLoginRequest, WorkerUpdateProfileRequest
from auth.security import hash_password, verify_password, make_expiry_time
from config import TOKEN_EXPIRY_HOURS
from auth.worker_auth import require_worker
from rag.chroma_store import collection

router = APIRouter(prefix="/worker", tags=["worker"])


def _generate_worker_id(db: Session) -> str:
    """Generate a unique worker_id like W-A1B2C3D4."""
    for _ in range(20):
        candidate = "W-" + secrets.token_hex(4).upper()
        exists = db.query(Worker).filter(Worker.worker_id == candidate).first()
        if not exists:
            return candidate
    raise HTTPException(status_code=500, detail="Could not generate a unique worker ID. Please try again.")


def _worker_public(worker: Worker) -> dict:
    return {
        "worker_id": worker.worker_id,
        "name": worker.name,
        "phone": worker.phone,
        "address": worker.address,
        "is_approved": worker.is_approved,
    }


@router.post("/register")
def worker_register(req: WorkerRegisterRequest, db: Session = Depends(get_db)):
    """
    A worker creates their account once — name, password, optional phone/address.
    worker_id is auto-generated and returned. Starts unapproved until an admin approves it.
    """
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="Name is required.")
    if not req.password or len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    worker_id = _generate_worker_id(db)

    new_worker = Worker(
        worker_id=worker_id,
        password_hash=hash_password(req.password),
        name=req.name.strip(),
        phone=(req.phone.strip() if req.phone else None),
        address=(req.address.strip() if req.address else None),
    )
    db.add(new_worker)
    db.commit()

    return {
        "status": "registered",
        "worker_id": worker_id,
        "name": new_worker.name,
        "phone": new_worker.phone,
        "address": new_worker.address,
        "message": (
            f"Registration received. Your Worker ID is {worker_id} — save it to log in. "
            "An admin must approve your account before you can log in."
        ),
    }


@router.post("/login")
def worker_login(req: WorkerLoginRequest, db: Session = Depends(get_db)):
    """A worker logs in with their worker_id and password, and gets a token that expires after TOKEN_EXPIRY_HOURS.
    Blocked with a 403 if the account hasn't been approved by an admin yet."""
    worker = db.query(Worker).filter(Worker.worker_id == req.worker_id).first()
    if not worker:
        raise HTTPException(status_code=401, detail="Worker ID not found. Please register first.")

    if not verify_password(req.password, worker.password_hash):
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
        "worker_id": worker.worker_id,
        "phone": worker.phone,
        "address": worker.address,
        "expires_in_hours": TOKEN_EXPIRY_HOURS,
        "message": "Login successful. Use this token in the Authorization header as 'Bearer <token>'.",
    }


@router.get("/me")
def worker_me(worker: dict = Depends(require_worker), db: Session = Depends(get_db)):
    """Returns the logged-in worker's full profile."""
    row = db.query(Worker).filter(Worker.worker_id == worker["worker_id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="Worker not found.")
    return _worker_public(row)


@router.put("/profile")
def worker_update_profile(
    req: WorkerUpdateProfileRequest,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """Worker updates their own name / phone / address. Cannot change password or worker_id here."""
    row = db.query(Worker).filter(Worker.worker_id == worker["worker_id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="Worker not found.")

    if req.name is not None:
        name = req.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty.")
        row.name = name
    if req.phone is not None:
        row.phone = req.phone.strip() or None
    if req.address is not None:
        row.address = req.address.strip() or None

    db.commit()
    db.refresh(row)
    return {"status": "updated", **_worker_public(row)}


@router.get("/my-machines")
def my_machines(worker: dict = Depends(require_worker), db: Session = Depends(get_db)):
    """Returns only the machines THIS logged-in worker has been assigned by admin."""
    assignments = db.query(WorkerMachine).filter(WorkerMachine.worker_id == worker["worker_id"]).all()
    return {"machine_ids": [a.machine_id for a in assignments]}


@router.get("/my-tips")
def my_tips(worker: dict = Depends(require_worker)):
    """
    Returns every knowledge entry this worker has personally submitted,
    across all machines, with each one's current status.
    """
    results = collection.get(where={"worker_id": worker["worker_id"]})

    tips = []
    for i in range(len(results["ids"])):
        meta = results["metadatas"][i]
        tips.append({
            "id": results["ids"][i],
            "text": results["documents"][i],
            "machine_id": meta.get("machine_id"),
            "status": meta.get("status", "pending"),
        })

    return {"tips": tips}