"""
auth/worker_auth.py

The require_worker dependency: runs before any worker-only endpoint.
Checks the token against worker_sessions in Postgres, confirms it hasn't
expired, and returns which worker it belongs to so the endpoint knows
exactly who is making the request.
"""

import datetime
from fastapi import HTTPException, Depends, Security
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from db import get_db
from models import Worker, WorkerSession
from auth.security import bearer_scheme


def require_worker(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
    db: Session = Depends(get_db),
) -> dict:
    token = credentials.credentials
    session = db.query(WorkerSession).filter(WorkerSession.token == token).first()

    if not session:
        raise HTTPException(status_code=401, detail="Invalid worker token. Please log in again.")

    if session.expires_at < datetime.datetime.utcnow():
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=401, detail="Your session has expired. Please log in again.")

    worker = db.query(Worker).filter(Worker.worker_id == session.worker_id).first()
    return {"worker_id": worker.worker_id, "name": worker.name}