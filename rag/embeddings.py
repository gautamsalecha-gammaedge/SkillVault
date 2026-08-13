"""
rag/embeddings.py

Sets up the Gemini client once and exposes embed_text(), used by both
the live API (embedding worker questions + knowledge) and ingest.py
(embedding manual chunks).
"""

from google import genai
from google.genai import types

from config import GEMINI_API_KEY, EMBEDDING_MODEL

client = genai.Client(api_key=GEMINI_API_KEY)


def embed_text(text: str, task_type: str = "RETRIEVAL_QUERY") -> list[float]:
    """
    Turns a piece of text into a vector (list of numbers) using Gemini's
    embedding model. Use task_type="RETRIEVAL_QUERY" for questions being
    asked, and "RETRIEVAL_DOCUMENT" for knowledge being stored - Gemini
    embeds these two cases slightly differently for better search quality.
    """
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(task_type=task_type),
    )
    return result.embeddings[0].values