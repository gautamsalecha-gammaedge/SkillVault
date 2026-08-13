"""
routers/voice.py

POST /speak - converts text into properly Indian-accented speech via
Sarvam AI. Called by the frontend after an /ask or /add-knowledge
response comes back, when the worker taps "Speak answer".

No auth required - same reasoning as /ask (any worker can use it),
and it doesn't touch any stored data.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from voice.tts import text_to_speech

router = APIRouter()


class SpeakRequest(BaseModel):
    text: str
    language_code: str = "en-IN"
    speaker: str | None = None


@router.post("/speak")
def speak(req: SpeakRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="No text provided to speak.")

    try:
        audio_bytes = text_to_speech(req.text, req.language_code, req.speaker)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Text-to-speech failed: {str(e)}")

    return Response(content=audio_bytes, media_type="audio/wav")