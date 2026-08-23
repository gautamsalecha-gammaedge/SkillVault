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
from models import AdminSession, AdminProfile, Worker, WorkerSession, WorkerMachine, Ticket, QuestionLog, InterviewSession, SafetyCompletion
from schemas import AdminLoginRequest, AssignMachineRequest, EditEntryRequest, AdminUpdateWorkerRequest, AdminUpdateProfileRequest
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

    profile = db.query(AdminProfile).filter(AdminProfile.id == 1).first()
    admin_name = profile.name if profile else "Admin"

    return {
        "token": token,
        "name": admin_name,
        "expires_in_hours": TOKEN_EXPIRY_HOURS,
        "message": "Login successful. Use this token in the Authorization header as 'Bearer <token>'.",
    }


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
            {
                "worker_id": w.worker_id,
                "name": w.name,
                "phone": w.phone,
                "address": w.address,
                "is_approved": w.is_approved,
            }
            for w in workers
        ]
    }

@router.get("/pending")
def get_pending(machine_id: str, authorized: bool = Depends(require_admin)):
    """Returns all worker-added knowledge entries still waiting for admin approval, for one machine.
    Includes video_url/transcript/video_description when the tip has an attached video (see
    rag/video_storage.py, rag/video_understanding.py, routers/knowledge.py)."""
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
        meta = results["metadatas"][i]
        entries.append({
            "id": results["ids"][i],
            "text": results["documents"][i],
            "worker_id": meta.get("worker_id"),
            "worker_name": meta.get("worker_name"),
            "video_url": meta.get("video_url") or None,
            "transcript": meta.get("transcript") or "",
            "video_description": meta.get("video_description") or "",
        })
    return {"pending_entries": entries}


# --- Worker account approval ---

@router.get("/pending-workers")
def get_pending_workers(authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Returns every worker account still waiting for admin approval."""
    pending = db.query(Worker).filter(Worker.is_approved == False).all()  # noqa: E712
    return {
        "pending_workers": [
            {
                "worker_id": w.worker_id,
                "name": w.name,
                "phone": w.phone,
                "address": w.address,
            }
            for w in pending
        ]
    }


@router.post("/approve-worker/{worker_id}")
def approve_worker(worker_id: str, authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Approves a worker's account so they can log in."""
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


# ---------- Admin profile ----------

def _get_or_create_admin_profile(db: Session) -> AdminProfile:
    profile = db.query(AdminProfile).filter(AdminProfile.id == 1).first()
    if not profile:
        profile = AdminProfile(id=1, name="Admin")
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("/profile")
def get_admin_profile(authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Returns the admin's editable profile (display name). Login credentials stay in env."""
    profile = _get_or_create_admin_profile(db)
    return {"name": profile.name}


@router.put("/profile")
def update_admin_profile(
    req: AdminUpdateProfileRequest,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin updates their display name. Password/username remain in environment variables."""
    name = (req.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty.")
    profile = _get_or_create_admin_profile(db)
    profile.name = name
    db.commit()
    db.refresh(profile)
    return {"status": "updated", "name": profile.name}


# ---------- Admin update worker profile ----------

def _rename_worker_id(db: Session, old_id: str, new_id: str) -> None:
    """
    Rename a worker's primary key and cascade to all FK tables + Chroma metadata.
    Uses insert-copy + FK rewrite + delete-old so we don't rely on ON UPDATE CASCADE.
    """
    if old_id == new_id:
        return
    existing = db.query(Worker).filter(Worker.worker_id == new_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Worker ID '{new_id}' is already taken.")

    old = db.query(Worker).filter(Worker.worker_id == old_id).first()
    if not old:
        raise HTTPException(status_code=404, detail="Worker not found.")

    # 1. Insert new row with same data
    new_row = Worker(
        worker_id=new_id,
        password_hash=old.password_hash,
        name=old.name,
        phone=old.phone,
        address=old.address,
        is_approved=old.is_approved,
    )
    db.add(new_row)
    db.flush()

    # 2. Rewrite FK references
    db.query(WorkerSession).filter(WorkerSession.worker_id == old_id).update(
        {WorkerSession.worker_id: new_id}, synchronize_session=False
    )
    db.query(WorkerMachine).filter(WorkerMachine.worker_id == old_id).update(
        {WorkerMachine.worker_id: new_id}, synchronize_session=False
    )
    db.query(Ticket).filter(Ticket.worker_id == old_id).update(
        {Ticket.worker_id: new_id}, synchronize_session=False
    )
    db.query(QuestionLog).filter(QuestionLog.worker_id == old_id).update(
        {QuestionLog.worker_id: new_id}, synchronize_session=False
    )
    db.query(InterviewSession).filter(InterviewSession.worker_id == old_id).update(
        {InterviewSession.worker_id: new_id}, synchronize_session=False
    )
    db.query(SafetyCompletion).filter(SafetyCompletion.worker_id == old_id).update(
        {SafetyCompletion.worker_id: new_id}, synchronize_session=False
    )

    # 3. Delete old primary row
    db.delete(old)
    db.flush()

    # 4. Best-effort update Chroma metadata (non-fatal if Chroma is down)
    try:
        results = collection.get(where={"worker_id": old_id})
        if results and results.get("ids"):
            for i, entry_id in enumerate(results["ids"]):
                meta = dict(results["metadatas"][i] or {})
                meta["worker_id"] = new_id
                collection.update(ids=[entry_id], metadatas=[meta])
    except Exception:
        pass  # profile update still succeeds even if vector store is unreachable


@router.put("/workers/{worker_id}")
def update_worker_profile(
    worker_id: str,
    req: AdminUpdateWorkerRequest,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin updates a worker's profile (name, phone, address, approval) and may
    rename worker_id. Password is never changed here.
    """
    worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found.")

    # Apply non-id field updates first (on current row)
    if req.name is not None:
        name = req.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty.")
        worker.name = name
    if req.phone is not None:
        worker.phone = req.phone.strip() or None
    if req.address is not None:
        worker.address = req.address.strip() or None
    if req.is_approved is not None:
        worker.is_approved = bool(req.is_approved)

    db.flush()

    final_id = worker_id
    if req.worker_id is not None:
        new_id = req.worker_id.strip()
        if not new_id:
            raise HTTPException(status_code=400, detail="Worker ID cannot be empty.")
        if new_id != worker_id:
            _rename_worker_id(db, worker_id, new_id)
            final_id = new_id

    db.commit()

    row = db.query(Worker).filter(Worker.worker_id == final_id).first()
    return {
        "status": "updated",
        "worker_id": row.worker_id,
        "name": row.name,
        "phone": row.phone,
        "address": row.address,
        "is_approved": row.is_approved,
    }