"""
auth/admin_auth.py

The require_admin dependency: runs before any admin-only endpoint.
Checks the token against admin_sessions in Postgres and confirms it
hasn't expired. Cleans up (deletes) the session row if it's found expired.
"""

import datetime
from fastapi import HTTPException, Depends, Security
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from db import get_db
from models import AdminSession
from auth.security import bearer_scheme


def require_admin(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
    db: Session = Depends(get_db),
) -> bool:
    token = credentials.credentials
    session = db.query(AdminSession).filter(AdminSession.token == token).first()

    if not session:
        raise HTTPException(status_code=401, detail="Invalid admin token. Please log in again.")

    if session.expires_at < datetime.datetime.utcnow():
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=401, detail="Your admin session has expired. Please log in again.")

    return True