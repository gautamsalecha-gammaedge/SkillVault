"""
rag/knowledge_review.py

Before a worker's tip is stored, one model call does:

1. COMPLETENESS — is this tip specific enough for another worker on this
   machine (situation + what to do / what to watch for)?
2. CROSS-QUESTION — if incomplete, ask ONE sharp, tip-specific question
   (not a generic "please add more detail").
3. POLISH — light grammar only; never change facts.

Round cap is enforced by routers/knowledge.py + the frontend.
This module always reports what the model thinks for the current text.
"""

from __future__ import annotations

import json

from rag.llm_provider import generate_text

REVIEW_AND_POLISH_PROMPT = """You are a senior shop-floor coworker reviewing a tip for machine {machine_id}.
Another worker must be able to use this tip alone during a real job.

Worker's language: {language_code}. Write any question in that exact language and script.

This is review round {round} of up to 3 clarifying rounds.
Already collected tip text (may include earlier answers):
\"\"\"{text}\"\"\"

Do three things:

1) COMPLETENESS
Mark complete=true ONLY if the tip clearly covers BOTH:
  - the situation / symptom / when it applies on THIS machine, AND
  - the concrete action, setting, check, or outcome (what to do / expect).
If either is vague, missing, or only general advice, mark complete=false.

Do NOT mark complete just because the tip is short. Short + specific can be complete.
Do NOT mark incomplete just to be thorough if a coworker could already act on it.

2) CROSS-QUESTION (only when complete=false)
Ask exactly ONE short, conversational question about the SINGLE most important gap.
The question MUST be specific to THIS tip and THIS machine — reference what they already said.
Good examples:
  - "You said the spindle overheats on long runs — after how many minutes, and what did you change?"
  - "Which alarm code or display message did you see when that happened?"
  - "What RPM / feed did you settle on after the fix?"
Bad (too general — never use these):
  - "Can you add more details?"
  - "What else should we know?"
  - "Please explain the problem."

Prefer cross-checks that pin down: numbers, part names, alarm codes, sequence of steps,
what failed vs what worked, safety constraint, or how they knew it was fixed.

3) POLISH
polished_text = same facts, cleaner grammar/spelling only. Do not invent details.

Respond with ONLY this JSON (no markdown):
{{"complete": true or false, "question": "<one specific question or null>", "polished_text": "<cleaned tip>"}}
"""


def review_knowledge(
    text: str,
    machine_id: str,
    language_code: str = "en-IN",
    round: int = 1,
) -> dict:
    """
    Returns {"complete": bool, "question": str|None, "polished_text": str, "language_code": str}.
    """
    prompt = REVIEW_AND_POLISH_PROMPT.format(
        text=text,
        machine_id=machine_id,
        language_code=language_code,
        round=max(1, int(round or 1)),
    )

    try:
        raw = generate_text(prompt).strip()
    except Exception:
        return {
            "complete": True,
            "question": None,
            "polished_text": text,
            "language_code": language_code,
        }

    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        result = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return {
            "complete": True,
            "question": None,
            "polished_text": text,
            "language_code": language_code,
        }

    complete = bool(result.get("complete", True))
    question = result.get("question")
    if complete:
        question = None
    elif question is not None:
        question = str(question).strip() or None
        if not question:
            complete = True

    return {
        "complete": complete,
        "question": question,
        "polished_text": result.get("polished_text") or text,
        "language_code": language_code,
    }