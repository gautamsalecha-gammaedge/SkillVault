"""
rag/video_storage.py

Handles saving uploaded tip videos to disk and returning a usable URL/path.
"""

import os
import uuid
from pathlib import Path
from fastapi import UploadFile

# Folder where videos will be stored
VIDEO_DIR = Path("uploads/videos")
VIDEO_DIR.mkdir(parents=True, exist_ok=True)


async def save_video(file: UploadFile, machine_id: str) -> str:
    """
    Saves the uploaded video and returns a relative path
    that can be stored in Chroma metadata as video_url.
    """
    # Create machine-specific subfolder
    machine_dir = VIDEO_DIR / machine_id
    machine_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    ext = Path(file.filename).suffix.lower() or ".mp4"
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = machine_dir / filename

    # Save file
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Return relative path (we will serve it later)
    return f"/uploads/videos/{machine_id}/{filename}"