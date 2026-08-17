"""
rag/embeddings.py

Sets up the Gemini client once and exposes:
- embed_text()              -> single embedding call, used by live /ask and
                                /add-knowledge (worker is waiting, so we don't
                                want to hang around retrying for too long)
- embed_text_with_retry()   -> same thing, but with exponential backoff +
                                jitter, used by ingest.py for bulk manual
                                ingestion where Gemini's embedding endpoint
                                is much more likely to hit transient 503s
                                under sustained back-to-back calls.
"""

import random
import time

from google import genai
from google.genai import types
from google.genai.errors import ServerError, ClientError

from config import GEMINI_API_KEY, EMBEDDING_MODEL

client = genai.Client(api_key=GEMINI_API_KEY)


def embed_text(text: str, task_type: str = "RETRIEVAL_QUERY") -> list[float]:
    """
    Turns a piece of text into a vector (list of numbers) using Gemini's
    embedding model. Use task_type="RETRIEVAL_QUERY" for questions being
    asked, and "RETRIEVAL_DOCUMENT" for knowledge being stored - Gemini
    embeds these two cases slightly differently for better search quality.

    No custom retry here on purpose - this is used in live request paths
    (a worker waiting for an answer, or a worker submitting a tip) where we
    don't want to make them wait 30+ seconds on retries. The Gemini SDK's
    own built-in retry already covers brief blips.
    """
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(task_type=task_type),
    )
    return result.embeddings[0].values


def embed_text_with_retry(
    text: str,
    task_type: str = "RETRIEVAL_DOCUMENT",
    max_attempts: int = 6,
    base_delay: float = 2.0,
    max_delay: float = 30.0,
) -> list[float]:
    """
    Same as embed_text(), but with real exponential backoff on top -
    intended for bulk ingestion (100s of sequential calls), where Gemini's
    embedding endpoint returning a transient 503 UNAVAILABLE partway
    through a large manual is common and expected, not exceptional.

    Retries on:
    - ServerError (5xx - Gemini's service is temporarily unavailable/overloaded)
    - ClientError 429 (rate limited)

    Does NOT retry on other ClientErrors (e.g. bad API key, invalid request)
    since retrying those would just waste time on something that will never
    succeed.

    Raises the last error if all attempts are exhausted, so the caller
    (ingest.py) can decide how to handle a fully-failed chunk.
    """
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            return embed_text(text, task_type=task_type)
        except ServerError as e:
            last_error = e
        except ClientError as e:
            # Only retry on rate limiting - anything else (bad request,
            # auth failure) will fail identically every time.
            if getattr(e, "code", None) != 429:
                raise
            last_error = e

        if attempt < max_attempts:
            # Exponential backoff with jitter: 2s, 4s, 8s, 16s, 30s(capped)...
            delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
            delay += random.uniform(0, 1)
            print(
                f"    Embedding attempt {attempt}/{max_attempts} failed "
                f"({last_error.__class__.__name__}), retrying in {delay:.1f}s..."
            )
            time.sleep(delay)

    # All attempts exhausted
    raise last_error