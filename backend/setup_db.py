"""
setup_db.py

Run this ONCE to create the workers, worker_sessions, and admin_sessions
tables in your Postgres database. Safe to run again later too - it won't
recreate tables that already exist or delete any data.

Usage:
    python setup_db.py
"""

from sqlalchemy import text
from db import engine, Base
import models  # noqa: F401 - this import is needed so Base knows about the table definitions

Base.metadata.create_all(bind=engine)

# create_all only creates missing TABLES, not missing COLUMNS on tables
# that already existed. Backfill new columns / seed singleton rows here —
# safe to run any number of times.
with engine.begin() as conn:
    conn.execute(text(
        "ALTER TABLE safety_measures ADD COLUMN IF NOT EXISTS video_url VARCHAR"
    ))
    conn.execute(text(
        "ALTER TABLE workers ADD COLUMN IF NOT EXISTS phone VARCHAR"
    ))
    conn.execute(text(
        "ALTER TABLE workers ADD COLUMN IF NOT EXISTS address TEXT"
    ))
    # Seed the singleton admin profile row if missing.
    conn.execute(text(
        "INSERT INTO admin_profile (id, name) VALUES (1, 'Admin') "
        "ON CONFLICT (id) DO NOTHING"
    ))

print(
    "Tables created (or already existed): workers, worker_sessions, admin_sessions, "
    "admin_profile, worker_machines, tickets, question_logs, interview_sessions, "
    "interview_turns, safety_measures, safety_completions"
)