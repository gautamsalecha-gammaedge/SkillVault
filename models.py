"""
models.py

Defines the actual tables that will exist in your Postgres database.
Each class here becomes one real table once we run the setup step.
"""

from sqlalchemy import Column, String, DateTime, ForeignKey
from db import Base


class Worker(Base):
    """One row per registered worker - their login ID, scrambled password, and name."""
    __tablename__ = "workers"

    worker_id = Column(String, primary_key=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)


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
    """One row per active admin login. Same idea as WorkerSession, but for the single admin account."""
    __tablename__ = "admin_sessions"

    token = Column(String, primary_key=True)
    expires_at = Column(DateTime, nullable=False)