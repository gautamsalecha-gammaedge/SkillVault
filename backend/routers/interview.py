"""
routers/interview.py

Tacit Knowledge Capture - a guided, AI-led voice interview that walks a
senior worker through a machine-specific topic bank (safety,
troubleshooting, maintenance, changeover, escalation - see
rag/interview_topics.py), asking a follow-up when an answer needs one
and moving on once it's specific enough to be useful to someone else.

Two routers live in this file:

  `router`       (prefix /interview) - the worker-facing interview flow.
  `admin_router` (prefix /admin)     - admin's view of sessions/transcripts.

Worker flow:
  POST /interview/start                 - start a new interview, or resume
                                           one already in progress/paused
                                           for this worker+machine
  GET  /interview/{id}                  - current state (for reload/resume)
  POST /interview/{id}/answer           - submit an answer, get back the
                                           next question (or completion)
  POST /interview/{id}/pause            - worker steps away, come back later
  POST /interview/{id}/end              - worker ends the session early

Admin flow:
  GET /admin/interview-sessions              - list sessions (filterable)
  GET /admin/interview-sessions/{id}         - full transcript, turn by turn

Approving/rejecting the knowledge distilled from an interview reuses the
EXISTING /admin/approve/{id} and /admin/delete/{id} endpoints in
routers/admin.py unchanged - those already work on any Chroma entry ID
regardless of source_type, so no new approval endpoints were needed.
Interview-sourced entries are tagged source_type="tacit_interview" (vs
"worker_input" for regular tips) so the frontend can split Knowledge
Review into separate Tips / Interviews tabs.

Audio: the frontend transcribes each answer via the existing
/transcribe endpoint (same as Add Tip / Hands-Free) to get text fast for
the live captions, then submits that text here alongside the original
recording (as multipart form, same pattern as add_knowledge's optional
video) so the original audio is kept for admin playback.
"""

import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from auth.admin_auth import require_admin
from auth.worker_auth import require_worker
from db import get_db
from models import InterviewSession, InterviewTurn, Worker, WorkerMachine
from rag.chroma_store import collection
from rag.embeddings import embed_text
from rag.interview_audio_storage import save_answer_audio
from rag.interview_flow import evaluate_answer, generate_acknowledgement
from rag.interview_topics import generate_topic_bank
from schemas import StartInterviewRequest

router = APIRouter(prefix="/interview", tags=["Interview"])
admin_router = APIRouter(prefix="/admin", tags=["Interview"])

# How many follow-up questions are allowed on a single topic before we
# move on regardless of what the model thinks - same round-cap idea as
# Add Tip's CheckKnowledgeRequest.round, just enforced here instead of
# by the frontend, since the whole conversation is server-driven.
MAX_FOLLOWUPS = 2


def _session_state(session: InterviewSession, db: Session) -> dict:
    """Shared shape returned by start/get/answer/pause/end, so the
    frontend's interview state machine always gets the same fields
    regardless of which endpoint it just called."""
    topics = json.loads(session.topics_json)
    total_topics = len(topics)
    topic_title = topics[session.topic_index]["title"] if session.topic_index < total_topics else None
    worker = db.query(Worker).filter(Worker.worker_id == session.worker_id).first()

    return {
        "session_id": session.id,
        "status": session.status,
        "machine_id": session.machine_id,
        "language_code": session.language_code,
        "worker_name": worker.name if worker else None,
        "topic_index": session.topic_index,
        "total_topics": total_topics,
        "topic_title": topic_title,
        "current_question": session.current_question,
        "is_followup": session.current_is_followup,
        "insights_captured": session.insights_captured,
        "completed": session.status == "completed",
    }


def _get_owned_session(session_id: str, worker: dict, db: Session) -> InterviewSession:
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    if session.worker_id != worker["worker_id"]:
        raise HTTPException(status_code=403, detail="This interview session doesn't belong to you.")
    return session


# ---------- Worker flow ----------

