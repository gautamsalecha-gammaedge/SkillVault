"""
SkillVault outbound mail — product-quality multipart templates.

Visual language matches the frontend "Warm Studio" theme:
  cream surfaces (#f7f4ef / #fffcf8), teal signal (#0f9d8a),
  warm ink (#1c1917), soft stone borders.

Deliverability practices:
  - multipart/alternative (plain text + HTML always)
  - honest subjects, no ALL-CAPS / urgency spam words
  - proper Message-ID, Date, From display name, Reply-To
  - no tracking pixels, no external CSS, no heavy images
  - short, human body copy

Env (same as before):
  SMTP_HOST, SMTP_FROM  (required to actually send)
  SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_TLS
  SMTP_FROM_NAME (default SkillVault), SMTP_REPLY_TO
  APP_BASE_URL (optional — login button / footer link)
"""
from __future__ import annotations

import os
import smtplib
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid


# Brand tokens (aligned with frontend-v2/src/index.css)
TEAL = "#0f9d8a"
TEAL_DIM = "#0c7d6e"
AMBER = "#d97706"
INK = "#1c1917"
MUTED = "#78716c"
CREAM = "#f7f4ef"
SURFACE = "#fffcf8"
LINE = "#ddd4c8"
SURFACE_2 = "#f0ebe3"


def smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_FROM"))


def _from_header() -> str:
    addr = os.environ.get("SMTP_FROM", "").strip()
    name = os.environ.get("SMTP_FROM_NAME", "SkillVault").strip() or "SkillVault"
    return formataddr((name, addr))


def _app_name() -> str:
    return os.environ.get("SMTP_FROM_NAME", "SkillVault").strip() or "SkillVault"


def _base_url() -> str:
    return (os.environ.get("APP_BASE_URL") or "").rstrip("/")


def _send(to_email: str, subject: str, text_body: str, html_body: str) -> bool:
    if not smtp_configured():
        print(
            f"[SkillVault mail] DEV (no SMTP) → {to_email}\n"
            f"Subject: {subject}\n"
            f"--- plain ---\n{text_body}\n"
        )
        return False

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    use_tls = os.environ.get("SMTP_TLS", "1") != "0"
    domain = (os.environ.get("SMTP_FROM") or "skillvault.local").split("@")[-1]

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = _from_header()
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=domain)
    msg["Reply-To"] = os.environ.get("SMTP_REPLY_TO") or os.environ.get("SMTP_FROM", "")
    msg["X-Auto-Response-Suppress"] = "All"
    msg["X-Mailer"] = "SkillVault"
    msg["List-Unsubscribe"] = f"<mailto:{os.environ.get('SMTP_FROM', '')}?subject=unsubscribe>"

    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(host, port, timeout=25) as smtp:
        if use_tls:
            smtp.starttls()
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)
    return True


# ---------------------------------------------------------------------------
# Layout primitives
# ---------------------------------------------------------------------------

