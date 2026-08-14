"""
voice/cache.py

A simple in-memory cache for generated speech audio. If the same text
gets spoken again (worker taps "Speak answer" twice, or two workers
trigger the same answer) within AUDIO_CACHE_TTL_HOURS, we reuse the
cached audio instead of paying Sarvam again for identical output.

After the TTL expires, the entry is treated as stale and regenerated on
the next request - this protects against serving outdated audio forever
if the underlying answer text ever changes (e.g. a manual gets re-approved
with corrected info).

This is intentionally simple - an in-memory dict, not Redis. That means:
  - It resets whenever the server restarts (fine - worst case, one extra
    paid call after a restart, not a correctness problem).
  - It's per-process. Multiple server instances would each have their own
    cache - still saves cost, just not perfectly deduplicated across
    instances. A shared cache (Redis) would be the production-grade
    version of this.
  - Expired entries are only cleaned up lazily (checked when looked up),
    not swept in the background. Fine at this scale; a production version
    might run a periodic cleanup job to keep memory from growing with a
    lot of never-requested-again stale entries.
"""

import hashlib
import time

from config import AUDIO_CACHE_TTL_HOURS

TTL_SECONDS = AUDIO_CACHE_TTL_HOURS * 3600

# Each entry: key -> (audio_bytes, cached_at_timestamp)
_audio_cache: dict[str, tuple[bytes, float]] = {}


def _cache_key(text: str, language_code: str, speaker: str) -> str:
    """
    Builds a short, fixed-length cache key from the request's actual
    content, so we don't store raw (potentially long) text as the key.
    """
    raw = f"{language_code}|{speaker}|{text}"
    return hashlib.sha256(raw.encode()).hexdigest()


def get_cached_audio(text: str, language_code: str, speaker: str) -> bytes | None:
    key = _cache_key(text, language_code, speaker)
    entry = _audio_cache.get(key)
    if entry is None:
        return None

    audio_bytes, cached_at = entry
    age_seconds = time.time() - cached_at

    if age_seconds > TTL_SECONDS:
        # Stale - drop it so it doesn't linger in memory, and treat as a miss.
        del _audio_cache[key]
        return None

    return audio_bytes


def store_audio(text: str, language_code: str, speaker: str, audio_bytes: bytes) -> None:
    key = _cache_key(text, language_code, speaker)
    _audio_cache[key] = (audio_bytes, time.time())


def cache_size() -> int:
    """Returns how many distinct audio clips are currently cached (including any not-yet-expired) - useful for a quick sanity check."""
    return len(_audio_cache)