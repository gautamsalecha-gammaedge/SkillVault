"""
rag/knowledge_review.py

Before a worker's tip gets stored, this does two things in a single
model call (to keep cost/latency down):

1. COMPLETENESS - decides if the tip is specific enough that another
   worker reading it later would know both the situation AND what to
   do, without a follow-up question. Only flags it incomplete if
   something genuinely important is missing - biased toward NOT asking
   when the tip is already reasonably clear.

2. POLISH - lightly cleans up grammar/spelling/clarity only. Never
   changes, adds, or removes facts - a tip that's specific to one
   worker's machine or process stays exactly as true or false as they
   said it. This is wording cleanup, not fact-checking.

The round cap (max clarifying rounds) is enforced by the caller
(routers/knowledge.py), not here - this function always just reports
what the model thinks; routers/knowledge.py decides whether to listen.
"""

import json

from rag.llm_provider import generate_text

REVIEW_AND_POLISH_PROMPT = """You are reviewing a tip a factory worker wants to add to a shared knowledge base for other workers on machine {machine_id}.

Do two things:

1. COMPLETENESS: Decide if this tip is complete enough to be useful on its own - meaning another worker reading it later would understand both what the situation/issue is AND what to actually do about it (or what to expect), without needing to ask a follow-up question. Only flag it as incomplete if something genuinely important is missing. When in doubt, or if the tip is short but already clear, treat it as complete - do not invent problems with a tip that already makes sense.

2. POLISH: Lightly clean up grammar, spelling, and clarity - WITHOUT changing, adding, or removing any facts, details, or claims. The tip may be specific to this worker's exact machine or process, and might differ from what's true elsewhere - keep the original meaning exactly as stated. Only fix how it's written, never what it says.

Tip: "{text}"

Respond with exactly this JSON structure:
{{"complete": true or false, "question": "<one short, specific, conversational question if incomplete, else null>", "polished_text": "<grammar-cleaned version of the tip, same facts>"}}

If asking a question: phrase it the way a helpful coworker would ask out loud, and briefly acknowledge what's already clear before naming the one specific thing that's missing (e.g. "Got it that it's the spindle - but what did you actually do to fix it?"). Ask about only the SINGLE most important missing piece, never more than one question.

Detect the language and script the tip was written in, and write the question (if any) in that same language and script (English stays English; Hindi in Devanagari stays Devanagari; Hinglish - Hindi in Roman letters - stays Hinglish in Roman letters).

Respond with ONLY the JSON object, no other text, no markdown formatting."""


def review_knowledge(text: str, machine_id: str) -> dict:
    """
    Returns {"complete": bool, "question": str|None, "polished_text": str}.
    Always returns a polished_text, regardless of completeness - grammar
    cleanup is independent of whether the content itself needs more detail.
    """
    prompt = REVIEW_AND_POLISH_PROMPT.format(text=text, machine_id=machine_id)

    try:
        raw = generate_text(prompt).strip()
    except Exception:
        # If even the fallback provider fails, don't block the worker -
        # treat as complete and keep their original wording untouched.
        return {"complete": True, "question": None, "polished_text": text}

    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        result = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        # Model didn't return clean JSON - fail safe: complete, original text.
        return {"complete": True, "question": None, "polished_text": text}

    complete = bool(result.get("complete", True))
    return {
        "complete": complete,
        "question": None if complete else result.get("question"),
        "polished_text": result.get("polished_text") or text,
    }