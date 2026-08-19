"""
routers/tickets.py
Worker can raise tickets. Admin can view and update status.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from datetime import datetime

from db import get_db
from models import Ticket, Worker
from schemas import CreateTicketRequest, UpdateTicketRequest
from auth.worker_auth import require_worker
from auth.admin_auth import require_admin   # adjust import if your admin auth is named differently

router = APIRouter(prefix="/tickets", tags=["Tickets"])

@router.post("")
def create_ticket(
    req: CreateTicketRequest,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    ticket_id = str(uuid.uuid4())
    ticket = Ticket(
        id=ticket_id,
        worker_id=worker["worker_id"],
        machine_id=req.machine_id,
        title=req.title,
        description=req.description,
        priority=req.priority,
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
    return [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "machine_id": t.machine_id,
            "priority": t.priority,
            "status": t.status,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
        }
        for t in tickets
    ]

@router.get("/admin")
def admin_list_tickets(
    status: str | None = None,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Ticket).order_by(Ticket.created_at.desc())
    if status:
        query = query.filter(Ticket.status == status)
    tickets = query.all()
    return [
        {
            "id": t.id,
            "worker_id": t.worker_id,
            "title": t.title,
            "description": t.description,
            "machine_id": t.machine_id,
            "priority": t.priority,
            "status": t.status,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
        }
        for t in tickets
    ]

@router.patch("/{ticket_id}")
def update_ticket_status(
    ticket_id: str,
    req: UpdateTicketRequest,
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    allowed = {"Open", "In Progress", "Resolved", "Closed"}
    if req.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status must be one of {allowed}")

    ticket.status = req.status
    ticket.updated_at = datetime.utcnow()
    db.commit()
    return {"id": ticket.id, "status": ticket.status, "message": "Status updated"}