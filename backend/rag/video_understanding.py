"""
rag/video_understanding.py

Sends a video to Gemini and gets back:
- detailed visual + audio description
- transcript
"""

import json
import time
from pathlib import Path

from google import genai
from google.genai import types

from config import GEMINI_API_KEY, LLM_MODEL

client = genai.Client(api_key=GEMINI_API_KEY)


def understand_video(video_path: str, max_retries: int = 3) -> dict:
    """
    Returns:
    {
        "video_description": "...",
        "transcript": "...",
        "key_steps": [...]
    }
    """
    video_file = Path(video_path)
    if not video_file.exists():
        return {
            "video_description": "",
            "transcript": "",
            "key_steps": []
        }

    # Upload video to Gemini
    uploaded = client.files.upload(file=str(video_file))

    prompt = """
    You are analyzing a short factory training video recorded by a worker.

    Please provide:
    1. A clear detailed description of what is being shown and done in the video.
    2. Full transcript of everything the worker said.
    3. Key steps shown in the video (as a list).

    Respond in this exact JSON format:
    {
        "video_description": "...",
        "transcript": "...",
        "key_steps": ["step 1", "step 2"]
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
                )
            )
            break  # success, stop retrying
        except Exception as e:
            last_error = e
            error_str = str(e)

            # Temporary Google-side overload - worth retrying
            if "503" in error_str or "UNAVAILABLE" in error_str:
                wait = 2 ** attempt  # 1s, 2s, 4s
                print(
                    f"Gemini overloaded (attempt {attempt + 1}/{max_retries}), "
                    f"retrying in {wait}s..."
                )
                time.sleep(wait)
                continue

            # Anything else (bad model name, auth error, bad request, etc.)
            # is not going to be fixed by retrying - fail fast instead of
            # silently looping.
            print(f"Video understanding failed (non-retryable): {error_str}")
            return {
                "video_description": "",
                "transcript": "",
                "key_steps": [],
                "error": error_str
            }

    if response is None:
        # Exhausted all retries on 503s
        error_str = str(last_error) if last_error else "Unknown error"
        print(f"Video understanding failed after {max_retries} attempts: {error_str}")
        return {
            "video_description": "",
            "transcript": "",
            "key_steps": [],
            "error": "Gemini temporarily unavailable - please try again shortly"
        }

    try:
        return json.loads(response.text)
    except Exception:
        return {
            "video_description": response.text,
            "transcript": "",
            "key_steps": []
        }