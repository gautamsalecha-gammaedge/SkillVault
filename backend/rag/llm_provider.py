"""
rag/llm_provider.py

Single entry point for text generation - tries Gemini first, falls back
to Groq if Gemini fails (rate limit, timeout, outage). Used by both
/ask's answer generation and the knowledge completeness check, so a
Gemini hiccup doesn't block either flow.

Does NOT apply to embeddings (embed_text in rag/embeddings.py) - those
stay on Gemini only. Switching embedding providers mid-flight would
produce vectors from a different vector space, which would silently
break search (wrong results) rather than fail loudly - much worse than
a text-generation hiccup.
"""

import requests

from rag.embeddings import client as gemini_client
from config import LLM_MODEL, GROQ_API_KEY, GROQ_MODEL

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def _generate_with_gemini(prompt: str) -> str:
    response = gemini_client.models.generate_content(model=LLM_MODEL, contents=prompt)
    return response.text


def _generate_with_groq(prompt: str) -> str:
    response = requests.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


def generate_text(prompt: str) -> str:
    """
    Tries Gemini first. If it raises any error, falls back to Groq
    (only if GROQ_API_KEY is configured). If both fail - or Groq isn't
    configured - raises an error describing what happened.
    """
    try:
        return _generate_with_gemini(prompt)
    except Exception as gemini_error:
        if not GROQ_API_KEY:
            raise RuntimeError(f"Gemini failed and no Groq fallback is configured: {gemini_error}")
        try:
            return _generate_with_groq(prompt)
        except Exception as groq_error:
            raise RuntimeError(
                f"Both LLM providers failed. Gemini: {gemini_error}. Groq: {groq_error}"
            )