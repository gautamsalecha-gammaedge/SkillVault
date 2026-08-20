"""
routers/analytics.py

GET /admin/analytics - simple usage dashboard for admin/supervisor.
"""

from collections import Counter
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from auth.admin_auth import require_admin
from db import get_db
from models import QuestionLog, Ticket, Worker, WorkerMachine
from rag.chroma_store import collection

router = APIRouter(prefix="/admin", tags=["Analytics"])


@router.get("/analytics")
def get_analytics(authorized: bool = Depends(require_admin), db: Session = Depends(get_db)):
    # ----- Questions -----
    total_questions = db.query(func.count(QuestionLog.id)).scalar() or 0

    q_rows = (
        db.query(QuestionLog.machine_id, func.count(QuestionLog.id))
        .group_by(QuestionLog.machine_id)
        .all()
    )
    questions_by_machine = [
        {"machine_id": mid, "count": cnt}
        for mid, cnt in sorted(q_rows, key=lambda x: x[1], reverse=True)
    ]

    # ----- Workers -----
    total_workers = db.query(func.count(Worker.worker_id)).filter(Worker.is_approved == True).scalar() or 0
    pending_workers = db.query(func.count(Worker.worker_id)).filter(Worker.is_approved == False).scalar() or 0

    # ----- Tickets -----
    ticket_rows = (
        db.query(Ticket.status, func.count(Ticket.id))
        .group_by(Ticket.status)
        .all()
    )
    tickets_by_status = {status: cnt for status, cnt in ticket_rows}
    open_tickets = (tickets_by_status.get("Open", 0) + tickets_by_status.get("In Progress", 0))

    # ----- Tips from Chroma -----
    tips_pending = 0
    tips_approved = 0
    tips_by_machine = Counter()
    try:
        # Get all worker-input style entries (tips). Manuals often use source_type=manual.
        data = collection.get(include=["metadatas"])
        for meta in (data.get("metadatas") or []):
            if not meta:
                continue
            source = (meta.get("source_type") or "").lower()
            status = (meta.get("status") or "").lower()
            machine_id = meta.get("machine_id") or "unknown"
            # Count worker tips; skip pure manual chunks if tagged
            if source in ("worker_input", "worker", "tip") or (
                source not in ("manual", "pdf") and status in ("pending", "approved", "rejected")
            ):
                tips_by_machine[machine_id] += 1
                if status == "pending":
                    tips_pending += 1
                elif status == "approved":
                    tips_approved += 1
    except Exception:
        pass

    tips_by_machine_list = [
        {"machine_id": mid, "count": cnt}
        for mid, cnt in tips_by_machine.most_common()
    ]

    # ----- Machines that exist (from assignments + questions + tips) -----
    assigned = {r[0] for r in db.query(WorkerMachine.machine_id).distinct().all()}
    from_q = {r["machine_id"] for r in questions_by_machine}
    from_t = {r["machine_id"] for r in tips_by_machine_list}
    all_machines = sorted(assigned | from_q | from_t)

    return {
        "summary": {
            "total_questions": total_questions,
            "tips_pending": tips_pending,
            "tips_approved": tips_approved,
            "tips_total": tips_pending + tips_approved,
            "open_tickets": open_tickets,
            "total_workers": total_workers,
            "pending_workers": pending_workers,
            "machines_count": len(all_machines),
        },
        "questions_by_machine": questions_by_machine,
        "tips_by_machine": tips_by_machine_list,
        "tickets_by_status": {
            "Open": tickets_by_status.get("Open", 0),
            "In Progress": tickets_by_status.get("In Progress", 0),
            "Resolved": tickets_by_status.get("Resolved", 0),
            "Closed": tickets_by_status.get("Closed", 0),
        },
        "machines": all_machines,
    }