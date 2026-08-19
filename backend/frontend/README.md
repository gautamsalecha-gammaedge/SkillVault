# SkillVault — Frontend

A plain HTML/CSS/JS frontend for the SkillVault FastAPI backend. No build
step, no framework, no bundler — open the files or serve them with any
static file server, and point them at your running backend.

## Structure

```
frontend/
├── index.html          Login: language → role → worker login/register or admin login
├── worker.html          Worker dashboard: Ask a question (chat) + Share a tip (clarifying flow)
├── admin.html            Admin dashboard: pending workers, workers & machines, knowledge review, manuals
├── css/
│   ├── base.css           Design tokens (colors, type, the "status LED" motif), reset
│   ├── components.css      Buttons, inputs, cards, badges, toasts, modals, skeletons
│   ├── login.css
│   ├── worker.css
│   └── admin.css
├── js/
│   ├── i18n.js             Translations for en-IN / hi-IN / mr-IN / ta-IN / ur-IN + apply()
│   ├── api.js               API_BASE + one function per backend endpoint
│   ├── auth.js              Token/session storage in localStorage + route guards
│   ├── toast.js             Toast notifications + confirm() modal
│   ├── login.js
│   ├── worker.js
│   └── admin.js
└── README.md (this file)
```

## Running it

1. Start the FastAPI backend (`uvicorn main:app --reload`), default `http://127.0.0.1:8000`.
2. Serve `frontend/` as static files. Any of these work:
   - `python -m http.server 5500` from inside `frontend/`, then open `http://localhost:5500`
   - VS Code's "Live Server" extension
   - Any static host once you deploy (Netlify, an nginx container next to the API, etc.)
3. Open `index.html` (or the served URL). CORS on the backend is already open to any origin
   (`main.py`), so this works whether you open the file directly, serve it locally, or deploy it
   elsewhere.

### Pointing at a different backend URL

The frontend defaults to `http://127.0.0.1:8000`. To point it at a deployed backend, set it once
from the browser console before loading the app:

```js
localStorage.setItem("sv_api_base", "https://your-backend.example.com");
```

(Or edit the `API_BASE` fallback at the top of `js/api.js` if you'd rather bake it in at deploy
time.)

## Notes on the clarifying-agent ("one-pass") flow

`worker.js` implements this exactly as specced:

1. Worker writes a tip → `POST /Knowledge/add-knowledge/check` with `round: 1`.
2. If `complete === false`, the backend's single clarifying question is shown. The worker answers
   once, and that's combined with the original tip and re-checked with `round: 2` — the backend
   forces `complete: true` at that point, so there's never a second question.
3. Either way, `polished_text` is always shown in an editable textarea before saving.
4. `POST /Knowledge/add-knowledge` saves the (possibly edited) text, and the returned
   `spoken_confirmation` gets a "Speak" button via `POST /speak`.

## Voice input

The mic button on the Ask panel uses the browser's `SpeechRecognition` API (Chrome/Edge/Safari on
supported platforms) to fill the question box. It's a progressive enhancement — browsers without
support get a toast explaining voice input isn't available, and typing still works normally.

## i18n

All UI strings live in `js/i18n.js` as one object per language. `applyLang()` walks the DOM for
`data-i18n` / `data-i18n-ph` / `data-i18n-aria` attributes on page load and on language change.
Urdu (`ur-IN`) flips `<html dir="rtl">` automatically. The language selected at login is reused as
the `language_code` sent to `/speak` and `/Knowledge/add-knowledge`, so spoken confirmations and
answers come back in the same language.

## What's intentionally out of scope

- No build tooling (webpack/vite) — kept it framework-free per the "simple to deploy alongside
  FastAPI" requirement.
- No TypeScript, since there's no bundler to compile it — the JS is kept small, commented where
  non-obvious, and split by page/responsibility instead.
