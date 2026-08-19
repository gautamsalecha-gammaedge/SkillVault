# SkillVault — Frontend (React)

React + Vite rebuild of the SkillVault frontend, replacing the plain
HTML/CSS/JS version (kept at `../frontend-legacy/` for reference only).

## Running it

```
npm install
npm run dev
```

Point at your backend (defaults to `http://127.0.0.1:8000`):

```js
// in browser console, before loading the app
localStorage.setItem("sv_api_base", "https://your-backend.example.com");
```

## What's real vs. not yet possible

Everything wired to a confirmed backend endpoint is fully functional:
login/register, Ask, Add Tip (with the two-round AI clarification flow),
hands-free mode prefs (local), pending-worker approval, worker↔machine
assignment, manual upload/list/delete, and knowledge review
(approve/delete per machine, pending only).

Three screens are honest placeholders rather than faking data, because
the backend doesn't support them yet — see comments at the top of each file:

- **My Tips** (`src/pages/worker/MyTips.jsx`) — no endpoint lists a
  worker's own tip history.
- **Analytics** (`src/pages/admin/Analytics.jsx`) — no aggregation
  endpoint (totals, approval rate, most-asked questions, coverage).
- **Notifications** (`src/pages/worker/Notifications.jsx`) — scope was
  never designed, brief flagged it as open.

Also worth knowing:
- `/ask` doesn't return structured source attribution or a confidence
  score yet (just an answer + a count of chunks used) — `Ask.jsx` shows
  the count, not a fabricated confidence bar.
- `/admin/approve/{id}` doesn't accept edited text — Knowledge Review's
  "Edit" is a preview-only textarea; Approve always uses the original text.
- Dark mode tokens in `src/styles/tokens.css` are my proposal, not
  recovered from any prior work — flagged in that file's header.
- UI text is English-only for now; language selection only affects
  `/speak` and the AI's clarifying-question language. Full translated UI
  (like legacy `js/i18n.js`) is a separate, larger task.
- Offline mode (queue + sync) is explicitly out of scope per the brief —
  it's an architecture task, not a page-building one.

## Structure

```
src/
├── styles/        tokens.css, base.css, components.css
├── lib/           api.js, auth.js, guards.jsx, toast.jsx,
│                  useSpeechRecognition.js, languages.js
├── components/    Stamp, Wordmark, ConfidenceBar, MachineSelect,
│                  TopBar, WorkerLayout, AdminLayout, Placeholder
└── pages/
    ├── Login.jsx
    ├── worker/    Ask, AddTip, MyTips, HandsFree, Notifications, Settings
    └── admin/     PendingWorkers, WorkersMachines, KnowledgeReview,
                   Analytics, Manuals
```
