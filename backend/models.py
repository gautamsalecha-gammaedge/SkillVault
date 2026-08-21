"""
models.py

Defines the actual tables that will exist in your Postgres database.
Each class here becomes one real table once we run the setup step.
"""

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text, Integer , UniqueConstraint
from datetime import datetime
from db import Base


class Worker(Base):
    """One row per registered worker - their login ID, scrambled password, name, and approval status."""
    __tablename__ = "workers"

    worker_id = Column(String, primary_key=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    # Worker cannot log in until an admin approves their registration.
    is_approved = Column(Boolean, nullable=False, default=False)


class WorkerSession(Base):
    """
    One row per active worker login.
    Gets created when a worker logs in, deleted when their token expires
    or when they're checked and found expired.
    """
    __tablename__ = "worker_sessions"

    token = Column(String, primary_key=True)
    worker_id = Column(String, ForeignKey("workers.worker_id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)


class AdminSession(Base):
    """One row per active admin login."""
    __tablename__ = "admin_sessions"

    token = Column(String, primary_key=True)
    expires_at = Column(DateTime, nullable=False)


class WorkerMachine(Base):
    """
    One row per (worker, machine) assignment - which machines a worker is
    allowed to see and use.
    """
    __tablename__ = "worker_machines"

    worker_id = Column(String, ForeignKey("workers.worker_id"), primary_key=True)
    machine_id = Column(String, primary_key=True)


class Ticket(Base):
    """Worker-raised tickets / issues."""
    __tablename__ = "tickets"

    id = Column(String, primary_key=True)  # uuid
    worker_id = Column(String, ForeignKey("workers.worker_id"), nullable=False)
    machine_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String, nullable=False, default="Medium")  # Low / Medium / High
    status = Column(String, nullable=False, default="Open")      # Open / In Progress / Resolved / Closed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class QuestionLog(Base):
    """One row per worker question — powers analytics (questions per machine)."""
    __tablename__ = "question_logs"

    id = Column(String, primary_key=True)  # uuid
    worker_id = Column(String, ForeignKey("workers.worker_id"), nullable=False)
    machine_id = Column(String, nullable=False)
    sources_used = Column(String, nullable=True)  # store as string for simplicity
    created_at = Column(DateTime, default=datetime.utcnow)


class InterviewSession(Base):
    """
    One row per Tacit Knowledge Capture interview - the session survives
    across the whole guided interview (multiple topics, each with its
    own follow-up rounds). Deliberately a persistent Session table
    (rather than something that only lives in memory) so a worker who
    gets pulled away mid-shift can come back later and pick up exactly
    where they left off - see routers/interview.py.

    topics_json holds the machine-specific topic bank generated once at
    session start (see rag/interview_topics.py) - stored as JSON text so
    the same topic list is reused for the whole interview rather than
    being regenerated (and possibly changing) on every question.
    """
    __tablename__ = "interview_sessions"

    id = Column(String, primary_key=True)  # uuid
    worker_id = Column(String, ForeignKey("workers.worker_id"), nullable=False)
    machine_id = Column(String, nullable=False)
    language_code = Column(String, nullable=False, default="en-IN")

    status = Column(String, nullable=False, default="in_progress")
    # in_progress / paused / completed

    topics_json = Column(Text, nullable=False)
    topic_index = Column(Integer, nullable=False, default=0)
    followup_count = Column(Integer, nullable=False, default=0)
    # how many follow-ups asked on the CURRENT topic so far - reset to 0
    # whenever we move to the next topic. Capped by MAX_FOLLOWUPS in
    # routers/interview.py so a topic can't loop forever.

    current_question = Column(Text, nullable=True)
    # the question currently awaiting an answer from the worker - null
    # once the session is completed.
    current_is_followup = Column(Boolean, nullable=False, default=False)

    insights_captured = Column(Integer, nullable=False, default=0)
    # how many turns produced a distilled knowledge-base entry - shown
    # to the worker in the end-of-session recap.

    started_at = Column(DateTime, default=datetime.utcnow)
    last_activity_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class InterviewTurn(Base):
    """
    One row per question-answer exchange within an InterviewSession -
    the full transcript admin sees in Knowledge Review's Interviews tab.
    knowledge_entry_id points at the Chroma entry this turn produced (if
    the answer was substantial enough to distill into a tip) - null if
    the worker had nothing to add on that particular question.
    """
    __tablename__ = "interview_turns"

    id = Column(String, primary_key=True)  # uuid
    session_id = Column(String, ForeignKey("interview_sessions.id"), nullable=False)
    turn_index = Column(Integer, nullable=False)

    topic_key = Column(String, nullable=False)
    topic_title = Column(String, nullable=False)
    is_followup = Column(Boolean, nullable=False, default=False)

    question_text = Column(Text, nullable=False)
    answer_text = Column(Text, nullable=True)
    answer_audio_url = Column(String, nullable=True)
    # path to the worker's original recorded audio for this answer, for
    # admin playback - see rag/interview_audio_storage.py.

    knowledge_entry_id = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

class SafetyMeasure(Base):
    """
    One ordered safety instruction for a machine.
    Workers go through these (text + audio) before starting work.
    Admins CRUD and reorder them.
    """
    __tablename__ = "safety_measures"

    id = Column(String, primary_key=True)  # uuid
    machine_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)
    language_code = Column(String, nullable=False, default="en-IN")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)



class SafetyCompletion(Base):
    """
    Records that a worker completed the full safety briefing for a machine.
    One row per (worker, machine). Re-completing updates completed_at.
    """
    __tablename__ = "safety_completions"
    __table_args__ = (
        UniqueConstraint("worker_id", "machine_id", name="uq_safety_worker_machine"),
    )

    id = Column(String, primary_key=True)  # uuid
    worker_id = Column(String, ForeignKey("workers.worker_id"), nullable=False)
    machine_id = Column(String, nullable=False)
    language_code = Column(String, nullable=False, default="en-IN")
    completed_at = Column(DateTime, default=datetime.utcnow)