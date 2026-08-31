"""
config.py

Loads environment variables and holds constants used across the app.
API keys live in .env — model names and defaults live here.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# --- Gemini (embeddings + vision/video + text fallback) ---
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
EMBEDDING_MODEL = "gemini-embedding-001"
# Text fallback + image/video understanding
LLM_MODEL = "gemini-3.6-flash"

# --- Sessions ---
TOKEN_EXPIRY_HOURS = int(os.environ.get("TOKEN_EXPIRY_HOURS", "24"))

# --- Chroma ---
CHROMA_PATH = "./chroma_db"
CHROMA_COLLECTION_NAME = "skillvault_knowledge"

# --- Sarvam AI (TTS + STT) ---
SARVAM_API_KEY = os.environ["SARVAM_API_KEY"]
SARVAM_TTS_MODEL = "bulbul:v3"
SARVAM_TTS_DEFAULT_SPEAKER = "shubh"
SARVAM_STT_MODEL = "saaras:v4"
AUDIO_CACHE_TTL_HOURS = int(os.environ.get("AUDIO_CACHE_TTL_HOURS", "24"))

# --- Groq (PRIMARY text: Ask, tips review, interview, daily polish) ---
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = "openai/gpt-oss-120b"

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")