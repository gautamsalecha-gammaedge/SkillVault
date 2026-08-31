"""
routers/admin.py

POST   /admin/login                    - admin logs in, gets a token that expires after TOKEN_EXPIRY_HOURS
GET    /admin/pending                  - admin views knowledge waiting for approval, for one machine
GET    /admin/knowledge                - list worker tips by status (pending|approved|rejected)
POST   /admin/approve/{id}             - admin approves a pending/rejected knowledge entry
POST   /admin/reject/{id}              - soft-reject a tip (kept for history, not used in Ask)
DELETE /admin/delete/{id}              - permanently deletes a knowledge entry
GET    /admin/pending-workers          - admin views worker registrations waiting for approval
POST   /admin/approve-worker/{id}      - admin approves a worker's account, letting them log in
DELETE /admin/reject-worker/{id}       - admin rejects/removes a worker's registration entirely
GET    /admin/profile                  - admin views their own editable display name
PUT    /admin/profile                  - admin updates their own display name (never the password)
PUT    /admin/workers/{worker_id}      - admin updates a worker's profile, optionally
                                          renaming their worker_id too (never the password)
"""

import secrets
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from rag.embeddings import embed_text_with_retry
from db import get_db
from models import (
    Admin, AdminSession, AdminProfile, Worker, WorkerSession, WorkerMachine,
    Ticket, QuestionLog, InterviewSession, InterviewTurn, SafetyMeasure,
    SafetyCompletion, PasswordResetRequest, DailyUpdate,
)
from schemas import (
    AdminLoginRequest,
    AssignMachineRequest,
    EditEntryRequest,
    AdminProfileUpdateRequest,
    AdminUpdateWorkerRequest,
    AdminSetPasswordRequest,
    AdminChangePasswordRequest,
    AdminCreateSupervisorRequest,
    AdminSetRolesRequest,
)
from auth.security import hash_password, verify_password, make_expiry_time
from auth.admin_auth import require_admin
from auth.admin_accounts import ensure_seed_admin
from rag.chroma_store import collection, list_manuals, delete_manual, list_all_machine_ids, delete_all_for_machine
from config import TOKEN_EXPIRY_HOURS

import tempfile
import os
from fastapi import UploadFile, File, Form
from ingest import ingest_pdf
router = APIRouter(prefix="/admin",tags=["Admin"])


@router.post("/login")
def admin_login(req: AdminLoginRequest, db: Session = Depends(get_db)):
    """
    Supervisor login via unified users + roles (supervisor role required).
    Seeds first supervisor if none exist; migrates legacy admins/workers into users.
    """
    from auth.user_accounts import (
        seed_first_supervisor_if_empty,
        authenticate,
        ROLE_SUPERVISOR,
        migrate_all_identities,
    )
    from auth.admin_accounts import ensure_admin_schema

    ensure_admin_schema(db)
    seed_first_supervisor_if_empty(db)
    migrate_all_identities(db)
    from auth.user_accounts import ensure_at_least_one_owner
    ensure_at_least_one_owner(db)

    username = (req.username or "").strip()
    from auth.rate_limit import check_rate_limit
    check_rate_limit(
        f"admin_login:{username.lower()}",
        max_hits=10,
        window_seconds=300,
        detail="Too many login attempts. Wait 5 minutes and try again.",
    )
    result = authenticate(db, username, req.password)
    if not result:
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    user, roles = result
    if ROLE_SUPERVISOR not in roles:
        raise HTTPException(
            status_code=403,
            detail="This account is not a supervisor. Use Worker sign-in, or ask an admin to promote you.",
        )

    token = secrets.token_hex(16)
    session = AdminSession(
        token=token,
        admin_id=user.user_id,
        expires_at=make_expiry_time(),
    )
    db.add(session)
    db.commit()

    return {
        "token": token,
        "name": user.name or user.user_id,
        "username": user.user_id,
        "roles": roles,
        "expires_in_hours": TOKEN_EXPIRY_HOURS,
        "message": "Login successful. Use this token in the Authorization header as 'Bearer <token>'.",
    }



