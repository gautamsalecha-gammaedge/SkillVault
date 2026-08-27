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

bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


def make_expiry_time() -> datetime.datetime:
    return datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_EXPIRY_HOURS)