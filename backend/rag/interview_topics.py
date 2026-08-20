"""
rag/interview_topics.py

Builds the topic bank for a Tacit Knowledge Capture interview - the
ordered list of subjects the AI will guide a senior worker through
(safety, troubleshooting, maintenance, etc).

IMPORTANT: this interview exists to capture what the manual does NOT
say. The manual is already fully searchable via /ask (rag/chunking.py,
ingest.py) - re-asking documented facts here would just duplicate that
and waste the worker's time. So the machine's manual chunks are pulled
in ONLY as grounding context - so the AI knows real part names, symptoms,
and procedures and can phrase specific questions instead of generic
ones - but the prompt explicitly steers every question toward personal,
experience-based knowledge: things a new worker would only learn by
being shown, workarounds nobody wrote down, warning signs the manual
doesn't mention, judgment calls that come from years on this exact
machine. That's the whole point of interviewing a senior worker instead
of just re-reading the manual.

Falls back to a fixed generic bank if the machine has no manual ingested
yet, or if the LLM call/parse fails - the interview should never be
blocked by this step.
"""

import json

from rag.chroma_store import collection
from rag.llm_provider import generate_text

FALLBACK_TOPICS = [
    {
        "topic_key": "safety",
        "title": "Safety",
        "seed_question": "Is there a safety habit or warning sign you've learned on this machine that isn't written in any manual - something you'd only know from experience?",
    },
    {
        "topic_key": "troubleshooting",
        "title": "Troubleshooting",
        "seed_question": "Tell me about a problem on this machine that isn't in the manual - something you figured out yourself, or learned from someone else on the floor.",
    },
    {
        "topic_key": "maintenance",
        "title": "Maintenance & Checks",
        "seed_question": "Is there anything you check on this machine that isn't part of the official maintenance schedule, but you've learned matters anyway?",
    },
    {
        "topic_key": "changeover",
        "title": "Setup & Changeover",
        "seed_question": "Is there a trick to setting up or changing over this machine that makes it faster or safer, that isn't written down anywhere?",
    },
    {
        "topic_key": "escalation",
        "title": "When to Escalate",
        "seed_question": "How do you tell the difference between something you can fix yourself and something that needs a supervisor or specialist - what's the judgment call there?",
    },
]

# How many manual chunks to pull as grounding context. Manuals can have
# far more chunks than this - we only need enough to know real part
# names/procedures to phrase specific questions, not the whole document
# (keeps the prompt small and fast, and this only runs once per
# interview, at session start).
MAX_CONTEXT_CHUNKS = 40
MAX_CONTEXT_CHARS = 12000

TOPIC_BANK_PROMPT = """You are preparing a guide for interviewing a senior factory worker to capture their TACIT knowledge about a specific machine - the experience-based knowledge that lives in their head, not in any document - so it isn't lost when they leave or change shifts.

Below is context extracted from this machine's manual (machine_id: {machine_id}). This manual is ALREADY fully searchable elsewhere in the system - do NOT design questions that just ask the worker to repeat what it already says. Use it ONLY to learn real part names, symptoms, and procedures, so your questions sound specific and informed rather than generic - not as a source of things to ask about directly.

---
{manual_context}
---

Produce 4 to 6 interview topics tailored to THIS machine. For each topic, write a seed_question that targets knowledge that ONLY comes from hands-on experience and would NOT already be answered by reading the manual - examples of the kind of thing to target: undocumented failure patterns or early warning signs, workarounds or shortcuts nobody wrote down, judgment calls about when to escalate vs handle it yourself, quirks specific to this machine or this particular unit, things a new worker would only learn by being shown. Cover a mix along the lines of: safety judgment calls, undocumented troubleshooting, maintenance habits beyond the official schedule, setup/changeover tricks, and escalation judgment - adapted to what this machine actually is.

Every seed_question must make it clear you're asking for something beyond the manual - phrase it the way a curious coworker would, e.g. "...that isn't written down anywhere" or "...that you only learned from experience."

Respond with ONLY a JSON array, no other text, no markdown formatting, in this exact shape:
[{{"topic_key": "<short_snake_case_id>", "title": "<short topic title>", "seed_question": "<one open, conversational opening question a coworker would ask out loud>"}}]"""


def generate_topic_bank(machine_id: str) -> list[dict]:
    """
    Returns an ordered list of {topic_key, title, seed_question} dicts.
    Grounded in the machine's manual when one has been ingested; falls
    back to FALLBACK_TOPICS otherwise, or if the LLM call fails / the
    response can't be parsed as a clean list of topics.
    """
    manual_chunks = collection.get(
        where={
            "$and": [
                {"machine_id": machine_id},
                {"source_type": "manual"},
            ]
        },
        limit=MAX_CONTEXT_CHUNKS,
    )

    if not manual_chunks["ids"]:
        return FALLBACK_TOPICS

    manual_context = "\n\n".join(manual_chunks["documents"])
    if len(manual_context) > MAX_CONTEXT_CHARS:
        manual_context = manual_context[:MAX_CONTEXT_CHARS]

    prompt = TOPIC_BANK_PROMPT.format(machine_id=machine_id, manual_context=manual_context)

    try:
        raw = generate_text(prompt).strip()
    except Exception:
        return FALLBACK_TOPICS

    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        topics = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return FALLBACK_TOPICS

    if not isinstance(topics, list) or not topics:
        return FALLBACK_TOPICS

    cleaned = []
    for t in topics:
        if isinstance(t, dict) and t.get("topic_key") and t.get("title") and t.get("seed_question"):
            cleaned.append({
                "topic_key": str(t["topic_key"]),
                "title": str(t["title"]),
                "seed_question": str(t["seed_question"]),
            })

    return cleaned or FALLBACK_TOPICS