"""
routers/safety.py

Machine Safety Measures — structured, ordered safety instructions per machine.
Workers read/listen through them before starting work; admins manage the content.

Worker:
  GET  /safety/{machine_id}              - ordered active measures + completion status
  POST /safety/{machine_id}/complete     - mark briefing completed
  GET  /safety/{machine_id}/status       - completed? + timestamp

Admin:
  GET    /admin/safety/{machine_id}              - all measures (incl. inactive)
  POST   /admin/safety                           - create measure
  PUT    /admin/safety/{id}                      - update measure
  DELETE /admin/safety/{id}                      - soft-delete (is_active=False)
  POST   /admin/safety/reorder                   - bulk update sort_order
  GET    /admin/safety/{machine_id}/completions  - who completed the briefing
"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models import SafetyMeasure, SafetyCompletion, Worker, WorkerMachine
from schemas import (
    CreateSafetyMeasureRequest,
    UpdateSafetyMeasureRequest,
    ReorderSafetyMeasuresRequest,
    CompleteSafetyRequest,
)
from auth.worker_auth import require_worker
from auth.admin_auth import require_admin

router = APIRouter(prefix="/safety", tags=["Safety"])
admin_router = APIRouter(prefix="/admin/safety", tags=["Safety Admin"])


def _require_assigned(worker: dict, machine_id: str, db: Session) -> None:
    """Workers may only access safety for machines they are assigned to."""
    assigned = (
        db.query(WorkerMachine)
        .filter(
            WorkerMachine.worker_id == worker["worker_id"],
            WorkerMachine.machine_id == machine_id,
        )
        .first()
    )
    if not assigned:
        raise HTTPException(
            status_code=403,
            detail="You aren't assigned to this machine.",
        )


def _measure_dict(m: SafetyMeasure) -> dict:
    return {
        "id": m.id,
        "machine_id": m.machine_id,
        "title": m.title,
        "content": m.content,
        "sort_order": m.sort_order,
        "is_active": m.is_active,
        "language_code": m.language_code,
        "created_at": m.created_at,
        "updated_at": m.updated_at,
    }


# ---------- Worker endpoints ----------

@router.get("/my-status")
def my_safety_status(
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """
    One-call dashboard feed: for every machine this worker is assigned,
    how many active safety measures exist and whether the briefing has
    been completed. Powers the Safety hub screen without an N+1 fetch
    per machine. Must be declared before GET /{machine_id} so it isn't
    swallowed by that path parameter.
    """
    assignments = (
        db.query(WorkerMachine)
        .filter(WorkerMachine.worker_id == worker["worker_id"])
        .all()
    )
    machine_ids = [a.machine_id for a in assignments]

    if not machine_ids:
        return {"machines": []}

    measure_counts: dict[str, int] = {}
    for row in (
        db.query(SafetyMeasure.machine_id, SafetyMeasure.id)
        .filter(
            SafetyMeasure.machine_id.in_(machine_ids),
            SafetyMeasure.is_active == True,
        )
        .all()
    ):
        measure_counts[row[0]] = measure_counts.get(row[0], 0) + 1

    completions = {
        c.machine_id: c
        for c in (
            db.query(SafetyCompletion)
            .filter(
                SafetyCompletion.worker_id == worker["worker_id"],
                SafetyCompletion.machine_id.in_(machine_ids),
            )
            .all()
        )
    }

    results = []
    for mid in machine_ids:
        completion = completions.get(mid)
        results.append({
            "machine_id": mid,
            "measure_count": measure_counts.get(mid, 0),
            "completed": completion is not None,
            "completed_at": completion.completed_at if completion else None,
        })

    return {"machines": results}


@router.get("/{machine_id}")
def get_safety_measures(
    machine_id: str,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """
    Returns ordered active safety measures for a machine, plus whether
    this worker has already completed the briefing.
    """
    _require_assigned(worker, machine_id, db)

    measures = (
        db.query(SafetyMeasure)
        .filter(
            SafetyMeasure.machine_id == machine_id,
            SafetyMeasure.is_active == True,
        )
        .order_by(SafetyMeasure.sort_order.asc(), SafetyMeasure.created_at.asc())
        .all()
    )

    completion = (
        db.query(SafetyCompletion)
        .filter(
            SafetyCompletion.worker_id == worker["worker_id"],
            SafetyCompletion.machine_id == machine_id,
        )
        .first()
    )

    return {
        "machine_id": machine_id,
        "measures": [_measure_dict(m) for m in measures],
        "completed": completion is not None,
        "completed_at": completion.completed_at if completion else None,
    }


@router.get("/{machine_id}/status")
def get_safety_status(
    machine_id: str,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """Lightweight check: has this worker completed safety for this machine?"""
    _require_assigned(worker, machine_id, db)

    completion = (
        db.query(SafetyCompletion)
        .filter(
            SafetyCompletion.worker_id == worker["worker_id"],
            SafetyCompletion.machine_id == machine_id,
        )
        .first()
    )
    return {
        "machine_id": machine_id,
        "completed": completion is not None,
        "completed_at": completion.completed_at if completion else None,
    }


@router.post("/{machine_id}/complete")
def complete_safety(
    machine_id: str,
    req: CompleteSafetyRequest,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """
    Marks the full safety briefing as completed for this worker + machine.
    Re-completing (refresh training) updates the timestamp.
    """
    _require_assigned(worker, machine_id, db)

    # Ensure there is at least one active measure (optional guard)
    count = (
        db.query(SafetyMeasure)
        .filter(
            SafetyMeasure.machine_id == machine_id,
            SafetyMeasure.is_active == True,
        )
        .count()
    )
    if count == 0:
        raise HTTPException(
            status_code=400,
            detail="No active safety measures exist for this machine yet.",
        )

    existing = (
        db.query(SafetyCompletion)
        .filter(
            SafetyCompletion.worker_id == worker["worker_id"],
            SafetyCompletion.machine_id == machine_id,
        )
        .first()
    )

    now = datetime.utcnow()
    if existing:
        existing.completed_at = now
        existing.language_code = req.language_code or existing.language_code
        db.commit()
        return {
            "status": "updated",
            "machine_id": machine_id,
            "completed_at": existing.completed_at,
            "message": "Safety briefing re-completed.",
        }

    row = SafetyCompletion(
        id=str(uuid.uuid4()),
        worker_id=worker["worker_id"],
        machine_id=machine_id,
        language_code=req.language_code or "en-IN",
        completed_at=now,
    )
    db.add(row)
    db.commit()
    return {
        "status": "completed",
        "machine_id": machine_id,
        "completed_at": row.completed_at,
        "message": "Safety briefing marked complete.",
    }


# ---------- Admin endpoints ----------

@admin_router.get("/{machine_id}")
def admin_list_measures(
    machine_id: str,
    include_inactive: bool = True,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """All safety measures for a machine (active + inactive by default)."""
    query = db.query(SafetyMeasure).filter(SafetyMeasure.machine_id == machine_id)
    if not include_inactive:
        query = query.filter(SafetyMeasure.is_active == True)
    measures = query.order_by(
        SafetyMeasure.sort_order.asc(), SafetyMeasure.created_at.asc()
    ).all()
    return {
        "machine_id": machine_id,
        "measures": [_measure_dict(m) for m in measures],
    }


@admin_router.post("")
def admin_create_measure(
    req: CreateSafetyMeasureRequest,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not req.title.strip() or not req.content.strip():
        raise HTTPException(status_code=400, detail="Title and content are required.")

    measure = SafetyMeasure(
        id=str(uuid.uuid4()),
        machine_id=req.machine_id.strip(),
        title=req.title.strip(),
        content=req.content.strip(),
        sort_order=req.sort_order,
        is_active=req.is_active,
        language_code=req.language_code or "en-IN",
    )
    db.add(measure)
    db.commit()
    db.refresh(measure)
    return {"status": "created", "measure": _measure_dict(measure)}


@admin_router.put("/{measure_id}")
def admin_update_measure(
    measure_id: str,
    req: UpdateSafetyMeasureRequest,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    measure = db.query(SafetyMeasure).filter(SafetyMeasure.id == measure_id).first()
    if not measure:
        raise HTTPException(status_code=404, detail="Safety measure not found.")

    if req.title is not None:
        if not req.title.strip():
            raise HTTPException(status_code=400, detail="Title cannot be empty.")
        measure.title = req.title.strip()
    if req.content is not None:
        if not req.content.strip():
            raise HTTPException(status_code=400, detail="Content cannot be empty.")
        measure.content = req.content.strip()
    if req.sort_order is not None:
        measure.sort_order = req.sort_order
    if req.language_code is not None:
        measure.language_code = req.language_code
    if req.is_active is not None:
        measure.is_active = req.is_active

    measure.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(measure)
    return {"status": "updated", "measure": _measure_dict(measure)}


@admin_router.delete("/{measure_id}")
def admin_delete_measure(
    measure_id: str,
    hard: bool = False,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Soft-delete by default (is_active=False).
    Pass hard=true to permanently remove the row.
    """
    measure = db.query(SafetyMeasure).filter(SafetyMeasure.id == measure_id).first()
    if not measure:
        raise HTTPException(status_code=404, detail="Safety measure not found.")

    if hard:
        db.delete(measure)
        db.commit()
        return {"status": "deleted", "id": measure_id, "hard": True}

    measure.is_active = False
    measure.updated_at = datetime.utcnow()
    db.commit()
    return {"status": "deactivated", "id": measure_id, "hard": False}


@admin_router.post("/reorder")
def admin_reorder_measures(
    req: ReorderSafetyMeasuresRequest,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Bulk update sort_order. Send [{id, sort_order}, ...]."""
    if not req.items:
        raise HTTPException(status_code=400, detail="No items provided.")

    updated = 0
    for item in req.items:
        measure = db.query(SafetyMeasure).filter(SafetyMeasure.id == item.id).first()
        if measure:
            measure.sort_order = item.sort_order
            measure.updated_at = datetime.utcnow()
            updated += 1

    db.commit()
    return {"status": "reordered", "updated": updated}


@admin_router.get("/{machine_id}/completions")
def admin_list_completions(
    machine_id: str,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Which workers have completed the safety briefing for this machine."""
    rows = (
        db.query(SafetyCompletion, Worker)
        .join(Worker, Worker.worker_id == SafetyCompletion.worker_id)
        .filter(SafetyCompletion.machine_id == machine_id)
        .order_by(SafetyCompletion.completed_at.desc())
        .all()
    )
    return {
        "machine_id": machine_id,
        "completions": [
            {
                "worker_id": c.worker_id,
                "worker_name": w.name,
                "language_code": c.language_code,
                "completed_at": c.completed_at,
            }
            for c, w in rows
        ],
    }