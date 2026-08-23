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
# that already existed. video_url was added to safety_measures after some
# DBs were already set up, so backfill it here too - safe to run any
# number of times. Same story for the profile fields added to workers
# for the Update Profile feature.
with engine.begin() as conn:
    conn.execute(text(
        "ALTER TABLE safety_measures ADD COLUMN IF NOT EXISTS video_url VARCHAR"
    ))
    conn.execute(text(
        "ALTER TABLE workers ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR DEFAULT '+91'"
    ))
    conn.execute(text(
        "ALTER TABLE workers ADD COLUMN IF NOT EXISTS phone_number VARCHAR"
    ))
    conn.execute(text(
        "ALTER TABLE workers ADD COLUMN IF NOT EXISTS address TEXT"
    ))

print(
    "Tables created (or already existed): workers, worker_sessions, admin_sessions, "
    "worker_machines, tickets, question_logs, interview_sessions, interview_turns, "
    "safety_measures, safety_completions, admin_profiles"
)