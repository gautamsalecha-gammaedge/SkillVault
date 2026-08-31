"""
rag/embeddings.py

Sets up the Gemini client once and exposes:
- embed_text()              -> single embedding call (+ small in-process cache)
- embed_text_with_retry()   -> bulk ingest with exponential backoff

Embeddings stay on Gemini only. Do not swap providers without re-ingesting
the whole Chroma collection (different vector spaces).
"""

from __future__ import annotations

import hashlib
import random
import threading
import time
from collections import OrderedDict

from google import genai
from google.genai import types
from google.genai.errors import ServerError, ClientError

from config import GEMINI_API_KEY, EMBEDDING_MODEL

client = genai.Client(api_key=GEMINI_API_KEY)

# Small LRU cache for repeated / near-identical Ask queries in one process.
_CACHE_MAX = 256
_cache: OrderedDict[str, list[float]] = OrderedDict()
_cache_lock = threading.Lock()


def _cache_key(text: str, task_type: str) -> str:
    h = hashlib.sha256(f"{task_type}\n{text}".encode("utf-8")).hexdigest()
    return h


def embed_text(text: str, task_type: str = "RETRIEVAL_QUERY") -> list[float]:
    """
    Turns text into a vector using Gemini embeddings.
    task_type="RETRIEVAL_QUERY" for questions, "RETRIEVAL_DOCUMENT" for stored knowledge.
    Identical text+task_type within this process hits a small LRU cache.
    """
    key = _cache_key(text or "", task_type)
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return list(_cache[key])

    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(task_type=task_type),
    )
    values = result.embeddings[0].values

    with _cache_lock:
        _cache[key] = values
        _cache.move_to_end(key)
        while len(_cache) > _CACHE_MAX:
            _cache.popitem(last=False)

    return list(values)


def embed_text_with_retry(
    text: str,
    task_type: str = "RETRIEVAL_DOCUMENT",
    max_attempts: int = 6,
    base_delay: float = 2.0,
    max_delay: float = 30.0,
) -> list[float]:
    """Bulk ingest embedding with backoff on 5xx / 429."""
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            return embed_text(text, task_type=task_type)
        except ServerError as e:
            last_error = e
        except ClientError as e:
            if getattr(e, "code", None) != 429:
                raise
            last_error = e

        if attempt < max_attempts:
            delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
            delay += random.uniform(0, 1)
            print(
                f"    Embedding attempt {attempt}/{max_attempts} failed "
                f"({last_error.__class__.__name__}), retrying in {delay:.1f}s..."
            )
            time.sleep(delay)

    raise last_error


def warmup_embeddings() -> None:
    """Tiny embed on startup to warm the Gemini client / connection."""
    try:
        embed_text("skillvault warmup", task_type="RETRIEVAL_QUERY")
        print("[embed] embedding warmup complete")
    except Exception as e:
        print(f"[embed] embedding warmup skipped: {e}")