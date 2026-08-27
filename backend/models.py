"""
models.py

Defines the actual tables that will exist in your Postgres database.
Each class here becomes one real table once we run the setup step.
"""

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text, Integer , UniqueConstraint
from datetime import datetime
from db import Base


class User(Base):
    """
    Single login identity (real-world standard).
    Roles in user_roles: worker and/or supervisor.
    Floor FKs still use workers.worker_id (same value as user_id for workers).
    """
    __tablename__ = "users"

    user_id = Column(String, primary_key=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    email_verified = Column(Boolean, nullable=False, default=False)
    phone_country_code = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserRole(Base):
    """Roles for a user: worker | supervisor (both allowed)."""
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role", name="uq_user_role"),)

    user_id = Column(String, ForeignKey("users.user_id"), primary_key=True)
    role = Column(String, primary_key=True)  # worker | supervisor


class Worker(Base):
    """One row per registered worker - their login ID, scrambled password, name, and approval status."""
    __tablename__ = "workers"

    worker_id = Column(String, primary_key=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    # Worker cannot log in until an admin approves their registration.
    is_approved = Column(Boolean, nullable=False, default=False)

    # Profile fields - all optional, filled in at registration or later
    # via PUT /worker/profile (self) or PUT /admin/workers/{id} (admin).
    phone_country_code = Column(String, nullable=True, default="+91")
    phone_number = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    # Optional contact email — must be OTP-verified before password reset by email
    email = Column(String, nullable=True)
    email_verified = Column(Boolean, nullable=False, default=False)


class EmailOtp(Base):
    """
    Short-lived one-time codes for email verification and password reset.
    purpose: "verify_email" | "reset_password"
    """
    __tablename__ = "email_otps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, nullable=False, index=True)
    worker_id = Column(String, nullable=True, index=True)
    purpose = Column(String, nullable=False)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    consumed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PasswordResetRequest(Base):
    """
    Worker asked supervisor to set a temporary password.
    Admin may set a temp password only while status is pending.
    """
    __tablename__ = "password_reset_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    worker_id = Column(String, ForeignKey("workers.worker_id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="pending")  # pending | completed | cancelled
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String, nullable=True)  # admin label


class Admin(Base):
    """
    Supervisor account stored in Postgres (not .env).
    Password is bcrypt-hashed. First admin is seeded once from
    ADMIN_USERNAME / ADMIN_PASSWORD in .env when the table is empty.
    """
    __tablename__ = "admins"

    admin_id = Column(String, primary_key=True)  # login username
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AdminProfile(Base):
    """
    Legacy display-name table. Prefer Admin.name going forward.
    Kept so older DBs do not break; new code reads/writes Admin.
    """
    __tablename__ = "admin_profiles"

    username = Column(String, primary_key=True)
    name = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
    """One row per active admin login. admin_id links to admins.admin_id."""
    __tablename__ = "admin_sessions"

    token = Column(String, primary_key=True)
    admin_id = Column(String, nullable=True, index=True)  # nullable for migration of old rows
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
    admin_note = Column(Text, nullable=True)  # supervisor response visible to the worker
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
    video_url = Column(String, nullable=True)
    # Optional short video for this step, shown alongside the text on
    # the worker's briefing card. Uploaded separately via
    # POST /admin/safety/{id}/video - never required, never touches the
    # text create/update flow. See routers/safety.py.
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

class DailyUpdate(Base):
    """
    Worker end-of-shift / daily status notes.
    Stored in Postgres only (not Chroma) — operational log, not RAG knowledge.
    """
    __tablename__ = "daily_updates"

    id = Column(String, primary_key=True)  # uuid
    worker_id = Column(String, ForeignKey("workers.worker_id"), nullable=False)
    worker_name = Column(String, nullable=True)
    machine_id = Column(String, nullable=True)
    report_date = Column(String, nullable=False)  # YYYY-MM-DD (local day chosen by worker)
    raw_text = Column(Text, nullable=False)       # what the worker first wrote/spoke
    optimized_text = Column(Text, nullable=False) # AI-polished version they submitted
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)