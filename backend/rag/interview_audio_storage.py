"""
rag/interview_audio_storage.py

Saves a worker's recorded interview-answer audio to disk, so admin can
play back the original recording alongside the transcript in Knowledge
Review's Interviews tab. Mirrors rag/video_storage.py's pattern for tip
videos - same on-disk layout style, served the same way via main.py's
existing "/uploads" static mount.
"""

import uuid
from pathlib import Path
from fastapi import UploadFile

AUDIO_DIR = Path("uploads/interview_audio")
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


async def save_answer_audio(file: UploadFile, session_id: str) -> str:
    """
    Saves one answer's audio under a session-specific subfolder and
    returns a relative URL, storable on the InterviewTurn row and
    servable directly via the app's "/uploads" static mount.
    """
    session_dir = AUDIO_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "").suffix.lower() or ".webm"
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = session_dir / filename

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    return f"/uploads/interview_audio/{session_id}/{filename}"
