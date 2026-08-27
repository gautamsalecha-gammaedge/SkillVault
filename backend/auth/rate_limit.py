"""
Simple in-memory rate limiter for login / OTP endpoints.
Resets on process restart (fine for single-process uvicorn; use Redis later for multi-worker).
"""
from __future__ import annotations

import time
import threading
from fastapi import HTTPException

_lock = threading.Lock()
# key -> list of monotonic timestamps
_hits: dict[str, list[float]] = {}


def check_rate_limit(
    key: str,
    *,
    max_hits: int = 8,
    window_seconds: int = 300,
    detail: str = "Too many attempts. Wait a few minutes and try again.",
) -> None:
    """Raise 429 if key exceeded max_hits within window_seconds."""
    now = time.monotonic()
    with _lock:
        arr = [t for t in _hits.get(key, []) if now - t < window_seconds]
        if len(arr) >= max_hits:
            _hits[key] = arr
            raise HTTPException(status_code=429, detail=detail)
        arr.append(now)
        _hits[key] = arr
        # opportunistic cleanup
        if len(_hits) > 5000:
            stale = [k for k, v in _hits.items() if not v or now - v[-1] > window_seconds]
            for k in stale[:500]:
                _hits.pop(k, None)


def clear_rate_limit(key: str) -> None:
    with _lock:
        _hits.pop(key, None)