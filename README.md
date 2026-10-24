# SubNexa

English → Sinhala subtitle studio. Upload an `.srt`, pick a translation style, and export Sinhala subtitles while every timestamp stays untouched.

SubNexa is split into a **FastAPI** translation backend and a **Next.js** frontend. Translation runs through Google Gemini by default, with optional Cloudflare Workers AI and CodeCraft failover paths.

## Features

- **SRT in, SRT/ASS out** — cue numbers and timings are preserved exactly.
- **Translation styles** — `natural` (default), `casual`, and `formal` Sinhala.
- **Streaming progress** — server-sent events report batch progress; interrupted jobs resume from stored progress.
- **Adaptive batching** — batch size adapts to dialogue length and recent reliability (`adaptive-v3.3-targeted`), with partial-batch retry instead of redoing the whole job.
- **Glossary engine** — per-project rules with `never_translate` and `custom_translation` modes, case sensitivity, token masking, and preview. Built-in presets for Sci-Fi/Marvel, Anime, and Sri Lankan places.
- **Provider failover** — Gemini primary, Cloudflare Workers AI backup, optional CodeCraft fallback for transient outages and rate limits.
- **User-owned Gemini keys** — optional Google OAuth flow stores a user's key server-side, encrypted at rest, in SQLite. No tokens are returned to the browser.
- **Themes** — several frontend skins (`subnexa.css`, `subnexa-v43.css`, `subnexa-compact-ui.css`, `subnexa-noir.css`).

## Tech stack

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 16.4, React 19.3, TypeScript, Tailwind CSS 4 |
| Backend | Python, FastAPI, Uvicorn, Pydantic |
| Translation | Google GenAI (Gemini), Cloudflare Workers AI, CodeCraft (OpenAI-compatible) |
| Storage | SQLite (user sessions/keys), local JSON progress store |

## Project structure

```
.
├── backend/
│   ├── main.py                  # FastAPI app, SRT parsing, adaptive batching, endpoints
│   ├── translator.py            # Gemini translation, batching, provider routing
│   ├── cloudflare_subnexa.py    # Cloudflare Workers AI client
│   ├── subnexa_failover.py      # Gemini -> Cloudflare request/job failover
│   ├── codecraft_fallback.py    # Optional OpenAI-compatible backup provider
│   ├── glossary_engine.py       # Glossary parsing, masking, preview
│   ├── progress_store.py        # Resume-able translation progress
│   ├── subtitle_export.py       # SRT/ASS rendering and download names
│   ├── subnexa_auth.py          # Google OAuth + encrypted user key storage
│   └── tests/
└── frontend/
    ├── app/                     # Next.js App Router, styles, subtitle studio logic
    └── components/              # Account dock, Google account, provider status
```

## Getting started

### 1. Backend

Requires Python 3.10+.

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate

pip install fastapi "uvicorn[standard]" python-multipart srt google-genai python-dotenv requests cryptography itsdangerous pydantic
```

Create `backend/.env` (see [Environment variables](#environment-variables)) and start the API:

```bash
uvicorn main:app --reload --port 8000
```

Health check: <http://localhost:8000/health>

### 2. Frontend

Requires Node.js 20+.

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUBNEXA_API_URL=http://localhost:8000
```

Then run:

```bash
npm run dev
```

Open <http://localhost:3000>.

## Environment variables

Backend reads `backend/.env`. All keys stay server-side.

| Variable | Required | Description |
| --- | --- | --- |
| `SUBNEXA_AI_PROVIDER` | No | `gemini` (default), `cloudflare`, or `gemini_cloudflare` (Gemini primary + Cloudflare backup). |
| `GEMINI_API_KEY` | Yes for Gemini | Server Gemini API key. Users may instead connect their own key via Google OAuth. |
| `CLOUDFLARE_ACCOUNT_ID` | For Cloudflare | Cloudflare account ID. |
| `CLOUDFLARE_API_TOKEN` | For Cloudflare | Workers AI token. |
| `CLOUDFLARE_AI_MODEL` | No | Defaults to `@cf/qwen/qwen3-30b-a3b-fp8`. |
| `CLOUDFLARE_AI_MAX_TOKENS` | No | Output cap, default `4096` (max `8192`). |
| `CODECRAFT_API_KEY` | No | Enables the optional CodeCraft fallback. |
| `BACKUP_API_KEY` | No | Alternative name for the CodeCraft key. |
| `CODECRAFT_FALLBACK_ENABLED` | No | Set to `false` to disable the fallback. |
| `GOOGLE_OAUTH_CLIENT_ID` | For Google login | OAuth client ID. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | For Google login | OAuth client secret. |
| `GOOGLE_OAUTH_REDIRECT_URI` | For Google login | Must match the Google Cloud console redirect URI. |
| `SUBNEXA_SESSION_SECRET` | For Google login | Cookie signing secret. |
| `SUBNEXA_USER_ENCRYPTION_KEY` | For Google login | Fernet key used to encrypt stored API keys. |
| `SUBNEXA_USER_DB` | No | SQLite path, default `subnexa_users.db`. |
| `SUBNEXA_FRONTEND_URL` | No | Frontend origin for redirects, default `http://localhost:3000`. |
| `SUBNEXA_COOKIE_SECURE` | No | `true` when serving over HTTPS. |
| `SUBNEXA_COOKIE_SAMESITE` | No | Cookie SameSite policy, default `lax`. |

Generate a Fernet key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Frontend:

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL used by the studio. |
| `NEXT_PUBLIC_SUBNEXA_API_URL` | `http://localhost:8000` | Backend base URL used by account components. |

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Liveness message. |
| `GET` | `/health` | Health payload. |
| `POST` | `/upload` | Upload and validate an SRT file. |
| `POST` | `/glossary/preview` | Preview glossary masking/replacements. |
| `POST` | `/translate` | Translate a plain text string. |
| `POST` | `/translate-srt` | Translate an SRT and return the rendered file. |
| `POST` | `/translate-srt-stream` | Stream translation progress as SSE. |
| `GET` | `/subnexa-auth/login` | Start Google OAuth. |
| `GET` | `/subnexa-auth/callback` | OAuth callback. |
| `GET` | `/subnexa-auth/session` | Current session and provider status. |
| `POST` | `/subnexa-auth/connect/start` | Begin user key connection. |
| `POST` | `/subnexa-auth/logout` | Clear the session. |

`/translate-srt` and `/translate-srt-stream` accept multipart form fields:

- `file` — `.srt`, UTF-8, max 2 MB, max 1500 cues
- `style` — `natural` | `casual` | `formal`
- `glossary` — JSON array of rules
- `output_format` — `srt` | `ass`
- `opening_credit` — `true` | `false`

## Tests

```bash
cd backend
python -m pytest tests
```

## Notes

- Translation progress is stored under `backend/translation_progress/` and is git-ignored.
- `subnexa_users.db` (sessions and encrypted user keys) is git-ignored — never commit it.
- CORS currently allows `http://localhost:3000` and `http://127.0.0.1:3000`; update `backend/main.py` for other origins.
- The Google OAuth key flow is an integration starter. Review `backend/subnexa_auth.py` and harden storage, scopes, and cookie settings before production use.