@router.get("/check")
def check_resumable_interview(
    machine_id: str,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """
    Read-only lookup for whether this worker has an in_progress/paused
    session for this machine already - used by the frontend to show a
    "Continue where you left off" vs "Start fresh" choice BEFORE calling
    /start, instead of /start silently resuming without asking. Does
    not mutate anything.
    """
    existing = db.query(InterviewSession).filter(
        InterviewSession.worker_id == worker["worker_id"],
        InterviewSession.machine_id == machine_id,
        InterviewSession.status.in_(["in_progress", "paused"]),
    ).first()

    if not existing:
        return {"resumable": False}

    topics = json.loads(existing.topics_json)
    return {
        "resumable": True,
        "topic_index": existing.topic_index,
        "total_topics": len(topics),
        "insights_captured": existing.insights_captured,
        "last_activity_at": existing.last_activity_at.isoformat() if existing.last_activity_at else None,
    }


@router.post("/start")
def start_interview(
    req: StartInterviewRequest,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """
    Starts a new interview for this worker+machine, OR - if one is
    already in_progress/paused for this exact worker+machine - resumes
    it instead of creating a duplicate. This single endpoint covers
    both "start" and "resume" so the frontend doesn't need to check
    first: it can always call /start on page load and get back whatever
    state is correct (fresh or resumed).

    req.fresh=True skips resuming: the existing session is marked
    "abandoned" (kept for the record, just no longer active/resumable)
    and a brand-new session is created instead. Used when the worker is
    shown a resume/fresh choice (GET /interview/check) and picks fresh.
    """
    assigned = db.query(WorkerMachine).filter(
        WorkerMachine.worker_id == worker["worker_id"],
        WorkerMachine.machine_id == req.machine_id,
    ).first()
    if not assigned:
        raise HTTPException(status_code=403, detail="You aren't assigned to this machine.")

    existing = db.query(InterviewSession).filter(
        InterviewSession.worker_id == worker["worker_id"],
        InterviewSession.machine_id == req.machine_id,
        InterviewSession.status.in_(["in_progress", "paused"]),
    ).first()

    if existing and not req.fresh:
        existing.status = "in_progress"
        existing.last_activity_at = datetime.utcnow()
        db.commit()
        return {"resumed": True, **_session_state(existing, db)}

    if existing and req.fresh:
        existing.status = "abandoned"
        existing.last_activity_at = datetime.utcnow()
        db.commit()

    topics = generate_topic_bank(req.machine_id)
    session = InterviewSession(
        id=str(uuid.uuid4()),
        worker_id=worker["worker_id"],
        machine_id=req.machine_id,
        language_code=req.language_code,
        status="in_progress",
        topics_json=json.dumps(topics),
        topic_index=0,
        followup_count=0,
        current_question=topics[0]["seed_question"],
        current_is_followup=False,
        insights_captured=0,
    )
    db.add(session)
    db.commit()

    return {"resumed": False, **_session_state(session, db)}


@router.get("/{session_id}")
def get_interview(
    session_id: str,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """Current state of one session - used when the frontend reloads or
    a worker returns to a paused interview."""
    session = _get_owned_session(session_id, worker, db)
    return _session_state(session, db)


@router.get("/{session_id}/transcript")
def get_interview_transcript_worker(
    session_id: str,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """Turn-by-turn transcript for the worker's OWN session. Used purely
    to rebuild the on-screen conversation thread when resuming a
    paused/in-progress interview - without this, resuming dropped the
    worker straight into the next question with an empty thread, which
    read as "starting the test over" even though the backend had kept
    all their progress. Deliberately a smaller shape than the admin
    transcript endpoint (no audio URLs, no knowledge/approval status -
    a worker reviewing their own answers has no use for either)."""
    session = _get_owned_session(session_id, worker, db)
    turns = (
        db.query(InterviewTurn)
        .filter(InterviewTurn.session_id == session_id)
        .order_by(InterviewTurn.turn_index)
        .all()
    )
    return {
        "turns": [
            {
                "topic_title": t.topic_title,
                "is_followup": t.is_followup,
                "question_text": t.question_text,
                "answer_text": t.answer_text,
            }
            for t in turns
        ]
    }


@router.post("/{session_id}/answer")
async def submit_answer(
    session_id: str,
    answer_text: str = Form(...),
    language_code: str = Form("en-IN"),
    audio: Optional[UploadFile] = File(None),
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """
    Submits the worker's answer to the current question. Records the
    turn, decides (via rag/interview_flow.evaluate_answer) whether a
    follow-up is needed or the topic's done, pushes any distilled
    insight into the knowledge base as a pending entry, and returns the
    next question (or marks the session completed once every topic has
    been covered).
    """
    session = _get_owned_session(session_id, worker, db)

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="This interview is already complete.")

    if not answer_text.strip():
        raise HTTPException(status_code=400, detail="No answer text was provided.")

    topics = json.loads(session.topics_json)
    if session.topic_index >= len(topics):
        raise HTTPException(status_code=400, detail="This interview has no more topics left.")

    current_topic = topics[session.topic_index]

    # Save the original recording for admin playback - never block the
    # turn over a storage hiccup, the transcript text still gets saved.
    audio_url = None
    if audio and audio.filename:
        try:
            audio_url = await save_answer_audio(audio, session_id)
        except Exception:
            audio_url = None

    turn_index = db.query(InterviewTurn).filter(InterviewTurn.session_id == session_id).count()
    turn = InterviewTurn(
        id=str(uuid.uuid4()),
        session_id=session_id,
        turn_index=turn_index,
        topic_key=current_topic["topic_key"],
        topic_title=current_topic["title"],
        is_followup=session.current_is_followup,
        question_text=session.current_question or current_topic["seed_question"],
        answer_text=answer_text,
        answer_audio_url=audio_url,
    )

    result = evaluate_answer(
        machine_id=session.machine_id,
        topic_title=current_topic["title"],
        question_text=turn.question_text,
        answer_text=answer_text,
        language_code=language_code,
    )

    # Push any distilled insight into the SAME Chroma collection regular
    # tips live in, tagged so it can be told apart in Knowledge Review.
    if result.get("insight"):
        try:
            embedding = embed_text(result["insight"], task_type="RETRIEVAL_DOCUMENT")
            entry_id = f"{session.machine_id}-interview-{worker['worker_id']}-{uuid.uuid4().hex[:12]}"
            collection.upsert(
                ids=[entry_id],
                embeddings=[embedding],
                documents=[result["insight"]],
                metadatas=[{
                    "machine_id": session.machine_id,
                    "source_type": "tacit_interview",
                    "worker_id": worker["worker_id"],
                    "worker_name": worker["name"],
                    "status": "pending",
                    "session_id": session_id,
                    "turn_id": turn.id,
                    "topic_key": current_topic["topic_key"],
                    "topic_title": current_topic["title"],
                }],
            )
            turn.knowledge_entry_id = entry_id
            session.insights_captured += 1
        except Exception:
            # Transcript is still saved even if distillation/embedding
            # failed - admin can still read the raw answer either way.
            pass

    db.add(turn)

    if not result["complete"] and session.followup_count < MAX_FOLLOWUPS:
        session.followup_count += 1
        session.current_question = result["followup_question"] or "Could you tell me a bit more about that?"
        session.current_is_followup = True
    else:
        session.followup_count = 0
        session.topic_index += 1
        if session.topic_index >= len(topics):
            session.status = "completed"
            session.completed_at = datetime.utcnow()
            session.current_question = None
            session.current_is_followup = False
        else:
            next_topic = topics[session.topic_index]
            session.current_question = next_topic["seed_question"]
            session.current_is_followup = False

    session.language_code = language_code or session.language_code
    session.last_activity_at = datetime.utcnow()
    db.commit()

    acknowledgement = generate_acknowledgement(worker["name"], session.machine_id, session.language_code)

    return {
        "acknowledgement": acknowledgement,
        "insight_captured": bool(result.get("insight")),
        **_session_state(session, db),
    }


@router.post("/{session_id}/pause")
def pause_interview(
    session_id: str,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """Worker steps away mid-interview - session stays exactly where it
    is and can be resumed later via /interview/start (same worker+machine)."""
    session = _get_owned_session(session_id, worker, db)
    if session.status == "in_progress":
        session.status = "paused"
        session.last_activity_at = datetime.utcnow()
        db.commit()
    return _session_state(session, db)


@router.post("/{session_id}/end")
def end_interview(
    session_id: str,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    """Worker taps "I'm done for now" before every topic is covered -
    closes the session early rather than leaving it open indefinitely."""
    session = _get_owned_session(session_id, worker, db)
    if session.status != "completed":
        session.status = "completed"
        session.completed_at = datetime.utcnow()
        session.current_question = None
        db.commit()
    return _session_state(session, db)


# ---------- Admin flow ----------

def _insight_counts_by_session(machine_id: Optional[str]) -> dict:
    """One Chroma query for every tacit-interview insight (optionally
    scoped to a machine), grouped into per-session pending/approved/
    rejected counts. Pulled out of list_interview_sessions and done as a
    single bulk query - rather than one Chroma lookup per session - so
    the sessions list doesn't get slower as the number of sessions
    grows. Used to show admins, right in the list, which sessions
    actually need attention instead of making them open every one."""
    where = {"source_type": "tacit_interview"}
    if machine_id:
        where = {"$and": [{"source_type": "tacit_interview"}, {"machine_id": machine_id}]}
    results = collection.get(where=where)
    counts: dict = {}
    for meta in results.get("metadatas", []) or []:
        sid = meta.get("session_id")
        if not sid:
            continue
        c = counts.setdefault(sid, {"pending": 0, "approved": 0, "rejected": 0})
        status = meta.get("status", "pending")
        if status in c:
            c[status] += 1
    return counts


@admin_router.get("/interview-sessions")
def list_interview_sessions(
    machine_id: Optional[str] = None,
    status: Optional[str] = None,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Lists interview sessions for Knowledge Review's Interviews tab,
    optionally filtered by machine and/or status."""
    query = db.query(InterviewSession)
    if machine_id:
        query = query.filter(InterviewSession.machine_id == machine_id)
    if status:
        query = query.filter(InterviewSession.status == status)
    sessions = query.order_by(InterviewSession.started_at.desc()).all()

    insight_counts = _insight_counts_by_session(machine_id)

    results = []
    for s in sessions:
        worker = db.query(Worker).filter(Worker.worker_id == s.worker_id).first()
        topics = json.loads(s.topics_json)
        counts = insight_counts.get(s.id, {"pending": 0, "approved": 0, "rejected": 0})
        results.append({
            "session_id": s.id,
            "worker_id": s.worker_id,
            "worker_name": worker.name if worker else s.worker_id,
            "machine_id": s.machine_id,
            "status": s.status,
            "topic_index": s.topic_index,
            "total_topics": len(topics),
            "insights_captured": s.insights_captured,
            "pending_insights": counts["pending"],
            "approved_insights": counts["approved"],
            "rejected_insights": counts["rejected"],
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        })

    return {"sessions": results}


@admin_router.post("/interview-sessions/{session_id}/approve-pending")
def approve_session_pending(
    session_id: str,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Approves every still-pending insight from one interview session in
    a single call - the session-level "Approve" action. Reuses the same
    Chroma collection /admin/approve/{id} writes to, just applied to every
    matching entry at once instead of requiring one click per turn."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    results = collection.get(where={"$and": [{"session_id": session_id}, {"status": "pending"}]})
    ids = results.get("ids", [])
    for i, entry_id in enumerate(ids):
        meta = results["metadatas"][i]
        meta["status"] = "approved"
        collection.update(ids=[entry_id], metadatas=[meta])

    return {"approved": len(ids)}


@admin_router.post("/interview-sessions/{session_id}/reject-pending")
def reject_session_pending(
    session_id: str,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Deletes every still-pending insight from one interview session in
    a single call - the session-level "Delete" action. The interview
    transcript itself (InterviewSession/InterviewTurn rows) is untouched,
    kept for the record - this only removes the distilled knowledge
    entries from ever going live."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    results = collection.get(where={"$and": [{"session_id": session_id}, {"status": "pending"}]})
    ids = results.get("ids", [])
    if ids:
        collection.delete(ids=ids)

    return {"rejected": len(ids)}


@admin_router.get("/interview-sessions/{session_id}")
def get_interview_transcript(
    session_id: str,
    authorized: bool = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Full turn-by-turn transcript for one session, including each
    turn's audio (if recorded) and the live approval status of any
    knowledge entry it produced - approving/deleting still goes through
    the existing /admin/approve/{id} and /admin/delete/{id} endpoints."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    worker = db.query(Worker).filter(Worker.worker_id == session.worker_id).first()
    turns = (
        db.query(InterviewTurn)
        .filter(InterviewTurn.session_id == session_id)
        .order_by(InterviewTurn.turn_index)
        .all()
    )

    turn_list = []
    for t in turns:
        knowledge_status = None
        if t.knowledge_entry_id:
            existing = collection.get(ids=[t.knowledge_entry_id])
            if existing["ids"]:
                knowledge_status = existing["metadatas"][0].get("status")
        turn_list.append({
            "turn_id": t.id,
            "topic_key": t.topic_key,
            "topic_title": t.topic_title,
            "is_followup": t.is_followup,
            "question_text": t.question_text,
            "answer_text": t.answer_text,
            "answer_audio_url": t.answer_audio_url,
            "knowledge_entry_id": t.knowledge_entry_id,
            "knowledge_status": knowledge_status,
        })

    topics = json.loads(session.topics_json)
    return {
        "session_id": session.id,
        "worker_id": session.worker_id,
        "worker_name": worker.name if worker else session.worker_id,
        "machine_id": session.machine_id,
        "status": session.status,
        "total_topics": len(topics),
        "insights_captured": session.insights_captured,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
        "turns": turn_list,
    }