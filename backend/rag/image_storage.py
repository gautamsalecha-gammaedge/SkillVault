"""
rag/image_storage.py

Saves uploaded tip / ask images to disk and returns a usable URL/path
(same pattern as rag/video_storage.py).
"""

import uuid
from pathlib import Path
from fastapi import UploadFile

IMAGE_DIR = Path("uploads/images")
IMAGE_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}

MAX_IMAGE_BYTES = 15 * 1024 * 1024  # 15 MB


async def save_image(file: UploadFile, machine_id: str, prefix: str = "tip") -> str:
    """
    Saves the uploaded image under uploads/images/{machine_id}/
    and returns a relative path for Chroma metadata / static serving.
    """
    machine_dir = IMAGE_DIR / machine_id
    machine_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        # Infer from content type when filename has no useful extension
        ct = (file.content_type or "").lower()
        if "png" in ct:
            ext = ".png"
        elif "webp" in ct:
            ext = ".webp"
        elif "gif" in ct:
            ext = ".gif"
        else:
            ext = ".jpg"

    filename = f"{prefix}-{uuid.uuid4().hex}{ext}"
    file_path = machine_dir / filename

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    return f"/uploads/images/{machine_id}/{filename}"