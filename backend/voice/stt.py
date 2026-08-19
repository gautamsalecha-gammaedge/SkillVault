"""
voice/stt.py

Wraps Sarvam AI's speech-to-text API. Given raw audio bytes, returns the
transcript AND the detected spoken language - passing language_code=
"unknown" tells Sarvam to auto-detect rather than assume a fixed
language, which is what lets a worker speak in whatever language
they're comfortable in without picking it beforehand.

Model: saaras:v4 (Sarvam's current recommended transcription model -
NOT "saarika:v4", which doesn't exist; Saarika and Saaras are separate
model families with their own version numbers, and mixing them up is
what causes a 400 from Sarvam's API). Saaras requires an explicit
mode="transcribe" to get plain transcription output (Saarika ignores
this param entirely, but Saaras needs it).

Audio format: Sarvam's REST STT endpoint auto-detects codec for most
formats including WebM (which is what the browser's MediaRecorder
produces), so no client-side transcoding is needed.
"""

import logging

import requests

from config import SARVAM_API_KEY, SARVAM_STT_MODEL

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"

logger = logging.getLogger(__name__)


class TranscriptionError(Exception):
    """Raised when Sarvam STT fails, with a message safe to show a worker."""


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> dict:
    """
    Returns {"transcript": str, "language_code": str}.
    language_code comes back in Sarvam's own format (e.g. "hi-IN") -
    already matches this app's language code convention.

    Raises TranscriptionError with a short, worker-safe message on any
    failure - callers should catch this specifically rather than a bare
    Exception, so Sarvam's raw error text never reaches the frontend.
    """
    if not audio_bytes:
        raise TranscriptionError("No audio was received.")

    try:
        response = requests.post(
            SARVAM_STT_URL,
            headers={"api-subscription-key": SARVAM_API_KEY},
            files={"file": (filename, audio_bytes, "audio/webm")},
            data={
                "model": SARVAM_STT_MODEL,
                "language_code": "unknown",  # auto-detect
                "mode": "transcribe",  # required for saaras models; ignored by saarika
            },
            timeout=30,
        )
    except requests.exceptions.Timeout:
        logger.exception("Sarvam STT request timed out")
        raise TranscriptionError("Transcription timed out. Please try again.")
    except requests.exceptions.RequestException:
        logger.exception("Sarvam STT request failed")
        raise TranscriptionError("Couldn't reach the transcription service. Please try again.")

    if not response.ok:
        # Log the real Sarvam error server-side for debugging, but never
        # forward it as-is to the worker - it's meant for developers
        # (mentions model names, param names, internal error codes).
        logger.error("Sarvam STT returned %s: %s", response.status_code, response.text[:500])
        if response.status_code == 400:
            raise TranscriptionError("Couldn't process that recording. Please try again.")
        if response.status_code == 401 or response.status_code == 403:
            raise TranscriptionError("Speech-to-text is misconfigured. Please contact an admin.")
        if response.status_code == 429:
            raise TranscriptionError("Too many requests. Please wait a moment and try again.")
        raise TranscriptionError("Transcription service is temporarily unavailable.")

    data = response.json()
    transcript = data.get("transcript", "")
    language_code = data.get("language_code") or "en-IN"

    if not transcript.strip():
        raise TranscriptionError("Couldn't hear anything in that recording. Please try again.")

    return {"transcript": transcript, "language_code": language_code}