"""
routers/knowledge.py

POST /add-knowledge/check  - reviews tip before saving (text only for now)
POST /add-knowledge        - final submission (optional video and/or image)
"""

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from typing import Optional
import uuid

from schemas import CheckKnowledgeRequest
from auth.worker_auth import require_worker
from rag.embeddings import embed_text
from rag.chroma_store import collection
from rag.confirmations import get_confirmation_message
from rag.knowledge_review import review_knowledge
from rag.video_storage import save_video
from rag.video_understanding import understand_video
from rag.image_storage import save_image, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES
from rag.image_understanding import understand_image

router = APIRouter(prefix="/Knowledge", tags=["Knowledge"])


@router.post("/add-knowledge/check")
def check_knowledge(req: CheckKnowledgeRequest, worker: dict = Depends(require_worker)):
    """
    Reviews a tip BEFORE it's stored.
    Currently text-only. Video/image understanding happens on final submit.
    """
    result = review_knowledge(req.text, req.machine_id, req.language_code)

    if req.round >= 2:
        result["complete"] = True
        result["question"] = None

    return result


@router.post("/add-knowledge")
async def add_knowledge(
    text: str = Form(...),
    machine_id: str = Form(...),
    language_code: str = Form("en-IN"),
    video: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    worker: dict = Depends(require_worker),
):
    """
    Final submission of a tip.
    Supports optional video and/or image upload with Gemini understanding
    (same depth as video: description stored for admin review + retrieval).
    """

    video_url = None
    transcript = ""
    video_description = ""
    image_url = None
    image_description = ""
    image_visible_text = ""

    # ---------- Handle Video ----------
    if video and video.filename:
        allowed_types = {
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-msvideo",
        }
        max_size = 80 * 1024 * 1024

        if video.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Only MP4, WebM, MOV or AVI videos are allowed.",
            )

        content = await video.read()
        if len(content) > max_size:
            raise HTTPException(
                status_code=400,
                detail="Video is too large. Maximum size is 80 MB.",
            )

        await video.seek(0)
        video_url = await save_video(video, machine_id)
        full_path = video_url.lstrip("/")

        try:
            understanding = understand_video(full_path)
            transcript = understanding.get("transcript", "")
            video_description = understanding.get("video_description", "")
        except Exception as e:
            print(f"Video understanding failed: {e}")
            transcript = ""
            video_description = ""

    # ---------- Handle Image ----------
    if image and image.filename:
        ct = (image.content_type or "").lower()
        if ct not in ALLOWED_IMAGE_TYPES and not ct.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="Only JPEG, PNG, WebP or GIF images are allowed.",
            )

        content = await image.read()
        if len(content) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=400,
                detail="Image is too large. Maximum size is 15 MB.",
            )

        await image.seek(0)
        image_url = await save_image(image, machine_id, prefix="tip")
        full_path = image_url.lstrip("/")

        try:
            understanding = understand_image(full_path)
            image_description = understanding.get("image_description", "")
            image_visible_text = understanding.get("visible_text", "")
            key_details = understanding.get("key_details") or []
            if key_details and isinstance(key_details, list):
                extra = "; ".join(str(k) for k in key_details if k)
                if extra:
                    image_description = (
                        f"{image_description}\nKey details: {extra}".strip()
                        if image_description
                        else f"Key details: {extra}"
                    )
        except Exception as e:
            print(f"Image understanding failed: {e}")
            image_description = ""
            image_visible_text = ""

    # ---------- Prepare final text for embedding ----------
    combined_text = text
    if video_description:
        combined_text += f"\n\n[Video Understanding]: {video_description}"
    if transcript:
        combined_text += f"\n\n[Transcript]: {transcript}"
    if image_description:
        combined_text += f"\n\n[Image Understanding]: {image_description}"
    if image_visible_text:
        combined_text += f"\n\n[Image Text]: {image_visible_text}"

    # ---------- Save to Chroma ----------
    embedding = embed_text(combined_text, task_type="RETRIEVAL_DOCUMENT")
    entry_id = f"{machine_id}-worker-{worker['worker_id']}-{uuid.uuid4().hex[:12]}"

    metadata = {
        "machine_id": machine_id,
        "source_type": "worker_input",
        "worker_id": worker["worker_id"],
        "worker_name": worker["name"],
        "status": "pending",
        "video_url": video_url or "",
        "transcript": transcript or "",
        "video_description": video_description or "",
        "image_url": image_url or "",
        "image_description": image_description or "",
        "image_visible_text": image_visible_text or "",
    }

    collection.upsert(
        ids=[entry_id],
        embeddings=[embedding],
        documents=[combined_text],
        metadatas=[metadata],
    )

    return {
        "status": "saved as pending, awaiting admin approval",
        "id": entry_id,
        "added_by": worker["name"],
        "video_url": video_url,
        "image_url": image_url,
        "spoken_confirmation": get_confirmation_message(language_code),
    }