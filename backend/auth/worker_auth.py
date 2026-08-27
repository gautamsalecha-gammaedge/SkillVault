"""
require_worker: validates Bearer token against worker_sessions.
Sliding expiry keeps active floor sessions alive through long tips/interviews.
"""
from __future__ import annotations

import datetime
from fastapi import HTTPException, Depends, Security
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from db import get_db
from models import WorkerSession, Worker
from auth.security import bearer_scheme
from auth.session_util import slide_session_expiry


def require_worker(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
    db: Session = Depends(get_db),
) -> dict:
    token = credentials.credentials
    session = db.query(WorkerSession).filter(WorkerSession.token == token).first()

    if not session:
        raise HTTPException(status_code=401, detail="Invalid session. Please log in again.")

    if session.expires_at < datetime.datetime.utcnow():
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=401,
            detail="Your session expired. Log in again — unfinished tips or updates were not submitted.",
        )

    worker = db.query(Worker).filter(Worker.worker_id == session.worker_id).first()
    if not worker:
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=401, detail="Worker not found. Please log in again.")

    if not worker.is_approved:
        raise HTTPException(status_code=403, detail="Your account is still waiting for admin approval.")

    # Keep session alive while actively using the app (interview / tips / daily update)
    slide_session_expiry(session, db)

    return {
        "worker_id": worker.worker_id,
        "name": worker.name,
        "token": token,
    }