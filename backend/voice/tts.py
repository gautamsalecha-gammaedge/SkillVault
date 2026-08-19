"""
voice/tts.py

Wraps Sarvam AI's text-to-speech API (Bulbul v3). Converts answer text
into properly Indian-accented speech (including native Hinglish
code-switching) - something browser-based SpeechSynthesis can't
reliably do, since it depends on whatever voices happen to be
installed on the worker's device.

Returns raw WAV audio bytes, ready to send straight to the frontend.
"""

import base64
import requests

from config import SARVAM_API_KEY, SARVAM_TTS_MODEL, SARVAM_TTS_DEFAULT_SPEAKER

SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"

# Sarvam's language_code values differ slightly from browser lang codes -
# map the ones this app uses to Sarvam's expected format.
LANGUAGE_CODE_MAP = {
    "hi-IN": "hi-IN",
    "en-IN": "en-IN",
    "mr-IN": "mr-IN",
    "ta-IN": "ta-IN",
    # Sarvam's TTS currently covers Hindi + 9 other Indian languages + English.
    # Urdu isn't in that list as of this writing - falls back to Hindi's
    # script/sound rather than failing outright.
    "ur-IN": "hi-IN",
}


def text_to_speech(text: str, language_code: str, speaker: str = None) -> bytes:
    """
    Converts text into speech using Sarvam's Bulbul v3 model.
    Returns raw WAV bytes (already base64-decoded, ready to write or stream).

    language_code: one of this app's language codes (e.g. "hi-IN", "en-IN").
    speaker: optional Sarvam voice name; defaults to SARVAM_TTS_DEFAULT_SPEAKER.
    """
    if len(text) > 2500:
        # Sarvam's v3 REST limit - truncate rather than fail outright,
        # since most answers here are short (2-4 sentences by design).
        text = text[:2500]

    sarvam_lang = LANGUAGE_CODE_MAP.get(language_code, "en-IN")

    response = requests.post(
        SARVAM_TTS_URL,
        headers={
            "api-subscription-key": SARVAM_API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "language_code": sarvam_lang,
            "model": SARVAM_TTS_MODEL,
            "speaker": speaker or SARVAM_TTS_DEFAULT_SPEAKER,
        },
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    combined_base64 = "".join(data["audios"])
    return base64.b64decode(combined_base64)