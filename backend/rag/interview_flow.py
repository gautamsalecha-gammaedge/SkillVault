"""
rag/interview_flow.py

Core conversational logic for the Tacit Knowledge Capture interview.
Mirrors the shape of rag/knowledge_review.py's completeness check (one
model call doing two jobs at once, to keep latency down for a live
voice conversation) but interview-flavored:

1. COMPLETENESS - is this answer enough to stand alone as a knowledge
   entry, or does it need one follow-up? Biased toward NOT asking a
   follow-up - this is a conversation with someone giving up their
   time, not an interrogation. When a follow-up IS needed, it's aimed
   at surfacing personal, firsthand detail rather than just asking the
   worker to repeat themselves - see EVALUATE_ANSWER_PROMPT. The
   follow-up ROUND CAP is enforced by the caller (routers/interview.py),
   same division of responsibility as knowledge_review.py.

2. INSIGHT - a distilled, third-person knowledge-base entry pulled from
   the answer, ready to push into the same Chroma collection every
   other tip lives in (source_type "tacit_interview" instead of
   "worker_input" - see routers/interview.py). Null if the answer had
   nothing usable, OR if it was purely generic/manual-level information
   with no experience-based detail - the whole point of this interview
   is capturing what ISN'T already in the manual.

generate_acknowledgement() produces the short spoken/captioned line
between turns ("Thanks Ramesh, that's really useful.") that makes the
interview feel like a live back-and-forth rather than a form - if this
call fails for any reason, a plain template is used instead so it never
blocks the interview from moving on.
"""

import json

from rag.llm_provider import generate_text

EVALUATE_ANSWER_PROMPT = """You are conducting a warm, respectful voice interview with an experienced factory worker to capture TACIT knowledge that would otherwise be lost when they leave or change shifts - the kind of thing that only lives in their head, not in the machine's manual (which is already fully documented and searchable elsewhere in the system). The interview is about machine {machine_id}, currently on the topic "{topic_title}".

The worker's spoken language is: {language_code}. Write any follow-up question in that exact language and script - do not switch languages or transliterate.

Question just asked: "{question_text}"
Worker's answer: "{answer_text}"

Do two things:

1. COMPLETENESS: decide if this answer already gives another worker enough to act on later - both the situation (what happens, on what part, under what conditions) AND what to actually do about it. Be biased toward NOT asking a follow-up if the answer is already reasonably clear, or if the worker seems to be wrapping up / has nothing more to add - this is a conversation, not an interrogation. If the answer only restates something generic or manual-level with no personal detail, the follow-up should gently dig for what they specifically noticed or learned firsthand ("what made you realize that?", "how did you figure that out?") - not just ask them to elaborate in general.

2. INSIGHT: write a short, clean, third-person knowledge-base entry capturing what's useful in this answer - written the way it would appear in a shared tips list for other workers, in English regardless of the worker's spoken language, in 1-3 sentences. Never invent facts not present in the answer. Set insight to null if the answer has genuinely nothing useful yet ("I don't know", "nothing comes to mind") OR if it's purely generic/textbook information with no experience-based detail in it - a tip worth keeping should reflect something this specific worker learned from doing the job, not something anyone could read in a manual.

Respond with ONLY this JSON object, no other text, no markdown formatting:
{{"complete": true or false, "followup_question": "<one short, specific, conversational follow-up if incomplete, else null>", "insight": "<distilled knowledge-base entry, or null>"}}

If asking a follow-up: phrase it the way a curious, respectful coworker would ask out loud, briefly acknowledging what they already said before asking for the one missing piece. Never ask more than one question."""


def evaluate_answer(
    machine_id: str,
    topic_title: str,
    question_text: str,
    answer_text: str,
    language_code: str = "en-IN",
) -> dict:
    """
    Returns {"complete": bool, "followup_question": str|None, "insight": str|None}.
    Fails safe on any error: treats the answer as complete with no
    insight extracted, rather than blocking the interview.
    """
    prompt = EVALUATE_ANSWER_PROMPT.format(
        machine_id=machine_id,
        topic_title=topic_title,
        question_text=question_text,
        answer_text=answer_text,
        language_code=language_code,
    )

    try:
        raw = generate_text(prompt).strip()
    except Exception:
        return {"complete": True, "followup_question": None, "insight": None}

    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        result = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return {"complete": True, "followup_question": None, "insight": None}

    complete = bool(result.get("complete", True))
    return {
        "complete": complete,
        "followup_question": None if complete else result.get("followup_question"),
        "insight": result.get("insight") or None,
    }


ACK_PROMPT = """A factory worker named {worker_name} just answered a question in a voice interview about machine {machine_id}. Write ONE short, warm, natural acknowledgement (5-12 words) a respectful interviewer would say out loud before moving on - e.g. thanking them or briefly affirming what they shared. Use their name naturally. Write it in this exact language/script: {language_code}.

Respond with ONLY the acknowledgement sentence - no quotes, no other text."""


def generate_acknowledgement(worker_name: str, machine_id: str, language_code: str = "en-IN") -> str:
    """
    Short spoken/captioned acknowledgement played between turns. Falls
    back to a plain template on any failure, so a hiccup here never
    blocks the interview from advancing to the next question.
    """
    prompt = ACK_PROMPT.format(worker_name=worker_name, machine_id=machine_id, language_code=language_code)
    try:
        text = generate_text(prompt).strip().strip('"')
        if text:
            return text
    except Exception:
        pass
    return f"Thanks, {worker_name}."