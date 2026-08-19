"""
routers/voice.py

POST /speak - converts text into properly Indian-accented speech via
Sarvam AI. Called by the frontend after an /ask or /add-knowledge
response comes back, when the worker taps "Speak answer".

POST /transcribe - worker records audio, this transcribes it via Sarvam
STT and auto-detects the spoken language in the same call. Returns
{ transcript, language_code }.

No auth required on either route - same reasoning as /ask (any worker
can use it), and neither touches stored data directly.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel

from voice.tts import text_to_speech
from voice.cache import get_cached_audio, store_audio
from voice.stt import transcribe_audio, TranscriptionError
from config import SARVAM_TTS_DEFAULT_SPEAKER

router = APIRouter()


class SpeakRequest(BaseModel):
    text: str
    language_code: str = "en-IN"
    speaker: str | None = None


@router.post("/speak")
def speak(req: SpeakRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="No text provided to speak.")

    speaker = req.speaker or SARVAM_TTS_DEFAULT_SPEAKER

    # Check cache first - avoids paying Sarvam again for identical text
    # that's already been spoken (e.g. worker taps "Speak answer" twice).
    cached = get_cached_audio(req.text, req.language_code, speaker)
    if cached is not None:
        return Response(content=cached, media_type="audio/wav", headers={"X-Cache": "hit"})

    try:
        audio_bytes = text_to_speech(req.text, req.language_code, speaker)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Text-to-speech failed: {str(e)}")

    store_audio(req.text, req.language_code, speaker, audio_bytes)

    return Response(content=audio_bytes, media_type="audio/wav", headers={"X-Cache": "miss"})


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    audio_bytes = await file.read()

    try:
        result = transcribe_audio(audio_bytes, filename=file.filename or "audio.webm")
    except TranscriptionError as e:
        # Message is already worker-safe (came from voice/stt.py's own
        # handling of Sarvam's response) - no raw Sarvam error text,
        # no internal model/param names leaking into the UI.
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        # Anything else is a bug on our side, not a Sarvam response -
        # log it server-side, keep the worker-facing message generic.
        import logging
        logging.getLogger(__name__).exception("Unexpected error in /transcribe")
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")

    return result