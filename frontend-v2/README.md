# SkillVault — Frontend v2 ("Blueprint")

A complete rebuild of the SkillVault frontend on the same FastAPI backend
(`backend/`, unchanged — no backend edits were made or needed).

## What this is

- **React 19 + Vite + Tailwind v4 + Framer Motion + Recharts**
- A new visual identity ("Blueprint"): dark industrial-navy background with
  a blueprint grid, a teal "signal" accent for knowledge and an amber
  accent for safety/attention, corner-bracket cards borrowed from
  engineering-drawing annotation marks, "Big Shoulders Display" for
  headlines, Inter for body copy, JetBrains Mono for IDs/data.
- A marketing landing page with a custom hero animation ("The Handoff" —
  a voice waveform crystallizing into a knowledge graph).
- A full worker app: Overview dashboard, voice-first Ask AI chat, Safety
  briefings (step-by-step with progress + video), Add a Tip (voice/video,
  AI follow-up review), My Tips, Tacit Knowledge Capture interview (guided
  AI conversation with resume/pause/end), Raise/My Tickets, Settings.
- A full admin console: Analytics (charts), Pending Worker approvals,
  Workers & Machines (assign/unassign, edit/rename worker), Knowledge
  Review (Tips + Interviews tabs, approve/edit/delete, bulk approve),
  Manuals (PDF upload with progress), Safety Measures (drag-to-reorder,
  video attach, completions tracking), Tickets, Profile.
- Every page talks to the **exact same backend contract** as the legacy
  frontend (`frontend/`) — same endpoints, same payload shapes, same
  localStorage session keys, so both frontends can point at the same
  backend during rollout.

## Running it

    cd frontend-v2
    npm install
    npm run dev

By default the app talks to `http://127.0.0.1:8000` (the FastAPI backend
running locally). To point it elsewhere, set it once in the browser console:

    localStorage.setItem('sv_api_base', 'https://your-backend-url')

Start the backend the usual way, from `backend/`:

    uvicorn main:app --reload

## Structure

    src/
      lib/          api.js (full API client), auth.js (session), guards.jsx,
                    useVoiceCapture.js (mic recording + transcription)
      components/   ui.jsx (design system primitives), WorkerLayout,
                    AdminLayout, MicButton, SpeakButton, Toast, PageTransition
      pages/public  Landing, Login, Register
      pages/worker  Overview, Ask, Safety, SafetyBriefing, AddTip, MyTips,
                    Interview, RaiseTicket, MyTickets, Settings
      pages/admin   Analytics, PendingWorkers, WorkersMachines, KnowledgeReview,
                    Manuals, SafetyMeasures, Tickets, Profile

## Notes

- No backend files were modified — this is purely a new frontend.
- The legacy frontend (`frontend/`) is untouched and still works against
  the same backend if you need to compare or roll back.
