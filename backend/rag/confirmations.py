"""
rag/confirmations.py

Short, natural-sounding confirmation phrases for /add-knowledge or /add-tip, used
only for the spoken response (via /speak) - not for what gets stored.
Kept separate from ANSWER_PROMPT since this doesn't go through Gemini:
it's a fixed, short message, so a static phrase per language is simpler
and cheaper than generating one with an LLM call every time.

If a language isn't in this list, falls back to English.
"""

CONFIRMATION_MESSAGES = {
    "en-IN": "Got it. Your tip has been saved and will be reviewed by an admin soon.",
    "hi-IN": "ठीक है। आपकी जानकारी सेव हो गई है, जल्द ही एडमिन इसे चेक करेंगे।",
    # Hinglish - Roman script, matching the same code-mixed style the
    # ANSWER_PROMPT uses for /ask responses.
    "hi-en": "Theek hai, aapka tip save ho gaya hai. Admin jald hi ise check karenge.",
    "mr-IN": "ठीक आहे. तुमची माहिती सेव्ह झाली आहे, लवकरच अॅडमिन ती तपासतील.",
    "ta-IN": "சரி. உங்கள் தகவல் சேமிக்கப்பட்டது, விரைவில் நிர்வாகி பரிசீலிப்பார்.",
    "ur-IN": "ٹھیک ہے۔ آپ کی معلومات محفوظ ہو گئی ہے، جلد ہی ایڈمن اسے چیک کرے گا۔",
}


def get_confirmation_message(language_code: str) -> str:
    return CONFIRMATION_MESSAGES.get(language_code, CONFIRMATION_MESSAGES["en-IN"])