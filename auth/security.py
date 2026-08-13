"""
auth/security.py

Shared low-level auth helpers used by both worker and admin auth:
password hashing, session expiry calculation, and the Bearer token
scheme that powers the Swagger "Authorize" button.
"""

import hashlib
import datetime
from fastapi.security import HTTPBearer

from config import TOKEN_EXPIRY_HOURS

# Shared HTTPBearer instance - this is what makes FastAPI show a padlock
# icon + Authorize button on protected endpoints in /docs.
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    """Turns a plain password into a scrambled, unreadable string, so we never store real passwords."""
    return hashlib.sha256(password.encode()).hexdigest()


def make_expiry_time() -> datetime.datetime:
    """Returns the timestamp for 'TOKEN_EXPIRY_HOURS from right now' - used when creating a new session."""
    return datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_EXPIRY_HOURS)