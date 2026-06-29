<div align="center">

# Hunt

**An open-source job application autopilot and social media presence engine.**

Upload your resume once. Hunt finds matching jobs, drafts tailored cover letters, and sends applications from your own mailbox — on a schedule you control. It also discovers articles in your niche and drafts posts for your social media accounts.

[Features](#features) · [How it works](#how-it-works) · [Getting started](#getting-started) · [Configuration](#configuration) · [Running the workers](#running-the-workers) · [Contributing](#contributing)

</div>

---

## Features

- **Resume-grounded cover letters** — every draft is based on your actual resume. Nothing is fabricated.
- **Sends from your own mailbox** — applications go out from your real Gmail address. Replies land in your inbox.
- **Multi-provider AI** — switch between Claude (Anthropic), ChatGPT (OpenAI), and Gemini (Google) from the Settings page.
- **Approval-first by default** — review every draft before it sends. Go full-auto when you trust it.
- **Hunt definitions** — saved searches with a schedule. "Find backend remote jobs on weekday mornings, max 10 applications per day."
- **Application tracking** — draft → approved → sent → replied → interview pipeline.
- **Social presence module** — discover articles, generate platform-native posts, and publish to your social accounts on a schedule (Phase 4).
- **Cloudinary storage** — resumes stored securely as signed private assets.
- **Fully self-hosted** — no subscription, no data leaving your machine except to the AI provider and email service you choose.

---

## How it works

Hunt is built around a single primitive: a **Hunt definition** — a saved search + rules + a scheduled action.

```
Resume upload
     │
     ▼
Hunt definition (keywords, location, sources, schedule, approval mode)
     │
     ▼  runs on cron
Job discovery worker  ──►  matching engine (scores job vs resume)
     │
     ▼
Generator worker  ──►  Claude / GPT-4o / Gemini writes cover letter draft
     │
     ▼
Approval queue  ──►  you approve or skip in the dashboard
     │
     ▼
Action executor  ──►  sends email with resume attached from your Gmail
     │
     ▼
Activity log  ──►  tracks replies, interview status
```

Three application tiers keep you protected:

| Tier | What happens | Example |
|---|---|---|
| **Full-auto** | Hunt acts end-to-end | Email-to-apply jobs, ATS boards with APIs |
| **Assisted** | Hunt pre-fills the form; you click submit | Sites with CAPTCHA or custom ATS forms |
| **Link-out** | Hunt surfaces the job + draft; you apply yourself | Sites with aggressive bot detection |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend & API | Next.js 16 (App Router) + TypeScript + Tailwind CSS |
| Database | PostgreSQL + Prisma ORM |
| Background jobs | BullMQ + Redis |
| AI providers | Claude (Anthropic) · ChatGPT (OpenAI) · Gemini (Google) |
| Document storage | Cloudinary (raw assets) |
| Auth | NextAuth v5 with Google OAuth |
| Email sending | Gmail API via OAuth2 + Nodemailer |

---

## Getting started

### Prerequisites

You need the following installed locally:

- [Node.js](https://nodejs.org) v20+
- [PostgreSQL](https://www.postgresql.org/download/) (local install, or a free cloud instance — see below)
- [Redis](https://redis.io/docs/getting-started/) (local install, or a free cloud instance — see below)
- A [Google Cloud](https://console.cloud.google.com) project (for Gmail OAuth)
- At least one AI provider API key (Claude, OpenAI, or Gemini)
- A [Cloudinary](https://cloudinary.com) account (free tier is fine)

**Free cloud options if you don't want to install Postgres/Redis locally:**
- PostgreSQL: [Neon](https://neon.tech) · [Supabase](https://supabase.com) · [Railway](https://railway.app)
- Redis: [Upstash](https://upstash.com) · [Railway](https://railway.app)

---

### 1. Clone the repository

```bash
git clone https://github.com/your-username/hunt.git
cd hunt
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env` — full reference in the [Configuration](#configuration) section below.

### 4. Set up the database

Make sure your PostgreSQL server is running and `DATABASE_URL` is set in `.env`, then push the schema:

```bash
npx prisma db push
```

This creates all tables. No migration files are generated — `db push` is the right command for local dev.

To open a visual database browser:

```bash
npm run db:studio
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to the login page.

### 6. Start the background workers

In a **separate terminal**, run the workers:

```bash
npm run workers
```

This starts the generator worker (calls the AI to draft cover letters) and the action executor worker (sends emails). Both must be running for applications to be processed.

You should see:

```
Generator worker started
Action executor worker started
```

---

## Configuration

All configuration lives in your `.env` file. Never commit this file — it is in `.gitignore` by default.

### Database

```env
DATABASE_URL="postgresql://user:password@localhost:5432/hunt"
```

### NextAuth

```env
AUTH_SECRET="generate with: openssl rand -base64 32"
AUTH_URL="http://localhost:3000"
```

`AUTH_SECRET` must be a random string. Generate one with:

```bash
# On Mac/Linux
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Google OAuth (required)

Hunt uses Google sign-in and Gmail to send job applications from your own email address.

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. Create an **OAuth 2.0 Client ID** → choose **Web application**
3. Add this to **Authorized redirect URIs**:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
4. Copy the Client ID and Secret into `.env`:

```env
AUTH_GOOGLE_ID="your-client-id.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="your-client-secret"
```

5. In the same Google Cloud project, enable these APIs:
   - **Gmail API** (for sending emails from your mailbox)

> **Why Gmail scope?** Hunt requests `gmail.send` and `gmail.readonly` so it can send applications from your own address and (in a future phase) track replies. It never reads your existing email content.

### AI provider

Set which AI model powers Hunt. You only need to configure the provider you plan to use.

```env
# Choose one: claude | openai | gemini  (default: claude)
LLM_PROVIDER="claude"
```

#### Claude (Anthropic) — default

Get your key at [console.anthropic.com](https://console.anthropic.com).

```env
ANTHROPIC_API_KEY="sk-ant-..."
```

Uses `claude-haiku-4-5` for fast tasks (scoring, parsing) and `claude-sonnet-4-6` for writing.

#### ChatGPT (OpenAI)

Get your key at [platform.openai.com](https://platform.openai.com).

```env
LLM_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
```

Uses `gpt-4o-mini` for fast tasks and `gpt-4o` for writing.

#### Gemini (Google)

Get your key at [Google AI Studio](https://aistudio.google.com).

```env
LLM_PROVIDER="gemini"
GEMINI_API_KEY="AI..."
```

Uses `gemini-1.5-flash` for fast tasks and `gemini-1.5-pro` for writing.

You can also switch provider from **Settings → AI Provider** in the dashboard (applies to the running process; set in `.env` to persist across restarts).

### Cloudinary (document storage)

Resumes are stored as private signed assets on Cloudinary.

1. Create a free account at [cloudinary.com](https://cloudinary.com)
2. Go to your **Dashboard** → copy Cloud name, API Key, and API Secret

```env
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

### Redis

```env
REDIS_URL="redis://localhost:6379"
```

If using Upstash, the URL looks like `rediss://default:password@host:6379`.

### Full `.env` reference

```env
# ── Database ──────────────────────────────────────────────────────────
DATABASE_URL="postgresql://user:password@localhost:5432/hunt"

# ── NextAuth ──────────────────────────────────────────────────────────
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"

# ── Google OAuth ──────────────────────────────────────────────────────
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# ── AI provider ───────────────────────────────────────────────────────
LLM_PROVIDER="claude"        # claude | openai | gemini

ANTHROPIC_API_KEY=""         # console.anthropic.com
OPENAI_API_KEY=""            # platform.openai.com
GEMINI_API_KEY=""            # aistudio.google.com

# ── Cloudinary ────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

# ── Redis (BullMQ) ────────────────────────────────────────────────────
REDIS_URL="redis://localhost:6379"

# ── App ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Running the workers

The web app and the workers are separate processes. The web app enqueues jobs; the workers process them. Both need to be running for Hunt to work end-to-end.

```bash
# Terminal 1 — web app
npm run dev

# Terminal 2 — both workers together
npm run workers

# Or run them individually
npm run worker:generator    # AI drafting (cover letters, posts)
npm run worker:executor     # Email sending
```

Workers pick up jobs from Redis automatically. If a worker is down when a job is enqueued, the job waits in the queue and is picked up when the worker restarts — no jobs are lost.

---

## Using Hunt

### 1. Sign in

Go to [http://localhost:3000](http://localhost:3000) and sign in with Google. This connects your Gmail account for sending applications.

### 2. Upload your resume

Go to **Profile & Resume** → drag and drop your resume (PDF, DOC, DOCX, or TXT, max 5 MB).

Hunt parses your resume using AI and extracts your name, headline, skills, job titles, and experience. This is what every cover letter is grounded in.

### 3. Add a job manually

Go to **Applications** → **Add job**. Paste the job title, company, job description, and the apply-to email address. Hunt queues a cover letter draft — refresh in a few seconds and it will appear.

### 4. Review and approve the draft

Open the application. You will see the generated cover letter pre-filled with your resume details. Edit it freely, then click **Approve & Send**. Hunt sends the email from your Gmail with your resume attached.

### 5. Create a Hunt (automated search)

Go to **My Hunts** → **New hunt**. Define:
- Keywords (e.g. `Node.js, backend, API`)
- Location and remote preference
- Which sources to search
- A schedule (e.g. weekday mornings)
- Daily application cap
- Approval mode (draft-only recommended to start)

Hunt will discover matching jobs and queue drafts automatically on schedule.

---

## Project structure

```
hunt/
├── src/
│   ├── app/
│   │   ├── api/              # API routes (Next.js Route Handlers)
│   │   │   ├── auth/         # NextAuth handler
│   │   │   ├── applications/ # CRUD + approve/reject actions
│   │   │   ├── hunts/        # CRUD
│   │   │   ├── mailboxes/    # Connected mailboxes
│   │   │   ├── profile/      # Resume upload
│   │   │   └── settings/llm/ # AI provider switching
│   │   └── dashboard/        # UI pages
│   │       ├── page.tsx      # Overview
│   │       ├── profile/      # Resume upload
│   │       ├── hunts/        # Hunt management
│   │       ├── applications/ # Review queue + history
│   │       └── settings/     # AI provider picker
│   ├── lib/
│   │   ├── auth.ts           # NextAuth config
│   │   ├── db.ts             # Prisma client singleton
│   │   ├── llm.ts            # Multi-provider AI abstraction
│   │   ├── claude.ts         # Re-export shim (backwards compat)
│   │   ├── gmail.ts          # Gmail OAuth2 + Nodemailer
│   │   ├── queue.ts          # BullMQ queue factory
│   │   ├── resume-parser.ts  # PDF/DOC text extraction + AI parse
│   │   └── storage.ts        # Cloudinary upload/download
│   ├── middleware.ts          # Auth route protection
│   └── types/
│       └── next-auth.d.ts    # Session type augmentation
├── workers/
│   ├── generator.worker.ts   # Drafts cover letters and social posts
│   └── action-executor.worker.ts  # Sends emails
├── prisma/
│   └── schema.prisma         # Database schema
├── prisma.config.ts          # Prisma 7 config
├── .env.example              # Environment variable template
└── hunt-discussion.html      # Project design discussion doc
```

---

## Contributing

Hunt is open source and contributions are welcome. Please read this section before opening a pull request.

### Ground rules

- **All changes go through a pull request.** No one pushes directly to `main` — not even maintainers. `main` is the stable branch.
- **PRs are reviewed before merging.** The maintainer (@Tolulope) performs all merges. Be patient — this is a personal project maintained in spare time.
- **One concern per PR.** A bug fix and a new feature should be separate PRs. Small, focused PRs get reviewed faster.
- **Tests and type-check must pass.** Run `npx tsc --noEmit` before opening a PR. A PR that breaks TypeScript will not be merged.

### How to contribute

**1. Fork the repository**

Click **Fork** on GitHub. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/hunt.git
cd hunt
```

**2. Add the upstream remote**

```bash
git remote add upstream https://github.com/Tolulope/hunt.git
```

**3. Create a feature branch off `main`**

Always branch from `main`, never work directly on it:

```bash
git checkout main
git pull upstream main
git checkout -b feat/your-feature-name
```

Branch naming convention:

| Prefix | When to use |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `refactor/` | Code change with no behaviour change |
| `chore/` | Dependency updates, config, tooling |

**4. Make your changes**

Keep commits small and descriptive. Write commit messages in the imperative:

```
feat: add Workable API connector
fix: handle expired Gmail token on send
docs: add Redis setup instructions for Windows
```

**5. Check TypeScript before pushing**

```bash
npx tsc --noEmit
```

Fix any errors before pushing.

**6. Push and open a pull request**

```bash
git push origin feat/your-feature-name
```

Then open a pull request on GitHub against the `main` branch of the original repository. Fill in the PR template:

- **What does this PR do?** One paragraph summary.
- **Why?** What problem does it solve or what value does it add?
- **How to test?** Steps to verify the change works.
- **Screenshots** (if it touches the UI).

**7. Respond to review feedback**

The maintainer may request changes. Push additional commits to the same branch — do not close and reopen the PR.

### What to contribute

Good first issues:

- Job source connectors (Greenhouse, Lever, Workable, CryptoJobsList RSS)
- Additional social platforms (LinkedIn, Facebook posting)
- `.docx` resume parsing via [Mammoth](https://github.com/mwilliamson/mammoth.js)
- Reply tracking (parse Gmail inbox for recruiter replies)
- Better job matching (pgvector embeddings)
- Dark/light theme toggle
- Unit tests for the LLM abstraction layer

Not a good fit for a PR:

- Changing the default AI provider or removing existing providers
- Breaking changes to the database schema without a migration path
- Features that require paid third-party services with no free tier

### Code style

- TypeScript everywhere — no plain `.js` files in `src/` or `workers/`
- No comments that describe what the code does — only comments that explain a non-obvious why
- No `any` without an eslint-disable comment explaining why
- Tailwind for styling — no new CSS files unless genuinely necessary

---

## License

MIT — see [LICENSE](LICENSE) for details.

You are free to use, fork, and modify Hunt for personal or commercial purposes. Attribution is appreciated but not required.
