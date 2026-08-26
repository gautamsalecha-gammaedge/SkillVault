"""
routers/daily_updates.py

Worker daily status notes — Postgres only (not Chroma / RAG).

Flow:
1. Worker drafts update (text or speech on the frontend)
2. POST /daily-updates/optimize  → Gemini polishes wording (no new facts)
3. Worker may append more, re-optimize, then submit
4. POST /daily-updates           → stored for admin review
5. Admin lists by date (+ optional machine filter)
"""

from __future__ import annotations

import uuid
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from db import get_db, engine
from models import DailyUpdate, Worker
from schemas import OptimizeDailyUpdateRequest, SubmitDailyUpdateRequest
from auth.worker_auth import require_worker
from auth.admin_auth import require_admin
from config import GEMINI_API_KEY, LLM_MODEL

router = APIRouter(prefix="/daily-updates", tags=["Daily Updates"])
admin_router = APIRouter(prefix="/admin", tags=["Daily Updates"])


def _ensure_table():
    """Create daily_updates if this DB predates the model (no migration tool)."""
    sqls = [
        """
        CREATE TABLE IF NOT EXISTS daily_updates (
            id VARCHAR PRIMARY KEY,
            worker_id VARCHAR NOT NULL REFERENCES workers(worker_id),
            worker_name VARCHAR,
            machine_id VARCHAR,
            report_date VARCHAR NOT NULL,
            raw_text TEXT NOT NULL,
            optimized_text TEXT NOT NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE,
            updated_at TIMESTAMP WITHOUT TIME ZONE
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_daily_updates_report_date ON daily_updates (report_date)",
        "CREATE INDEX IF NOT EXISTS ix_daily_updates_worker ON daily_updates (worker_id)",
        "CREATE INDEX IF NOT EXISTS ix_daily_updates_machine ON daily_updates (machine_id)",
    ]
    for sql in sqls:
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
        except Exception:
            pass


_ensure_table()


def _row(u: DailyUpdate) -> dict:
    return {
        "id": u.id,
        "worker_id": u.worker_id,
        "worker_name": u.worker_name,
        "machine_id": u.machine_id,
        "report_date": u.report_date,
        "raw_text": u.raw_text,
        "optimized_text": u.optimized_text,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "updated_at": u.updated_at.isoformat() if u.updated_at else None,
    }


def _optimize_with_gemini(raw: str, machine_id: Optional[str] = None) -> str:
    """
    Rewrite the worker's note for clarity and structure.
    Must not invent facts, numbers, or work that was not mentioned.
    """
    text_in = (raw or "").strip()
    if not text_in:
        raise HTTPException(status_code=400, detail="Nothing to optimize — write or speak an update first.")

    if not GEMINI_API_KEY:
        # Graceful fallback when key is missing in local/dev
        return text_in

    machine_line = f" Machine mentioned: {machine_id}." if machine_id else ""
    prompt = f"""You are helping a factory worker write a clear daily work update for their supervisor.

Rules:
- Use ONLY facts, observations, and actions present in the worker's text.
- Do NOT invent measurements, times, machine states, people, or outcomes.
- Do NOT add suggestions, recommendations, or advice the worker did not write.
- Improve grammar, spelling, and structure into short clear sentences or bullets.
- Keep the same language the worker used (English, Hindi, etc.).
- Keep it concise (about the same length or slightly shorter).
- Output ONLY the polished update text — no title, no preamble, no markdown fences.
{machine_line}

Worker text:
\"\"\"{text_in}\"\"\"
"""

    try:
        from google import genai

        client = genai.Client(api_key=GEMINI_API_KEY)
        model = LLM_MODEL or "gemini-2.0-flash"
        resp = client.models.generate_content(model=model, contents=prompt)
        out = (getattr(resp, "text", None) or "").strip()
        if not out:
            return text_in
        # Strip accidental code fences
        if out.startswith("```"):
            lines = out.split("\n")
            out = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:]).strip()
        return out or text_in
    except Exception as e:
        # Never block the worker — return original text
        return text_in


@router.post("/optimize")
def optimize_daily_update(
    req: OptimizeDailyUpdateRequest,
    worker: dict = Depends(require_worker),
):
    optimized = _optimize_with_gemini(req.text, req.machine_id)
    return {
        "optimized_text": optimized,
        "raw_text": (req.text or "").strip(),
    }


@router.post("")
def submit_daily_update(
    req: SubmitDailyUpdateRequest,
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
):
    raw = (req.raw_text or "").strip()
    optimized = (req.optimized_text or "").strip()
    if not optimized:
        raise HTTPException(status_code=400, detail="Optimized update text is required.")
    if not raw:
        raw = optimized

    report_date = (req.report_date or "").strip()
    if not report_date:
        report_date = date.today().isoformat()
    else:
        try:
            datetime.strptime(report_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="report_date must be YYYY-MM-DD")

    worker_id = worker["worker_id"]
    row_w = db.query(Worker).filter(Worker.worker_id == worker_id).first()
    worker_name = row_w.name if row_w else worker.get("name")

    now = datetime.utcnow()
    entry = DailyUpdate(
        id=str(uuid.uuid4()),
        worker_id=worker_id,
        worker_name=worker_name,
        machine_id=(req.machine_id or None),
        report_date=report_date,
        raw_text=raw,
        optimized_text=optimized,
        created_at=now,
        updated_at=now,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _row(entry)


@router.get("/my")
def my_daily_updates(
    worker: dict = Depends(require_worker),
    db: Session = Depends(get_db),
    limit: int = Query(30, ge=1, le=100),
):
    rows = (
        db.query(DailyUpdate)
        .filter(DailyUpdate.worker_id == worker["worker_id"])
        .order_by(DailyUpdate.created_at.desc())
        .limit(limit)
        .all()
    )
    return {"updates": [_row(u) for u in rows]}


@admin_router.get("/daily-updates")
def admin_list_daily_updates(
    report_date: Optional[str] = Query(None, description="YYYY-MM-DD single day (default today if no range)"),
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD range start"),
    to_date: Optional[str] = Query(None, description="YYYY-MM-DD range end"),
    machine_id: Optional[str] = Query(None),
    worker_id: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    admin: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    def _parse(d: str, field: str) -> str:
        d = (d or "").strip()
        try:
            datetime.strptime(d, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail=f"{field} must be YYYY-MM-DD")
        return d

    q = db.query(DailyUpdate)

    if from_date or to_date:
        if from_date:
            q = q.filter(DailyUpdate.report_date >= _parse(from_date, "from_date"))
        if to_date:
            q = q.filter(DailyUpdate.report_date <= _parse(to_date, "to_date"))
        day_label = None
    else:
        day = _parse(report_date or date.today().isoformat(), "report_date")
        q = q.filter(DailyUpdate.report_date == day)
        day_label = day

    if machine_id == "__general__":
        q = q.filter(DailyUpdate.machine_id.is_(None))
    elif machine_id:
        q = q.filter(DailyUpdate.machine_id == machine_id)

    if worker_id:
        q = q.filter(DailyUpdate.worker_id == worker_id.strip())

    rows = q.order_by(DailyUpdate.report_date.desc(), DailyUpdate.created_at.desc()).limit(limit).all()

    # Distinct machines in this result set (for filter chips)
    machines = sorted({u.machine_id for u in rows if u.machine_id})
    workers = sorted({u.worker_id for u in rows if u.worker_id})

    return {
        "report_date": day_label,
        "from_date": from_date,
        "to_date": to_date,
        "count": len(rows),
        "machines": machines,
        "workers": workers,
        "updates": [_row(u) for u in rows],
    }