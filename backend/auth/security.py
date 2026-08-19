"""
auth/security.py

Shared low-level auth helpers used by both worker and admin auth:
password hashing, session expiry calculation, and the Bearer token
scheme that powers the Swagger "Authorize" button.
"""

import bcrypt
import datetime
from fastapi.security import HTTPBearer

from config import TOKEN_EXPIRY_HOURS

# Shared HTTPBearer instance - this is what makes FastAPI show a padlock
# icon + Authorize button on protected endpoints in /docs.
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    """
    Turns a plain password into a secure bcrypt hash (includes salt automatically).
    Never store real passwords.
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against a stored bcrypt hash.
    Returns True if they match, False otherwise.
    """
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


def make_expiry_time() -> datetime.datetime:
    """Returns the timestamp for 'TOKEN_EXPIRY_HOURS from right now'."""
    return datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_EXPIRY_HOURS)