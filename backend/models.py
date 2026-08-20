"""
models.py

Defines the actual tables that will exist in your Postgres database.
Each class here becomes one real table once we run the setup step.
"""

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text
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