@router.post("/logout")
def admin_logout(admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Revoke current admin session token (Sign out)."""
    tok = admin.get("token")
    if tok:
        db.query(AdminSession).filter(AdminSession.token == tok).delete()
        db.commit()
    return {"status": "logged_out", "message": "Session ended."}


@router.post("/supervisors")
def create_supervisor_account(
    req: AdminCreateSupervisorRequest,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a supervisor-only account. Owner role required."""
    from auth.user_accounts import create_supervisor, user_is_owner, ensure_at_least_one_owner
    ensure_at_least_one_owner(db)
    if not user_is_owner(db, admin["admin_id"]):
        raise HTTPException(
            status_code=403,
            detail="Only the plant owner can create new supervisors. Ask the owner account.",
        )
    try:
        return create_supervisor(
            db,
            username=req.username,
            password=req.password,
            name=req.name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/workers/{worker_id}/roles")
def set_worker_roles(
    worker_id: str,
    req: AdminSetRolesRequest,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Owner sets Floor worker / Supervisor checkboxes for one account."""
    from auth.user_accounts import set_user_roles, user_is_owner, ensure_at_least_one_owner
    ensure_at_least_one_owner(db)
    if not user_is_owner(db, admin["admin_id"]):
        raise HTTPException(
            status_code=403,
            detail="Only the plant owner can change worker / supervisor roles.",
        )
    try:
        return set_user_roles(
            db,
            worker_id,
            as_worker=bool(req.as_worker),
            as_supervisor=bool(req.as_supervisor),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/workers/{worker_id}/promote")
def promote_worker(
    worker_id: str,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Grant supervisor role to an existing worker. Owner only."""
    from auth.user_accounts import (
        promote_worker_to_supervisor,
        user_is_owner,
        ensure_at_least_one_owner,
    )
    ensure_at_least_one_owner(db)
    if not user_is_owner(db, admin["admin_id"]):
        raise HTTPException(
            status_code=403,
            detail="Only the plant owner can promote a worker to supervisor.",
        )
    try:
        return promote_worker_to_supervisor(db, worker_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/profile")
def get_admin_profile(admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Logged-in admin profile from the admins table."""
    from auth.user_accounts import user_is_owner, ensure_at_least_one_owner, _roles_of
    ensure_at_least_one_owner(db)
    row = db.query(Admin).filter(Admin.admin_id == admin["admin_id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="Admin not found.")
    roles = _roles_of(db, admin["admin_id"])
    return {
        "username": row.admin_id,
        "name": row.name,
        "roles": roles,
        "is_owner": user_is_owner(db, admin["admin_id"]),
    }


@router.put("/profile")
def update_admin_profile(
    req: AdminProfileUpdateRequest,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update display name (not login username)."""
    row = db.query(Admin).filter(Admin.admin_id == admin["admin_id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="Admin not found.")
    row.name = (req.name or "").strip() or row.name
    db.commit()
    return {"status": "updated", "username": row.admin_id, "name": row.name}


@router.post("/change-password")
def admin_change_password(
    req: AdminChangePasswordRequest,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Logged-in admin sets a new password (must know the current one)."""
    row = db.query(Admin).filter(Admin.admin_id == admin["admin_id"]).first()
    if not row:
        raise HTTPException(status_code=404, detail="Admin not found.")
    if not verify_password(req.current_password, row.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    new_pw = (req.new_password or "").strip()
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirmation do not match.")
    from auth.user_accounts import set_password_for_user
    set_password_for_user(db, admin["admin_id"], new_pw)
    return {"status": "password_updated", "message": "Password updated. Use it next time you sign in."}


def _entry_from_chroma(entry_id, document, meta):
    """Normalize a Chroma worker tip for the admin knowledge UI."""
    return {
        "id": entry_id,
        "text": document,
        "status": meta.get("status") or "pending",
        "worker_id": meta.get("worker_id"),
        "worker_name": meta.get("worker_name"),
        "machine_id": meta.get("machine_id"),
        "source_type": meta.get("source_type") or "worker_input",
        "video_url": meta.get("video_url") or None,
        "transcript": meta.get("transcript") or "",
        "video_description": meta.get("video_description") or "",
        "image_url": meta.get("image_url") or None,
        "image_description": meta.get("image_description") or "",
        "image_visible_text": meta.get("image_visible_text") or "",
    }


@router.post("/approve/{entry_id}")
def approve_entry(entry_id: str, authorized: bool = Depends(require_admin)):
    """Marks a knowledge entry as approved so it becomes searchable in /ask.
    Works for pending and previously rejected tips."""
    existing = collection.get(ids=[entry_id])
    if not existing["ids"]:
        raise HTTPException(status_code=404, detail="Entry not found.")

    metadata = existing["metadatas"][0]
    metadata["status"] = "approved"
    collection.update(ids=[entry_id], metadatas=[metadata])

    return {"status": "approved", "id": entry_id}


@router.post("/reject/{entry_id}")
def reject_entry(entry_id: str, authorized: bool = Depends(require_admin)):
    """Soft-rejects a tip: kept in history, hidden from Ask retrieval.
    Prefer this over hard delete when you want an audit trail."""
    existing = collection.get(ids=[entry_id])
    if not existing["ids"]:
        raise HTTPException(status_code=404, detail="Entry not found.")

    metadata = existing["metadatas"][0]
    if metadata.get("source_type") == "manual":
        raise HTTPException(status_code=400, detail="Cannot reject a manual chunk this way.")

    metadata["status"] = "rejected"
    collection.update(ids=[entry_id], metadatas=[metadata])

    return {"status": "rejected", "id": entry_id}


@router.delete("/delete/{entry_id}")
def delete_entry(entry_id: str, authorized: bool = Depends(require_admin)):
    """Permanently deletes a knowledge entry (manual chunk or worker tip) by its ID."""
    collection.delete(ids=[entry_id])
    return {"status": "deleted", "id": entry_id}


@router.get("/knowledge")
def list_knowledge(
    machine_id: str,
    status: str = "pending",
    authorized: bool = Depends(require_admin),
):
    """
    Lists worker tips for one machine filtered by status:
    pending | approved | rejected | all
    Manual PDF chunks are excluded (source_type != worker_input when set).
    """
    status = (status or "pending").strip().lower()
    allowed = {"pending", "approved", "rejected", "all"}
    if status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of: {', '.join(sorted(allowed))}",
        )

    if status == "all":
        results = collection.get(where={"machine_id": machine_id})
    else:
        results = collection.get(
            where={
                "$and": [
                    {"machine_id": machine_id},
                    {"status": status},
                ]
            }
        )

    entries = []
    for i in range(len(results["ids"])):
        meta = results["metadatas"][i] or {}
        source = (meta.get("source_type") or "").strip()
        # Worker tips always carry worker_id; skip manual PDF chunks
        if source == "manual":
            continue
        if not meta.get("worker_id"):
            continue
        entries.append(
            _entry_from_chroma(results["ids"][i], results["documents"][i], meta)
        )

    return {
        "machine_id": machine_id,
        "status": status,
        "count": len(entries),
        "entries": entries,
        # backward-compatible alias used by older clients
        "pending_entries": entries if status == "pending" else [],
    }

@router.get("/workers")
def get_all_workers(authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Returns every registered worker, approved or not - used to populate
    the admin's worker list/dropdown when assigning machines."""
    from auth.user_accounts import _roles_of, ensure_users_schema, ROLE_WORKER, ROLE_SUPERVISOR, ROLE_OWNER
    ensure_users_schema(db)
    workers = db.query(Worker).all()
    from auth.user_accounts import ensure_role
    out = []
    for w in workers:
        roles = _roles_of(db, w.worker_id)
        # Brand-new identity with zero roles → default floor worker once
        if not roles:
            ensure_role(db, w.worker_id, ROLE_WORKER)
            roles = _roles_of(db, w.worker_id)
        out.append({
            "worker_id": w.worker_id,
            "name": w.name,
            "is_approved": w.is_approved,
            "phone_country_code": w.phone_country_code,
            "phone_number": w.phone_number,
            "address": w.address,
            "roles": roles,
            "is_worker": ROLE_WORKER in roles,
            "is_supervisor": ROLE_SUPERVISOR in roles,
            "is_owner": ROLE_OWNER in roles,
        })
    return {"workers": out}

@router.get("/pending")
def get_pending(machine_id: str, authorized: bool = Depends(require_admin)):
    """Returns all worker-added knowledge entries still waiting for admin approval, for one machine.
    Includes video fields and image fields (image_url / image_description / image_visible_text)
    when the tip has attached media."""
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
        entries.append(_entry_from_chroma(results["ids"][i], results["documents"][i], meta))
    return {"pending_entries": entries, "entries": entries, "count": len(entries)}


# --- Worker account approval ---

@router.get("/pending-workers")
def get_pending_workers(authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Returns every worker account still waiting for admin approval,
    including profile fields collected at registration."""
    pending = db.query(Worker).filter(Worker.is_approved == False).all()  # noqa: E712
    return {
        "pending_workers": [
            {
                "worker_id": w.worker_id,
                "name": w.name,
                "phone_country_code": w.phone_country_code or "+91",
                "phone_number": w.phone_number or "",
                "address": w.address or "",
            }
            for w in pending
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


# --- Worker profile management (admin editing a worker) ---

# Every table that has a worker_id foreign key pointing at workers.worker_id -
# used by the rename cascade below. If a new table gains a worker_id FK later,
# it needs to be added here too or a rename will silently orphan its rows.
_WORKER_ID_CHILD_TABLES = [WorkerSession, WorkerMachine, Ticket, QuestionLog, InterviewSession, SafetyCompletion]


@router.put("/workers/{worker_id}")
def admin_update_worker(
    worker_id: str,
    req: AdminUpdateWorkerRequest,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin updates any field on a worker's profile except the password -
    admin can never set or view a worker's password. Only fields actually
    provided in the request are changed.

    If new_worker_id is provided and differs from the current one, the
    worker's login ID is renamed. Since worker_id is the primary key AND
    is referenced by several other tables' foreign keys, a direct UPDATE
    isn't possible while those rows still point at the old id - so this:
      1. inserts a new Worker row under new_worker_id (copy of the old one,
         with any other requested field changes already applied)
      2. re-points every child row (sessions, machine assignments, tickets,
         question logs, interview sessions, safety completions) at the new id
      3. deletes the old Worker row
      4. updates worker_id in every matching Chroma entry (tips this worker
         submitted), so their submission history stays attributed to them
    all inside one transaction, so a failure partway through rolls back
    cleanly instead of leaving the worker half-renamed.
    """
    worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found.")

    new_id = req.new_worker_id.strip() if req.new_worker_id else None
    renaming = bool(new_id) and new_id != worker_id

    if renaming:
        if db.query(Worker).filter(Worker.worker_id == new_id).first():
            raise HTTPException(status_code=400, detail=f"Worker ID '{new_id}' is already in use.")

    final_name = req.name if req.name is not None else worker.name
    final_country_code = req.phone_country_code if req.phone_country_code is not None else worker.phone_country_code
    final_phone = req.phone_number if req.phone_number is not None else worker.phone_number
    final_address = req.address if req.address is not None else worker.address

    try:
        if renaming:
            new_worker = Worker(
                worker_id=new_id,
                password_hash=worker.password_hash,
                name=final_name,
                is_approved=worker.is_approved,
                phone_country_code=final_country_code,
                phone_number=final_phone,
                address=final_address,
                email=getattr(worker, "email", None),
                email_verified=bool(getattr(worker, "email_verified", False)),
            )
            db.add(new_worker)
            db.flush()  # new row must exist before children are re-pointed at it

            for table in _WORKER_ID_CHILD_TABLES:
                db.query(table).filter(table.worker_id == worker_id).update({"worker_id": new_id})

            db.delete(worker)
            db.commit()

            # Chroma tips carry worker_id in metadata, not a DB foreign key -
            # update those separately so /worker/my-tips still finds them.
            tip_entries = collection.get(where={"worker_id": worker_id})
            for i, entry_id in enumerate(tip_entries["ids"]):
                meta = tip_entries["metadatas"][i]
                meta["worker_id"] = new_id
                collection.update(ids=[entry_id], metadatas=[meta])

            final_worker_id = new_id
        else:
            worker.name = final_name
            worker.phone_country_code = final_country_code
            worker.phone_number = final_phone
            worker.address = final_address
            db.commit()
            final_worker_id = worker_id

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not update worker - a conflicting record already exists.")

    return {
        "status": "updated",
        "worker_id": final_worker_id,
        "name": final_name,
        "phone_country_code": final_country_code,
        "phone_number": final_phone,
        "address": final_address,
    }


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
    """
    Lists every machine_id that still has knowledge in Chroma (manuals or tips).
    Used for assignment dropdowns and the Manuals page machine list.
    """
    return {"machine_ids": list_all_machine_ids()}


@router.delete("/machines/{machine_id}")
def delete_machine(
    machine_id: str,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Permanently remove a machine and all related data in one click:

    - All Chroma knowledge (manuals, worker tips, interview-derived entries)
    - Worker ↔ machine assignments
    - Safety measures + completions for this machine
    - Interview sessions (+ turns) for this machine
    - Tickets, question logs, daily updates tagged with this machine

    After this, the machine disappears from admin lists, worker selectors,
    Ask, Safety, Interview, etc. Workers can no longer select it.
    """
    machine_id = (machine_id or "").strip()
    if not machine_id:
        raise HTTPException(status_code=400, detail="machine_id is required.")

    # How many workers had this machine (for response)
    assignment_count = (
        db.query(WorkerMachine)
        .filter(WorkerMachine.machine_id == machine_id)
        .count()
    )

    # --- Postgres cascade (order matters where FKs exist) ---
    # Interview turns → sessions
    session_ids = [
        r[0]
        for r in db.query(InterviewSession.id)
        .filter(InterviewSession.machine_id == machine_id)
        .all()
    ]
    turns_deleted = 0
    if session_ids:
        turns_deleted = (
            db.query(InterviewTurn)
            .filter(InterviewTurn.session_id.in_(session_ids))
            .delete(synchronize_session=False)
        )
    sessions_deleted = (
        db.query(InterviewSession)
        .filter(InterviewSession.machine_id == machine_id)
        .delete(synchronize_session=False)
    )

    safety_measures_deleted = (
        db.query(SafetyMeasure)
        .filter(SafetyMeasure.machine_id == machine_id)
        .delete(synchronize_session=False)
    )
    safety_completions_deleted = (
        db.query(SafetyCompletion)
        .filter(SafetyCompletion.machine_id == machine_id)
        .delete(synchronize_session=False)
    )
    tickets_deleted = (
        db.query(Ticket)
        .filter(Ticket.machine_id == machine_id)
        .delete(synchronize_session=False)
    )
    question_logs_deleted = (
        db.query(QuestionLog)
        .filter(QuestionLog.machine_id == machine_id)
        .delete(synchronize_session=False)
    )
    daily_updates_deleted = (
        db.query(DailyUpdate)
        .filter(DailyUpdate.machine_id == machine_id)
        .delete(synchronize_session=False)
    )
    assignments_deleted = (
        db.query(WorkerMachine)
        .filter(WorkerMachine.machine_id == machine_id)
        .delete(synchronize_session=False)
    )

    db.commit()

    # --- Chroma: all knowledge for this machine ---
    chroma_deleted = delete_all_for_machine(machine_id)

    return {
        "status": "deleted",
        "machine_id": machine_id,
        "summary": {
            "chroma_entries_removed": chroma_deleted,
            "worker_assignments_removed": assignments_deleted,
            "workers_affected": assignment_count,
            "interview_sessions_removed": sessions_deleted,
            "interview_turns_removed": turns_deleted,
            "safety_measures_removed": safety_measures_deleted,
            "safety_completions_removed": safety_completions_deleted,
            "tickets_removed": tickets_deleted,
            "question_logs_removed": question_logs_deleted,
            "daily_updates_removed": daily_updates_deleted,
        },
        "message": (
            f"Machine '{machine_id}' and all related knowledge, assignments, "
            "interviews, safety data, tickets, and daily updates were removed."
        ),
    }


@router.post("/assign-machine")
def assign_machine(req: AssignMachineRequest, authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    """Grants a worker access to one machine. Safe to call again for an already-assigned pair (no duplicate error).
    Only machines that still exist in the knowledge base (have Chroma entries) can be assigned,
    so deleted machines cannot be re-assigned by accident.
    """
    worker = db.query(Worker).filter(Worker.worker_id == req.worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found.")

    mid = (req.machine_id or "").strip()
    if not mid:
        raise HTTPException(status_code=400, detail="machine_id is required.")

    known = set(list_all_machine_ids())
    if mid not in known:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Machine '{mid}' does not exist or was deleted. "
                "Upload a manual for this machine first, or pick a machine from the list."
            ),
        )

    existing = db.query(WorkerMachine).filter(
        WorkerMachine.worker_id == req.worker_id,
        WorkerMachine.machine_id == mid,
    ).first()
    if existing:
        return {"status": "already assigned", "worker_id": req.worker_id, "machine_id": mid}

    db.add(WorkerMachine(worker_id=req.worker_id, machine_id=mid))
    db.commit()

    return {"status": "assigned", "worker_id": req.worker_id, "machine_id": mid}


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

@router.put("/workers/{worker_id}/password")
def admin_set_worker_password(
    worker_id: str,
    req: AdminSetPasswordRequest,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Set a temporary password ONLY if this worker has a pending
    forgot-password request (supervisor path). Share the password offline.
    """
    from models import WorkerSession, PasswordResetRequest
    from datetime import datetime

    pwd = (req.temporary_password or "").strip()
    if len(pwd) < 6:
        raise HTTPException(status_code=400, detail="Temporary password must be at least 6 characters.")
    worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found.")

    pending = (
        db.query(PasswordResetRequest)
        .filter(
            PasswordResetRequest.worker_id == worker_id,
            PasswordResetRequest.status == "pending",
        )
        .order_by(PasswordResetRequest.id.desc())
        .first()
    )
    if not pending:
        raise HTTPException(
            status_code=400,
            detail="No pending password-reset request from this worker. They must use Forgot password → Ask supervisor first.",
        )

    from auth.user_accounts import set_password_for_user
    set_password_for_user(db, worker_id, pwd)
    pending.status = "completed"
    pending.resolved_at = datetime.utcnow()
    pending.resolved_by = "admin"
    db.commit()
    return {
        "status": "password_set",
        "worker_id": worker_id,
        "message": "Temporary password set. Share it with the worker securely. Their reset request is closed.",
    }


@router.get("/password-reset-requests")
def list_password_reset_requests(
    status: str = "pending",
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Pending (or all) password reset requests from workers."""
    from models import PasswordResetRequest, Worker
    from sqlalchemy import text as sql_text
    try:
        db.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS password_reset_requests (
                id SERIAL PRIMARY KEY,
                worker_id VARCHAR NOT NULL,
                status VARCHAR NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                resolved_at TIMESTAMP,
                resolved_by VARCHAR
            )
        """))
        db.commit()
    except Exception:
        db.rollback()

    q = db.query(PasswordResetRequest)
    if status and status != "all":
        q = q.filter(PasswordResetRequest.status == status)
    rows = q.order_by(PasswordResetRequest.created_at.desc()).limit(200).all()
    out = []
    for r in rows:
        w = db.query(Worker).filter(Worker.worker_id == r.worker_id).first()
        out.append({
            "id": r.id,
            "worker_id": r.worker_id,
            "name": w.name if w else None,
            "status": r.status,
            "created_at": r.created_at.isoformat() + "Z" if r.created_at else None,
            "resolved_at": r.resolved_at.isoformat() + "Z" if r.resolved_at else None,
        })
    return {"requests": out}