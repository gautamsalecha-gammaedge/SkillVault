"""
rag/image_understanding.py

Sends a still image to Gemini and gets back a detailed description of what
is shown — same role as rag/video_understanding.py for tip videos.

Used when:
- a worker attaches a photo to a tip (stored for admin review + retrieval)
- a worker attaches a photo to an Ask question (enriches the query)
"""

import json
import time
from pathlib import Path

from google import genai
from google.genai import types

from config import GEMINI_API_KEY, LLM_MODEL

client = genai.Client(api_key=GEMINI_API_KEY)


def understand_image(image_path: str, max_retries: int = 3) -> dict:
    """
    Returns:
    {
        "image_description": "...",
        "visible_text": "...",   # any labels / gauges / error codes readable
        "key_details": [...]
    }
    """
    image_file = Path(image_path)
    if not image_file.exists():
        return {
            "image_description": "",
            "visible_text": "",
            "key_details": [],
        }

    uploaded = client.files.upload(file=str(image_file))

    prompt = """
    You are analyzing a photo taken by a factory worker on the shop floor
    (machine, part, control panel, wear, leak, damage, gauge, error screen, etc.).

    Please provide:
    1. A clear detailed description of what is visible in the image — materials,
       components, condition, orientation, and anything a supervisor would need
       to understand the situation without seeing the photo.
    2. Any readable text, numbers, error codes, labels, or gauge readings.
    3. Key details as a short list (symptoms, parts, severity cues).

    Respond in this exact JSON format:
    {
        "image_description": "...",
        "visible_text": "...",
        "key_details": ["detail 1", "detail 2"]
    }
    """

    response = None
    last_error = None

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=LLM_MODEL,
                contents=[uploaded, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                ),
            )
            break
        except Exception as e:
            last_error = e
            error_str = str(e)
            if "503" in error_str or "UNAVAILABLE" in error_str:
                wait = 2 ** attempt
                print(
                    f"Gemini overloaded on image (attempt {attempt + 1}/{max_retries}), "
                    f"retrying in {wait}s..."
                )
                time.sleep(wait)
                continue
            raise

    if response is None:
        raise RuntimeError(f"Image understanding failed after retries: {last_error}")

    try:
        data = json.loads(response.text or "{}")
    except json.JSONDecodeError:
        data = {
            "image_description": (response.text or "").strip(),
            "visible_text": "",
            "key_details": [],
        }

    return {
        "image_description": data.get("image_description") or "",
        "visible_text": data.get("visible_text") or "",
        "key_details": data.get("key_details") or [],
    }