def _shell(title: str, preheader: str, inner_html: str) -> str:
    """Warm Studio card on cream canvas — mirrors landing page feel."""
    brand = _app_name()
    year = datetime.utcnow().year
    base = _base_url()
    brand_link = (
        f'<a href="{base}" style="color:{MUTED};text-decoration:none;font-weight:600;">{brand}</a>'
        if base
        else f'<span style="color:{MUTED};font-weight:600;">{brand}</span>'
    )

    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:{CREAM};-webkit-font-smoothing:antialiased;">
  <!-- preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:{CREAM};">
    {preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:{CREAM};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">

          <!-- Brand mark -->
          <tr>
            <td align="center" style="padding:0 0 28px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:40px;height:40px;border-radius:11px;background-color:{TEAL};text-align:center;vertical-align:middle;">
                    <span style="display:inline-block;font-size:18px;font-weight:800;color:#ffffff;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;line-height:40px;">S</span>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <div style="font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:{INK};letter-spacing:-0.02em;line-height:1.2;">
                      {brand}
                    </div>
                    <div style="font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;color:{MUTED};margin-top:2px;">
                      The factory&rsquo;s collective brain
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:{SURFACE};border:1px solid {LINE};border-radius:16px;overflow:hidden;">
              <!-- teal top accent -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:4px;background-color:{TEAL};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:36px 32px 32px 32px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:{INK};font-size:15px;line-height:1.65;">
                    {inner_html}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 8px 8px 8px;text-align:center;">
              <p style="margin:0 0 8px 0;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:{MUTED};">
                Sent by {brand_link} &middot; Shop-floor knowledge assistant
              </p>
              <p style="margin:0;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#a8a29e;">
                If you didn&rsquo;t expect this email, you can ignore it.<br />
                &copy; {year} {brand}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _otp_block(code: str) -> str:
    digits = "".join(ch for ch in (code or "") if ch.isalnum())
    spaced = "  ".join(digits) if digits else (code or "")
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:{SURFACE_2};border:1px solid {LINE};border-radius:14px;">
        <tr>
          <td style="padding:22px 36px;text-align:center;">
            <div style="font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:{MUTED};margin-bottom:10px;">
              One-time code
            </div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:0.22em;color:{INK};line-height:1.2;">
              {spaced}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
"""


def _id_card(label: str, value: str) -> str:
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:{SURFACE_2};border:1px solid {LINE};border-radius:12px;padding:18px 20px;">
      <div style="font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:{MUTED};margin-bottom:8px;">
        {label}
      </div>
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:22px;font-weight:700;color:{TEAL_DIM};letter-spacing:0.04em;">
        {value}
      </div>
    </td>
  </tr>
</table>
"""


def _pill(text: str) -> str:
    return f"""
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
  <tr>
    <td style="background-color:rgba(15,157,138,0.10);border:1px solid rgba(15,157,138,0.22);border-radius:999px;padding:6px 14px;">
      <span style="font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;color:{TEAL_DIM};">
        {text}
      </span>
    </td>
  </tr>
</table>
"""


def _cta(label: str, url: str) -> str:
    if not url:
        return ""
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;">
  <tr>
    <td align="center">
      <a href="{url}" style="display:inline-block;background-color:{TEAL};color:#ffffff;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;box-shadow:0 8px 20px -8px rgba(15,157,138,0.45);">
        {label}
      </a>
    </td>
  </tr>
</table>
"""


def _success_banner(text: str) -> str:
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px 18px;">
      <span style="font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#047857;">
        {text}
      </span>
    </td>
  </tr>
</table>
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def send_welcome_email(to_email: str, worker_id: str, name: str = "") -> bool:
    who = (name or "").strip() or "there"
    brand = _app_name()
    subject = f"Welcome to {brand} — your Worker ID is {worker_id}"

    text = (
        f"Hi {who},\n\n"
        f"Thanks for joining {brand}.\n\n"
        f"Your Worker ID: {worker_id}\n\n"
        f"Save this ID. You will use it to sign in after a supervisor approves your account.\n\n"
        f"If you did not register, you can ignore this message.\n\n"
        f"— {brand}\n"
    )

    inner = f"""
{_pill("Registration received")}
<p style="margin:0 0 12px 0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:{INK};line-height:1.3;">
  Welcome aboard, {who}
</p>
<p style="margin:0 0 8px 0;color:{MUTED};">
  Your account is set up. One step remains: a supervisor needs to approve you before you can sign in.
</p>
{_id_card("Your Worker ID", worker_id)}
<p style="margin:0;color:{MUTED};font-size:14px;">
  Keep this ID handy — it is how you will log in once approved.
</p>
"""
    html = _shell(subject, f"Your Worker ID is {worker_id}. Save it for sign-in after approval.", inner)
    return _send(to_email, subject, text, html)


def send_verify_email_otp(to_email: str, code: str) -> bool:
    brand = _app_name()
    subject = f"Confirm your email for {brand}"

    text = (
        f"Confirm your email on {brand} with this code:\n\n"
        f"  {code}\n\n"
        f"It expires in 10 minutes.\n\n"
        f"If you did not request this, ignore this message.\n\n"
        f"— {brand}\n"
    )

    inner = f"""
{_pill("Email verification")}
<p style="margin:0 0 12px 0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:{INK};line-height:1.3;">
  Confirm your email
</p>
<p style="margin:0 0 4px 0;color:{MUTED};">
  Enter this code in {brand} to verify your address.
</p>
{_otp_block(code)}
<p style="margin:0;color:{MUTED};font-size:13px;">
  Expires in <strong style="color:{INK};">10 minutes</strong>. If you did not request this, you can ignore the email.
</p>
"""
    html = _shell(subject, f"Your verification code is {code}", inner)
    return _send(to_email, subject, text, html)


def send_password_reset_otp(to_email: str, code: str, worker_id: str = "") -> bool:
    brand = _app_name()
    subject = f"Your {brand} password reset code"
    wid_plain = f" for Worker ID {worker_id}" if worker_id else ""
    wid_html = (
        f' for Worker ID <strong style="color:{INK};">{worker_id}</strong>'
        if worker_id
        else ""
    )

    text = (
        f"You requested a password reset{wid_plain}.\n\n"
        f"Your code: {code}\n\n"
        f"Expires in 10 minutes.\n\n"
        f"If you did not request a reset, ignore this message — your password stays the same.\n\n"
        f"— {brand}\n"
    )

    inner = f"""
{_pill("Password reset")}
<p style="margin:0 0 12px 0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:{INK};line-height:1.3;">
  Reset your password
</p>
<p style="margin:0 0 4px 0;color:{MUTED};">
  Use this code to set a new password{wid_html}.
</p>
{_otp_block(code)}
<p style="margin:0;color:{MUTED};font-size:13px;">
  Expires in <strong style="color:{INK};">10 minutes</strong>. Didn&rsquo;t request this? Ignore the email — nothing changes.
</p>
"""
    html = _shell(subject, f"Password reset code: {code}", inner)
    return _send(to_email, subject, text, html)


def send_account_approved_email(to_email: str, worker_id: str, name: str = "") -> bool:
    who = (name or "").strip() or "there"
    brand = _app_name()
    base = _base_url()
    subject = f"You're approved — sign in to {brand}"

    text = (
        f"Hi {who},\n\n"
        f"Your {brand} account is approved.\n\n"
        f"Worker ID: {worker_id}\n\n"
        f"You can sign in now and start using the app.\n\n"
        f"— {brand}\n"
    )

    inner = f"""
{_pill("Account approved")}
<p style="margin:0 0 12px 0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:{INK};line-height:1.3;">
  You&rsquo;re cleared for the floor, {who}
</p>
<p style="margin:0 0 8px 0;color:{MUTED};">
  A supervisor approved your account. You can sign in with your Worker ID and start capturing knowledge.
</p>
{_id_card("Your Worker ID", worker_id)}
{_cta(f"Open {brand}", base)}
"""
    html = _shell(subject, f"Approved. Your Worker ID is {worker_id}.", inner)
    return _send(to_email, subject, text, html)


def send_password_changed_email(to_email: str, name: str = "", worker_id: str = "") -> bool:
    who = (name or "").strip() or "there"
    brand = _app_name()
    subject = f"Your {brand} password was changed"
    wid_plain = f" (Worker ID {worker_id})" if worker_id else ""
    wid_html = (
        f' (Worker ID <strong style="color:{INK};">{worker_id}</strong>)'
        if worker_id
        else ""
    )

    text = (
        f"Hi {who},\n\n"
        f"The password for your {brand} account{wid_plain} was changed successfully.\n\n"
        f"If this was you, no action needed.\n"
        f"If it wasn't, reset your password and contact your supervisor.\n\n"
        f"— {brand}\n"
    )

    inner = f"""
{_pill("Security notice")}
<p style="margin:0 0 12px 0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:{INK};line-height:1.3;">
  Password updated
</p>
<p style="margin:0 0 8px 0;color:{MUTED};">
  Hi {who} — the password on your {brand} account{wid_html} was changed.
</p>
{_success_banner("Password changed successfully")}
<p style="margin:0 0 6px 0;color:{MUTED};font-size:14px;">
  If you made this change, you&rsquo;re all set.
</p>
<p style="margin:0;color:{MUTED};font-size:14px;">
  If you <strong style="color:{INK};">did not</strong>, reset your password right away and tell your supervisor.
</p>
"""
    html = _shell(subject, "Your password was changed. If this wasn't you, act now.", inner)
    return _send(to_email, subject, text, html)


def send_otp_email(to_email: str, code: str, purpose: str, worker_id: str = "") -> bool:
    purpose = (purpose or "").strip()
    if purpose in ("worker_id_notice", "welcome"):
        return send_welcome_email(to_email, code, name="")
    if purpose == "verify_email":
        return send_verify_email_otp(to_email, code)
    if purpose == "reset_password":
        return send_password_reset_otp(to_email, code, worker_id=worker_id)

    brand = _app_name()
    subject = f"{brand} message"
    text = f"{code}\n\n— {brand}\n"
    inner = f'<p style="margin:0;color:{MUTED};">{code}</p>'
    return _send(to_email, subject, text, _shell(subject, code[:80], inner))