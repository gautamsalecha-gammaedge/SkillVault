"""
routers/admin.py

POST   /admin/login          - admin logs in, gets a token that expires after TOKEN_EXPIRY_HOURS
GET    /admin/pending        - admin views knowledge waiting for approval, for one machine
POST   /admin/approve/{id}   - admin approves a pending entry
DELETE /admin/delete/{id}    - admin deletes an entry (pending or approved)
"""

import secrets
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from db import get_db
from models import AdminSession
from schemas import AdminLoginRequest
from auth.security import make_expiry_time
from auth.admin_auth import require_admin
from rag.chroma_store import collection
from config import ADMIN_USERNAME, ADMIN_PASSWORD, TOKEN_EXPIRY_HOURS

router = APIRouter(prefix="/admin")


@router.post("/login")
def admin_login(req: AdminLoginRequest, db: Session = Depends(get_db)):
    if req.username != ADMIN_USERNAME or req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Incorrect username or password.")

    token = secrets.token_hex(16)
    session = AdminSession(token=token, expires_at=make_expiry_time())
    db.add(session)
    db.commit()

    return {
        "token": token,
        "expires_in_hours": TOKEN_EXPIRY_HOURS,
        "message": "Login successful. Use this token in the Authorization header as 'Bearer <token>'.",
    }


@router.get("/pending")
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


@router.post("/approve/{entry_id}")
def approve_entry(entry_id: str, authorized: bool = Depends(require_admin)):
    """Marks a pending worker entry as approved, so it becomes searchable in /ask."""
    existing = collection.get(ids=[entry_id])
    if not existing["ids"]:
        raise HTTPException(status_code=404, detail="Entry not found.")

    metadata = existing["metadatas"][0]
    metadata["status"] = "approved"
    collection.update(ids=[entry_id], metadatas=[metadata])

    return {"status": "approved", "id": entry_id}


@router.delete("/delete/{entry_id}")
def delete_entry(entry_id: str, authorized: bool = Depends(require_admin)):
    """Permanently deletes an entry (manual chunk or worker entry) by its ID."""
    collection.delete(ids=[entry_id])
    return {"status": "deleted", "id": entry_id}