"""
setup_db.py

Run this ONCE to create the workers, worker_sessions, and admin_sessions
tables in your Postgres database. Safe to run again later too - it won't
recreate tables that already exist or delete any data.

Usage:
    python setup_db.py
"""

from db import engine, Base
import models  # noqa: F401 - this import is needed so Base knows about the table definitions

Base.metadata.create_all(bind=engine)
print(
    "Tables created (or already existed): workers, worker_sessions, admin_sessions, "
    "worker_machines, tickets, question_logs, interview_sessions, interview_turns"
)