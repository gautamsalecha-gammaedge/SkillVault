"""
routers/knowledge.py

POST /add-knowledge/check  - reviews tip before saving (text only for now)
POST /add-knowledge        - final submission (now supports optional video)
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

router = APIRouter(prefix="/Knowledge", tags=["Knowledge"])


@router.post("/add-knowledge/check")
def check_knowledge(req: CheckKnowledgeRequest, worker: dict = Depends(require_worker)):
    """
    Reviews a tip BEFORE it's stored.
    Currently text-only. Video understanding happens on final submit.
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
    worker: dict = Depends(require_worker),
):
    """
    Final submission of a tip.
    Supports optional video upload + Full Video AI understanding.
    """

    video_url = None
    transcript = ""
    video_description = ""

    # ---------- Handle Video ----------
    if video and video.filename:
        # 1. Safety checks
        allowed_types = {
            "video/mp4",
            "video/webm",
            "video/quicktime",  # .mov
            "video/x-msvideo",  # .avi
        }
        max_size = 80 * 1024 * 1024  # 80 MB

        if video.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Only MP4, WebM, MOV or AVI videos are allowed."
            )

        # Read file once to check size
        content = await video.read()
        if len(content) > max_size:
            raise HTTPException(
                status_code=400,
                detail="Video is too large. Maximum size is 80 MB."
            )

        # Reset so save_video can read it again
        await video.seek(0)

        # 2. Save video to disk
        video_url = await save_video(video, machine_id)

        # 3. Full path for Gemini
        full_path = video_url.lstrip("/")

        # 4. Ask Gemini to understand the video
        try:
            understanding = understand_video(full_path)
            transcript = understanding.get("transcript", "")
            video_description = understanding.get("video_description", "")
        except Exception as e:
            # Don't fail the whole tip if Gemini fails
            print(f"Video understanding failed: {e}")
            transcript = ""
            video_description = ""

    # ---------- Prepare final text for embedding ----------
    combined_text = text
    if video_description:
        combined_text += f"\n\n[Video Understanding]: {video_description}"
    if transcript:
        combined_text += f"\n\n[Transcript]: {transcript}"

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
        "transcript": transcript,
        "video_description": video_description,
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
        "spoken_confirmation": get_confirmation_message(language_code),
    }