"""
Session helpers: sliding expiry, revoke on logout / password change.
Does not change how tokens are issued or how the frontend sends Bearer headers.
"""
from __future__ import annotations

import datetime
from sqlalchemy.orm import Session

from models import WorkerSession, AdminSession
from config import TOKEN_EXPIRY_HOURS


def slide_session_expiry(session_row, db: Session) -> None:
    """
    Extend session on activity so long floor tasks (interview, tips, daily update)
    do not die mid-way while the worker is still using the app.
    Only updates if remaining time is less than full window (avoid write every request
    when already fresh) — still extend when under 50% remaining.
    """
    if session_row is None:
        return
    now = datetime.datetime.utcnow()
    full = datetime.timedelta(hours=TOKEN_EXPIRY_HOURS)
    remaining = session_row.expires_at - now if session_row.expires_at else datetime.timedelta(0)
    if remaining < full * 0.5:
        session_row.expires_at = now + full
        try:
            db.commit()
        except Exception:
            db.rollback()


def revoke_worker_sessions(db: Session, worker_id: str) -> int:
    n = db.query(WorkerSession).filter(WorkerSession.worker_id == worker_id).delete()
    db.commit()
    return n


def revoke_admin_sessions(db: Session, admin_id: str) -> int:
    n = (
        db.query(AdminSession)
        .filter(AdminSession.admin_id == admin_id)
        .delete()
    )
    db.commit()
    return n


def revoke_all_sessions_for_user(db: Session, user_id: str) -> None:
    """After password change — kill worker + admin sessions for same login id."""
    db.query(WorkerSession).filter(WorkerSession.worker_id == user_id).delete()
    db.query(AdminSession).filter(AdminSession.admin_id == user_id).delete()
    db.commit()