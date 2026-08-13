"""
config.py

Loads environment variables and holds constants used across the app.
Every other file that needs a setting (API keys, admin credentials, token
expiry, model names) imports from here instead of calling os.environ
directly - so there's exactly one place to look when a setting changes.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# --- Gemini ---
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
EMBEDDING_MODEL = "gemini-embedding-001"
LLM_MODEL = "gemini-3.6-flash"

# --- Admin credentials (single fixed admin, not a DB table) ---
ADMIN_USERNAME = os.environ["ADMIN_USERNAME"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

# --- Sessions ---
# How long a login token stays valid before the person has to log in again.
# Defaults to 24 hours if not set in .env.
TOKEN_EXPIRY_HOURS = int(os.environ.get("TOKEN_EXPIRY_HOURS", "24"))

# --- Chroma ---
CHROMA_PATH = "./chroma_db"
CHROMA_COLLECTION_NAME = "skillvault_knowledge"

# --- Sarvam AI (text-to-speech) ---
SARVAM_API_KEY = os.environ["SARVAM_API_KEY"]
SARVAM_TTS_MODEL = "bulbul:v3"
SARVAM_TTS_DEFAULT_SPEAKER = "shubh"