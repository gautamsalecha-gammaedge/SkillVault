"""
SkillVault outbound mail — separate templates per purpose so workers
never get a "password reset" subject for a welcome or verify message.

Spam tips applied:
- Clear From name + address
- Plain text (no heavy HTML)
- Honest subjects (no ALL CAPS / urgency spam words)
- Short body, no tracking links
"""
from __future__ import annotations

import os
import smtplib
import uuid
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid


def smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_FROM"))


def _from_header() -> str:
    addr = os.environ.get("SMTP_FROM", "").strip()
    name = os.environ.get("SMTP_FROM_NAME", "SkillVault").strip() or "SkillVault"
    return formataddr((name, addr))


def _send(to_email: str, subject: str, body: str) -> bool:
    if not smtp_configured():
        print(f"[SkillVault mail] DEV (no SMTP) → {to_email}\nSubject: {subject}\n{body}\n")
        return False

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    use_tls = os.environ.get("SMTP_TLS", "1") != "0"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = _from_header()
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=(os.environ.get("SMTP_FROM") or "skillvault.local").split("@")[-1])
    msg["Reply-To"] = os.environ.get("SMTP_REPLY_TO") or os.environ.get("SMTP_FROM", "")
    msg["X-Auto-Response-Suppress"] = "All"
    msg.set_content(body)

    with smtplib.SMTP(host, port, timeout=25) as smtp:
        if use_tls:
            smtp.starttls()
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)
    return True


def send_welcome_email(to_email: str, worker_id: str, name: str = "") -> bool:
    """After registration — Worker ID notice (not an OTP / not a reset)."""
    who = (name or "there").strip() or "there"
    subject = f"Welcome to SkillVault — your Worker ID is {worker_id}"
    body = (
        f"Hi {who},\n\n"
        f"Your SkillVault registration was received.\n\n"
        f"Your Worker ID: {worker_id}\n\n"
        f"Save this ID — you will use it to sign in after a supervisor approves your account.\n\n"
        f"If you did not register for SkillVault, you can ignore this message.\n\n"
        f"— SkillVault\n"
    )
    return _send(to_email, subject, body)


def send_verify_email_otp(to_email: str, code: str) -> bool:
    """OTP to confirm an email address (register or profile)."""
    subject = "SkillVault — confirm your email"
    body = (
        f"Use this code to confirm your email on SkillVault:\n\n"
        f"  {code}\n\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you did not request this, you can ignore this message.\n\n"
        f"— SkillVault\n"
    )
    return _send(to_email, subject, body)


def send_password_reset_otp(to_email: str, code: str, worker_id: str = "") -> bool:
    """OTP for forgot-password email path only."""
    wid = f" for Worker ID {worker_id}" if worker_id else ""
    subject = "SkillVault — password reset code"
    body = (
        f"You requested a password reset{wid}.\n\n"
        f"Your reset code:\n\n"
        f"  {code}\n\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you did not request a reset, ignore this message. "
        f"Your password will stay the same.\n\n"
        f"— SkillVault\n"
    )
    return _send(to_email, subject, body)


def send_otp_email(to_email: str, code: str, purpose: str, worker_id: str = "") -> bool:
    """
    Router helper — maps purpose to the correct template.
    purpose: verify_email | reset_password | worker_id_notice (welcome)
    For worker_id_notice, `code` is the worker_id string.
    """
    purpose = (purpose or "").strip()
    if purpose == "worker_id_notice" or purpose == "welcome":
        return send_welcome_email(to_email, code, name="")
    if purpose == "verify_email":
        return send_verify_email_otp(to_email, code)
    if purpose == "reset_password":
        return send_password_reset_otp(to_email, code, worker_id=worker_id)
    # Fallback — still not labeled as reset if unknown
    subject = "SkillVault message"
    body = f"{code}\n\n— SkillVault\n"
    return _send(to_email, subject, body)