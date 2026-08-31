"""
rag/llm_provider.py

Text generation entry point for Ask, tip review, interview, daily polish.

  PRIMARY  = Groq  (fast)
  FALLBACK = Gemini (LLM_MODEL from config)

Embeddings stay in rag/embeddings.py (Gemini only).
Image/video stay in image_understanding.py / video_understanding.py (Gemini LLM_MODEL).
"""

import requests

from rag.embeddings import client as gemini_client
from config import LLM_MODEL, GROQ_API_KEY, GROQ_MODEL

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def _generate_with_gemini(prompt: str) -> str:
    response = gemini_client.models.generate_content(model=LLM_MODEL, contents=prompt)
    return response.text


def _generate_with_groq(prompt: str) -> str:
    if not (GROQ_API_KEY or "").strip():
        raise RuntimeError("GROQ_API_KEY is not set in .env")
    response = requests.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY.strip()}",
            "Content-Type": "application/json",
        },
        json={
            "model": GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
        },
        timeout=45,
    )
    if not response.ok:
        raise RuntimeError(
            f"Groq HTTP {response.status_code} model={GROQ_MODEL!r}: {response.text[:400]}"
        )
    data = response.json()
    return data["choices"][0]["message"]["content"]


def generate_text(prompt: str) -> str:
    """Groq first; Gemini fallback if Groq fails or key missing."""
    groq_error = None
    if (GROQ_API_KEY or "").strip():
        try:
            return _generate_with_groq(prompt)
        except Exception as e:
            groq_error = e
            print(f"[llm] Groq failed, falling back to Gemini: {e}")
    try:
        return _generate_with_gemini(prompt)
    except Exception as gemini_error:
        if groq_error is not None:
            raise RuntimeError(
                f"Both LLM providers failed. Groq: {groq_error}. Gemini: {gemini_error}"
            )
        raise RuntimeError(f"Gemini failed and Groq is not configured: {gemini_error}")