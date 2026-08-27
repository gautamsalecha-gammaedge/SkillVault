"""
Ensure admins table + admin_sessions.admin_id column, then seed first admin.
"""

from __future__ import annotations

import os
from sqlalchemy.orm import Session
from sqlalchemy import text

from models import Admin
from auth.security import hash_password


def ensure_admin_schema(db: Session) -> None:
    """Create admins table and add admin_sessions.admin_id if missing."""
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS admins (
                admin_id VARCHAR PRIMARY KEY,
                password_hash VARCHAR NOT NULL,
                name VARCHAR,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
            )
            """
        )
    )
    db.commit()

    row = db.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'admin_sessions'
              AND column_name = 'admin_id'
            """
        )
    ).fetchone()
    if not row:
        db.execute(text("ALTER TABLE admin_sessions ADD COLUMN admin_id VARCHAR"))
        db.commit()
        try:
            db.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_admin_sessions_admin_id ON admin_sessions (admin_id)"
                )
            )
            db.commit()
        except Exception:
            db.rollback()


def ensure_seed_admin(db: Session):
    """
    Ensure schema, then if no admin rows exist, seed from env
    ADMIN_USERNAME / ADMIN_PASSWORD (defaults: admin / admin).
    """
    ensure_admin_schema(db)

    count = db.query(Admin).count()
    if count > 0:
        return None

    username = (os.environ.get("ADMIN_USERNAME") or "admin").strip() or "admin"
    password = os.environ.get("ADMIN_PASSWORD") or "admin"
    if not password:
        password = "admin"

    admin = Admin(
        admin_id=username,
        password_hash=hash_password(password),
        name=username,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin