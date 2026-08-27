"""
auth/admin_auth.py

require_admin: validates Bearer token against admin_sessions and returns
the logged-in admin as a dict { admin_id, name }.
"""

import datetime
from fastapi import HTTPException, Depends, Security
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from db import get_db
from models import AdminSession, Admin
from auth.security import bearer_scheme


def require_admin(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
    db: Session = Depends(get_db),
) -> dict:
    token = credentials.credentials
    session = db.query(AdminSession).filter(AdminSession.token == token).first()

    if not session:
        raise HTTPException(status_code=401, detail="Invalid admin token. Please log in again.")

    if session.expires_at < datetime.datetime.utcnow():
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=401, detail="Your admin session has expired. Please log in again.")

    admin_id = getattr(session, "admin_id", None)
    if not admin_id:
        # Old sessions created before DB-backed admins — force re-login
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=401,
            detail="Please log in again to continue.",
        )

    admin = db.query(Admin).filter(Admin.admin_id == admin_id).first()
    if not admin or not admin.is_active:
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=401, detail="Admin account not found or disabled. Please log in again.")

    return {
        "admin_id": admin.admin_id,
        "name": admin.name,
    }