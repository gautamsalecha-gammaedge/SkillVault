"""
routers/tickets.py
Worker can raise tickets. Admin can view, update status/priority, and leave notes.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from db import get_db, engine
from models import Ticket, Worker
from schemas import CreateTicketRequest, UpdateTicketRequest
from auth.worker_auth import require_worker
from auth.admin_auth import require_admin

router = APIRouter(prefix="/tickets", tags=["Tickets"])


def _ensure_admin_note_column():
    """Add admin_note to existing DBs without a full migration tool."""
    statements = [
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_note TEXT",
        "ALTER TABLE tickets ADD COLUMN admin_note TEXT",
    ]
    for sql in statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
            return
        except Exception:
            continue


_ensure_admin_note_column()


def _ticket_dict(t: Ticket, worker_name: Optional[str] = None) -> dict:
    admin_note = None
    try:
        admin_note = t.admin_note
    except Exception:
        admin_note = None
    return {
        "id": t.id,
        "worker_id": t.worker_id,
        "worker_name": worker_name,
        "title": t.title,
        "description": t.description,
        "machine_id": t.machine_id,
        "priority": t.priority,
        "status": t.status,
        "admin_note": admin_note,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.post("")
def create_ticket(
    req: CreateTicketRequest,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    priority = req.priority if req.priority in {"Low", "Medium", "High"} else "Medium"
    ticket = Ticket(
        id=str(uuid.uuid4()),
        worker_id=worker["worker_id"],
        machine_id=req.machine_id,
        title=req.title.strip(),
        description=req.description.strip(),
        priority=priority,
        status="Open",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {
        "id": ticket.id,
        "status": ticket.status,
        "message": "Ticket created successfully",
    }


@router.get("/my")
def my_tickets(
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    tickets = (
        db.query(Ticket)
        .filter(Ticket.worker_id == worker["worker_id"])
        .order_by(Ticket.created_at.desc())
        .all()
    )
    return [_ticket_dict(t) for t in tickets]


@router.get("/admin")
def admin_list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    machine_id: Optional[str] = None,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all tickets for admin review. Returns a JSON array."""
    query = db.query(Ticket)
    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if machine_id:
        query = query.filter(Ticket.machine_id == machine_id)
    tickets = query.order_by(Ticket.created_at.desc()).all()

    worker_ids = {t.worker_id for t in tickets}
    names = {}
    if worker_ids:
        for w in db.query(Worker).filter(Worker.worker_id.in_(list(worker_ids))).all():
            names[w.worker_id] = w.name

    return [_ticket_dict(t, names.get(t.worker_id)) for t in tickets]


@router.patch("/{ticket_id}")
def update_ticket(
    ticket_id: str,
    req: UpdateTicketRequest,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if req.status is not None:
        allowed = {"Open", "In Progress", "Resolved", "Closed"}
        if req.status not in allowed:
            raise HTTPException(status_code=400, detail=f"Status must be one of {allowed}")
        ticket.status = req.status

    if req.priority is not None:
        if req.priority not in {"Low", "Medium", "High"}:
            raise HTTPException(status_code=400, detail="Priority must be Low, Medium, or High")
        ticket.priority = req.priority

    if req.admin_note is not None:
        try:
            ticket.admin_note = req.admin_note.strip() or None
        except Exception:
            pass

    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)

    worker = db.query(Worker).filter(Worker.worker_id == ticket.worker_id).first()
    return {
        **_ticket_dict(ticket, worker.name if worker else None),
        "message": "Ticket updated",
    }