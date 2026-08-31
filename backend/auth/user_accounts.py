"""
Real-world identity: one user, one or more roles (worker | supervisor).

- users: login identity + password hash
- user_roles: which apps they may open
- workers / admins rows remain for floor FKs and backward compatibility;
  credentials are synced to users.
"""

from __future__ import annotations

import os
from sqlalchemy.orm import Session
from sqlalchemy import text

from models import User, UserRole, Worker, Admin
from auth.security import hash_password, verify_password

ROLE_WORKER = "worker"
ROLE_SUPERVISOR = "supervisor"
ROLE_OWNER = "owner"  # plant owner — only they can Create supervisor


def ensure_users_schema(db: Session) -> None:
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id VARCHAR PRIMARY KEY,
                password_hash VARCHAR NOT NULL,
                name VARCHAR,
                email VARCHAR,
                email_verified BOOLEAN NOT NULL DEFAULT FALSE,
                phone_country_code VARCHAR,
                phone_number VARCHAR,
                address TEXT,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS user_roles (
                user_id VARCHAR NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                role VARCHAR NOT NULL,
                PRIMARY KEY (user_id, role)
            )
            """
        )
    )
    db.commit()


def _roles_of(db: Session, user_id: str) -> list[str]:
    rows = db.query(UserRole).filter(UserRole.user_id == user_id).all()
    return [r.role for r in rows]


def ensure_role(db: Session, user_id: str, role: str) -> None:
    exists = (
        db.query(UserRole)
        .filter(UserRole.user_id == user_id, UserRole.role == role)
        .first()
    )
    if not exists:
        db.add(UserRole(user_id=user_id, role=role))
        db.commit()


def upsert_user_from_worker(db: Session, w: Worker) -> User:
    ensure_users_schema(db)
    u = db.query(User).filter(User.user_id == w.worker_id).first()
    if not u:
        u = User(
            user_id=w.worker_id,
            password_hash=w.password_hash,
            name=w.name,
            email=getattr(w, "email", None),
            email_verified=bool(getattr(w, "email_verified", False)),
            phone_country_code=getattr(w, "phone_country_code", None),
            phone_number=getattr(w, "phone_number", None),
            address=getattr(w, "address", None),
            is_active=True,
        )
        db.add(u)
        db.commit()
    else:
        u.password_hash = w.password_hash
        u.name = w.name or u.name
        if getattr(w, "email", None) is not None:
            u.email = w.email
        u.email_verified = bool(getattr(w, "email_verified", False))
        db.commit()
        # Do NOT re-add ROLE_WORKER — owner may have removed floor access
        return u
    ensure_role(db, w.worker_id, ROLE_WORKER)
    return u


def upsert_user_from_admin(db: Session, a: Admin) -> User:
    ensure_users_schema(db)
    u = db.query(User).filter(User.user_id == a.admin_id).first()
    if not u:
        u = User(
            user_id=a.admin_id,
            password_hash=a.password_hash,
            name=a.name or a.admin_id,
            is_active=bool(a.is_active),
        )
        db.add(u)
        db.commit()
    else:
        u.password_hash = a.password_hash
        u.name = a.name or u.name
        u.is_active = bool(a.is_active)
        db.commit()
        # Do NOT re-add ROLE_SUPERVISOR on every migrate — owner may have revoked it
        return u
    if a.is_active:
        ensure_role(db, a.admin_id, ROLE_SUPERVISOR)
    return u


def migrate_all_identities(db: Session) -> None:
    """One-shot style sync: copy existing workers + admins into users/roles."""
    ensure_users_schema(db)
    for w in db.query(Worker).all():
        upsert_user_from_worker(db, w)
    for a in db.query(Admin).all():
        upsert_user_from_admin(db, a)


def set_password_for_user(db: Session, user_id: str, plain: str) -> None:
    """Update users + mirror to workers/admins rows if present. Revokes all sessions."""
    h = hash_password(plain)
    u = db.query(User).filter(User.user_id == user_id).first()
    if u:
        u.password_hash = h
    w = db.query(Worker).filter(Worker.worker_id == user_id).first()
    if w:
        w.password_hash = h
    a = db.query(Admin).filter(Admin.admin_id == user_id).first()
    if a:
        a.password_hash = h
    db.commit()
    try:
        from auth.session_util import revoke_all_sessions_for_user
        revoke_all_sessions_for_user(db, user_id)
    except Exception:
        pass


def authenticate(db: Session, user_id: str, password: str) -> tuple[User, list[str]] | None:
    """
    Verify password against users (preferred). If user row missing, try
    legacy worker/admin row and auto-upsert into users.
    """
    ensure_users_schema(db)
    # Do not call migrate_all_identities() here — it used to re-grant roles
    # and undid owner checkbox changes on every login.

    uid = (user_id or "").strip()
    if not uid:
        return None

    u = db.query(User).filter(User.user_id == uid).first()
    if not u:
        w = db.query(Worker).filter(Worker.worker_id == uid).first()
        if w and verify_password(password, w.password_hash):
            u = upsert_user_from_worker(db, w)
            return u, _roles_of(db, uid)
        a = db.query(Admin).filter(Admin.admin_id == uid).first()
        if a and a.is_active and verify_password(password, a.password_hash):
            u = upsert_user_from_admin(db, a)
            return u, _roles_of(db, uid)
        return None

    if not u.is_active:
        return None
    if not verify_password(password, u.password_hash):
        return None
    return u, _roles_of(db, uid)


def promote_worker_to_supervisor(db: Session, worker_id: str) -> dict:
    """Add supervisor role; ensure Admin row exists for legacy admin_sessions."""
    w = db.query(Worker).filter(Worker.worker_id == worker_id).first()
    if not w:
        raise ValueError("Worker not found.")
    u = upsert_user_from_worker(db, w)
    ensure_role(db, worker_id, ROLE_SUPERVISOR)

    a = db.query(Admin).filter(Admin.admin_id == worker_id).first()
    if not a:
        a = Admin(
            admin_id=worker_id,
            password_hash=w.password_hash,
            name=w.name,
            is_active=True,
        )
        db.add(a)
        db.commit()
    else:
        a.password_hash = w.password_hash
        a.name = w.name or a.name
        a.is_active = True
        db.commit()

    return {
        "user_id": worker_id,
        "name": u.name,
        "roles": _roles_of(db, worker_id),
        "message": "Worker can now sign in as supervisor with the same ID and password.",
    }


def create_supervisor(
    db: Session,
    *,
    username: str,
    password: str,
    name: str | None = None,
) -> dict:
    """Create a supervisor-only account (no worker role unless they register separately)."""
    ensure_users_schema(db)
    username = (username or "").strip()
    if not username:
        raise ValueError("Username is required.")
    if len(password or "") < 6:
        raise ValueError("Password must be at least 6 characters.")

    if db.query(User).filter(User.user_id == username).first():
        raise ValueError("That username is already taken.")
    if db.query(Worker).filter(Worker.worker_id == username).first():
        raise ValueError("That ID is already a worker. Use Promote instead.")
    if db.query(Admin).filter(Admin.admin_id == username).first():
        raise ValueError("That supervisor already exists.")

    h = hash_password(password)
    display = (name or username).strip() or username
    u = User(user_id=username, password_hash=h, name=display, is_active=True)
    db.add(u)
    db.commit()
    ensure_role(db, username, ROLE_SUPERVISOR)

    a = Admin(admin_id=username, password_hash=h, name=display, is_active=True)
    db.add(a)
    db.commit()

    return {
        "user_id": username,
        "name": display,
        "roles": _roles_of(db, username),
        "message": "Supervisor created. They sign in on the Admin tab with this username.",
    }


def user_is_owner(db: Session, user_id: str) -> bool:
    ensure_users_schema(db)
    return ROLE_OWNER in _roles_of(db, user_id)


def ensure_at_least_one_owner(db: Session) -> None:
    """If supervisors exist but no owner, promote the first supervisor (or env admin) to owner."""
    ensure_users_schema(db)
    if db.query(UserRole).filter(UserRole.role == ROLE_OWNER).first():
        return
    # Prefer classic admin id
    for candidate in (
        (os.environ.get("ADMIN_USERNAME") or "admin").strip() or "admin",
    ):
        u = db.query(User).filter(User.user_id == candidate).first()
        if u and ROLE_SUPERVISOR in _roles_of(db, candidate):
            ensure_role(db, candidate, ROLE_OWNER)
            return
    row = db.query(UserRole).filter(UserRole.role == ROLE_SUPERVISOR).first()
    if row:
        ensure_role(db, row.user_id, ROLE_OWNER)


def seed_first_supervisor_if_empty(db: Session) -> None:
    """If no supervisor role exists, seed from env or admin/admin123."""
    ensure_users_schema(db)
    migrate_all_identities(db)
    any_sup = (
        db.query(UserRole).filter(UserRole.role == ROLE_SUPERVISOR).first()
    )
    if any_sup:
        return
    username = (os.environ.get("ADMIN_USERNAME") or "admin").strip() or "admin"
    password = os.environ.get("ADMIN_PASSWORD") or "admin123"
    if len(password) < 6:
        # Guard against a too-short env password silently breaking the seed.
        password = "admin123"
    try:
        create_supervisor(db, username=username, password=password, name=username)
    except ValueError:
        pass
    # First account is plant owner — only safe to grant the role if the user
    # row actually exists (create_supervisor may have failed above for a
    # reason unrelated to "already exists", e.g. a bad password).
    if db.query(User).filter(User.user_id == username).first():
        ensure_role(db, username, ROLE_OWNER)
    ensure_at_least_one_owner(db)


def set_user_roles(
    db: Session,
    user_id: str,
    *,
    as_worker: bool,
    as_supervisor: bool,
) -> dict:
    """Owner sets floor/supervisor flags. At least one role required."""
    ensure_users_schema(db)
    user_id = (user_id or "").strip()
    if not user_id:
        raise ValueError("User id is required.")
    if not as_worker and not as_supervisor:
        raise ValueError("Keep at least one role: Floor worker or Supervisor.")

    w = db.query(Worker).filter(Worker.worker_id == user_id).first()
    u = db.query(User).filter(User.user_id == user_id).first()
    if not u and not w:
        raise ValueError("Worker not found.")

    if w and not u:
        u = upsert_user_from_worker(db, w)
    if not u:
        raise ValueError("User not found.")

    # Worker role
    if as_worker:
        ensure_role(db, user_id, ROLE_WORKER)
        if not w:
            # supervisor-only account gaining floor access needs a worker row
            w = Worker(
                worker_id=user_id,
                password_hash=u.password_hash,
                name=u.name or user_id,
                is_approved=True,
            )
            db.add(w)
            db.commit()
    else:
        # remove worker role only (keep worker row for history / FKs)
        db.query(UserRole).filter(
            UserRole.user_id == user_id, UserRole.role == ROLE_WORKER
        ).delete()
        db.commit()

    # Supervisor role
    if as_supervisor:
        ensure_role(db, user_id, ROLE_SUPERVISOR)
        a = db.query(Admin).filter(Admin.admin_id == user_id).first()
        if not a:
            a = Admin(
                admin_id=user_id,
                password_hash=u.password_hash,
                name=u.name or user_id,
                is_active=True,
            )
            db.add(a)
            db.commit()
        else:
            a.is_active = True
            a.password_hash = u.password_hash
            db.commit()
    else:
        # do not strip owner role's ability carelessly — still allow removing supervisor
        # but keep owner role if present
        db.query(UserRole).filter(
            UserRole.user_id == user_id, UserRole.role == ROLE_SUPERVISOR
        ).delete()
        db.commit()
        a = db.query(Admin).filter(Admin.admin_id == user_id).first()
        if a and ROLE_OWNER not in _roles_of(db, user_id):
            a.is_active = False
            db.commit()

    roles = _roles_of(db, user_id)
    return {
        "user_id": user_id,
        "roles": roles,
        "is_worker": ROLE_WORKER in roles,
        "is_supervisor": ROLE_SUPERVISOR in roles,
        "is_owner": ROLE_OWNER in roles,
        "message": "Roles updated.",
    }