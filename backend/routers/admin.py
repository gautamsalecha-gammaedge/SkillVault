"""
routers/admin.py

POST   /admin/login                    - admin logs in, gets a token that expires after TOKEN_EXPIRY_HOURS
GET    /admin/pending                  - admin views knowledge waiting for approval, for one machine
POST   /admin/approve/{id}             - admin approves a pending knowledge entry
DELETE /admin/delete/{id}              - admin deletes a knowledge entry (pending or approved)
GET    /admin/pending-workers          - admin views worker registrations waiting for approval
POST   /admin/approve-worker/{id}      - admin approves a worker's account, letting them log in
DELETE /admin/reject-worker/{id}       - admin rejects/removes a worker's registration entirely
"""

import secrets
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from rag.embeddings import embed_text_with_retry
from db import get_db
from models import AdminSession, Worker , WorkerSession , WorkerMachine
from schemas import AdminLoginRequest , AssignMachineRequest , EditEntryRequest
from auth.security import make_expiry_time
from auth.admin_auth import require_admin
from rag.chroma_store import collection , list_manuals, delete_manual , list_all_machine_ids
from config import ADMIN_USERNAME, ADMIN_PASSWORD, TOKEN_EXPIRY_HOURS

import tempfile
import os
from fastapi import UploadFile, File, Form
from ingest import ingest_pdf
router = APIRouter(prefix="/admin",tags=["Admin"])


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
    """Returns all worker-added knowledge entries still waiting for admin approval, for one machine."""
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
    """Marks a pending knowledge entry as approved, so it becomes searchable in /ask."""
    existing = collection.get(ids=[entry_id])
    if not existing["ids"]:
        raise HTTPException(status_code=404, detail="Entry not found.")

    metadata = existing["metadatas"][0]
    metadata["status"] = "approved"
    collection.update(ids=[entry_id], metadatas=[metadata])

    return {"status": "approved", "id": entry_id}


@router.delete("/delete/{entry_id}")
def delete_entry(entry_id: str, authorized: bool = Depends(require_admin)):
    """Permanently deletes a knowledge entry (manual chunk or worker entry) by its ID."""
    collection.delete(ids=[entry_id])
    return {"status": "deleted", "id": entry_id}

@router.get("/workers")
def get_all_workers(authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Returns every registered worker, approved or not - used to populate
    the admin's worker list/dropdown when assigning machines."""
    workers = db.query(Worker).all()
    return {
        "workers": [
            {"worker_id": w.worker_id, "name": w.name, "is_approved": w.is_approved}
            for w in workers
        ]
    }

# --- Worker account approval ---

@router.get("/pending-workers")
def get_pending_workers(authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Returns every worker account still waiting for admin approval."""
    pending = db.query(Worker).filter(Worker.is_approved == False).all()  # noqa: E712
    return {
        "pending_workers": [
            {"worker_id": w.worker_id, "name": w.name} for w in pending
        ]
    }


@router.post("/approve-worker/{worker_id}")
def approve_worker(worker_id: str, authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Approves a worker's registration, allowing them to log in from now on."""
    worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found.")

    worker.is_approved = True
    db.commit()

    return {"status": "approved", "worker_id": worker_id, "name": worker.name}


@router.delete("/reject-worker/{worker_id}")
def reject_worker(worker_id: str, authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Rejects and permanently removes a worker's registration. They would need to register again to retry.
    Deletes any active sessions for this worker first, since worker_sessions has a foreign key
    pointing at workers - Postgres won't allow deleting the worker while a session still references it."""
    worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found.")

    db.query(WorkerSession).filter(WorkerSession.worker_id == worker_id).delete()
    db.delete(worker)
    db.commit()

    return {"status": "rejected and removed", "worker_id": worker_id}


# --- Manual management (upload / list / delete) ---

@router.post("/upload-manual/")
def upload_manual(
    machine_id: str = Form(...),
    file: UploadFile = File(...),
    authorized: bool = Depends(require_admin),
):
    """
    Admin uploads a PDF manual for a machine, via Swagger's file picker
    or eventually a drag-and-drop frontend. If a manual with this exact
    filename already exists for this machine_id, its old chunks are
    replaced (override) rather than duplicated - so re-uploading the
    same file name cleanly updates it.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name

    try:
        chunk_count = ingest_pdf(tmp_path, machine_id, filename=file.filename, override=True)
    finally:
        os.remove(tmp_path)

    return {
        "status": "uploaded and ingested",
        "machine_id": machine_id,
        "filename": file.filename,
        "chunks_created": chunk_count,
    }


@router.get("/manuals")
def get_manuals(machine_id: str, authorized: bool = Depends(require_admin)):
    """Lists every manual currently ingested for one machine, with each one's chunk count."""
    return {"machine_id": machine_id, "manuals": list_manuals(machine_id)}


@router.delete("/manual")
def remove_manual(machine_id: str, filename: str, authorized: bool = Depends(require_admin)):
    """Deletes one manual's chunks entirely, for one machine - removes it from the knowledge base."""
    removed = delete_manual(machine_id, filename)
    if removed == 0:
        raise HTTPException(status_code=404, detail="No chunks found for that machine_id and filename combination.")

    return {
        "status": "deleted",
        "machine_id": machine_id,
        "filename": filename,
        "chunks_removed": removed,
    }


# --- Machine assignment ---

@router.get("/all-machines")
def get_all_machines(authorized: bool = Depends(require_admin)):
    """Lists every machine_id that has at least one manual uploaded - for the assignment dropdown."""
    return {"machine_ids": list_all_machine_ids()}


@router.post("/assign-machine")
def assign_machine(req: AssignMachineRequest, authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Grants a worker access to one machine. Safe to call again for an already-assigned pair (no duplicate error)."""
    worker = db.query(Worker).filter(Worker.worker_id == req.worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found.")

    existing = db.query(WorkerMachine).filter(
        WorkerMachine.worker_id == req.worker_id,
        WorkerMachine.machine_id == req.machine_id,
    ).first()
    if existing:
        return {"status": "already assigned", "worker_id": req.worker_id, "machine_id": req.machine_id}

    db.add(WorkerMachine(worker_id=req.worker_id, machine_id=req.machine_id))
    db.commit()

    return {"status": "assigned", "worker_id": req.worker_id, "machine_id": req.machine_id}


@router.delete("/unassign-machine")
def unassign_machine(worker_id: str, machine_id: str, authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Revokes a worker's access to one machine."""
    deleted = db.query(WorkerMachine).filter(
        WorkerMachine.worker_id == worker_id,
        WorkerMachine.machine_id == machine_id,
    ).delete()
    db.commit()

    if not deleted:
        raise HTTPException(status_code=404, detail="That worker/machine assignment doesn't exist.")

    return {"status": "unassigned", "worker_id": worker_id, "machine_id": machine_id}


@router.get("/worker-machines/{worker_id}")
def get_worker_machines(worker_id: str, authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Lists every machine currently assigned to one worker - for the admin assignment screen."""
    assignments = db.query(WorkerMachine).filter(WorkerMachine.worker_id == worker_id).all()
    return {"worker_id": worker_id, "machine_ids": [a.machine_id for a in assignments]}


@router.put("/edit/{entry_id}")
def edit_entry(entry_id: str, req: EditEntryRequest, authorized: bool = Depends(require_admin)):
    """Updates the text of a pending (or approved) knowledge entry in place, keeping its existing metadata/status."""
    existing = collection.get(ids=[entry_id])
    if not existing["ids"]:
        raise HTTPException(status_code=404, detail="Entry not found.")

    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    try:
        embedding = embed_text_with_retry(text, task_type="RETRIEVAL_DOCUMENT")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to re-embed edited text: {e}")

    collection.update(ids=[entry_id], documents=[text], embeddings=[embedding])

    return {"status": "edited", "id": entry_id, "text": text}