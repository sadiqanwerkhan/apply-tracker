# Apply Tracker

Apply Tracker connects to your Gmail, uses AI to automatically find and classify job-application
emails, and presents a single dashboard of every application — grouped by company and role, with the
full timeline of each (applied, phone screen, interview, offer, rejection). Beyond tracking, it
analyzes pasted interview transcripts, extracts the skills each interview tested, builds a personalized
study plan, answers plain-language questions about your job search through an AI agent, and exposes its
tools over the Model Context Protocol so external AI clients can query your data too.

**Live:** https://apply-tracker-rust.vercel.app

---

## What it does

**Automatic inbox tracking.** Pick a date range and the app searches Gmail, classifies each email
(application, interview, assessment, rejection, offer, or noise — plus the real company and role it
belongs to), and attaches it to a stable application record. Scanning runs as a resumable background
job, so it survives failures and you can close the tab while it works; progress streams into the
dashboard as it goes.

**Manual control over your data.** Merge duplicate applications (when a recruiter and the company both
email you about one role), record outcomes that arrived off-channel (WhatsApp, LinkedIn, phone), and
delete applications you consider noise — one at a time, or several at once with Gmail-style
multi-select.

**Interview analysis.** Paste an interview transcript per stage and get an AI readiness assessment of
how it went, along with tailored preparation for upcoming rounds.

**Skills analytics.** The app extracts the skills each interview tested, tracks where you were strong or
weak (and at which companies), shows which skills come up most across all your interviews as a
frequency chart, and orders them into a foundations-first study plan.

**Ask (AI agent).** A chat interface that answers questions about your job search in plain language —
"which companies rejected me and why?", "what stages was I in at SAP?" — by calling real tools that
query your data, so answers are grounded in facts rather than guessed. Conversations persist across
visits, and you can choose which model answers.

**MCP server.** The same agent tools are exposed over the Model Context Protocol, so an external MCP
client (such as Claude Desktop) can securely query your applications using a personal access token you
generate in Settings.

---

## Tech stack

- **Next.js 16** (App Router, TypeScript, Turbopack) with Tailwind CSS
- **Neon** (serverless Postgres) with Prisma 7
- **Auth.js v5** for Google sign-in
- **Gmail API** for reading email
- **AI:** Claude (Anthropic), with Groq (Llama) and Google Gemini as free alternatives
- **Model Context Protocol** SDK for the MCP server
- **Inngest** for durable background jobs
- **Sentry** for error tracking
- Deployed on **Vercel**

---

## AI engines: free by default, Claude when you want it

Every AI feature runs through a single switch, so the whole app can run on free models or on Claude
without any code change. Two environment variables control this, and both default to Groq:

- `CLASSIFY_ENGINE` — the model used for email scanning/classification (`groq` or `claude`)
- `LLM_ENGINE` — the model used for everything else: interview analysis, insights, prep, skill
  extraction, and the Ask agent (`groq` or `claude`)

Claude's code paths are fully preserved behind these toggles — set both to `claude` when you have
Anthropic credit, and the app switches back with no code change. The Ask agent additionally lets the
user pick Groq or Gemini per conversation from the UI (safe because chat is stateless).

---

## Getting started

### Prerequisites

- Node.js 20 or newer
- A Neon Postgres database
- A Google Cloud project with OAuth credentials and the Gmail API enabled
- A Groq API key (free) — and/or a Gemini key (free), and/or an Anthropic key
- An Inngest account

### Environment variables

```
DATABASE_URL=            # Neon Postgres connection string
GOOGLE_CLIENT_ID=        # Google OAuth
GOOGLE_CLIENT_SECRET=
TOKEN_ENC_KEY=           # key for encrypting stored Gmail tokens

# AI engines (both default to "groq" if unset)
CLASSIFY_ENGINE=groq     # or "claude"
LLM_ENGINE=groq          # or "claude"
GROQ_API_KEY=            # for the free Groq engine
GROQ_MODEL=              # optional, defaults to llama-3.3-70b-versatile
GEMINI_API_KEY=          # optional, for Gemini in the Ask agent
GEMINI_MODEL=            # optional, defaults to gemini-flash-latest
ANTHROPIC_API_KEY=       # only needed if using the Claude engine
```

In the Google Cloud Console: enable the Gmail API, create an OAuth 2.0 Web client with the redirect URI
`http://localhost:3000/api/auth/callback/google`, add the `https://www.googleapis.com/auth/gmail.readonly`
scope on the consent screen, and add your Google account as a test user. The app runs in Testing mode,
which allows up to 100 users; in this mode Google refresh tokens expire about weekly, so an occasional
re-sign-in is expected.

### Running locally

The scan runs as a background job, so the Inngest dev server runs alongside the app in a second terminal:

```bash
npm run dev                    # terminal 1: the app
npx inngest-cli@latest dev     # terminal 2: the job runner
```

Open http://localhost:3000, sign in with Google, pick a date range, and scan. If the Inngest dev server
is not running, scans are queued but never execute.

### Tests

```bash
npm test        # Vitest — unit tests for the deterministic logic
npm run build   # production build + type check
```

---

## Deployment

Deploy on Vercel: add the environment variables, add your production redirect URI in Google Cloud
Console, and deploy. After deploying, sync the app in the Inngest dashboard to
`https://<your-app>.vercel.app/api/inngest` — without this step, production jobs are created but never run.

---

## Connecting an MCP client

1. In the app, go to **Settings → Generate new token** and copy the token (shown once; it starts with
   `atk_`).
2. In your MCP client (e.g. Claude Desktop), add the server:

   ```json
   {
     "mcpServers": {
       "apply-tracker": {
         "url": "https://<your-app>.vercel.app/api/mcp",
         "headers": { "Authorization": "Bearer atk_your_token_here" }
       }
     }
   }
   ```

3. Ask it something like "did I interview at SAP, and what stages?" — it calls the app's tools, scoped
   to your account, and answers from your real data.

Tokens are stored only as a SHA-256 hash, are scoped per user, and can be revoked from Settings at any
time.

---

## Project structure

```
app/                    Pages and API routes
  api/                  Scan, applications, ask (agent), mcp, mcp-tokens, transcripts, etc.
  ask/                  AI agent chat page
  settings/             MCP token management
  skills/               Skills analytics + study plan
  application/[id]/     Per-application detail page
lib/
  agent/                Tool interface, tools, agent loop, providers, MCP token auth
  skills/               Skill extraction, stats, frequency, learning path
  llm.ts                Unified Claude/Groq helper (LLM_ENGINE)
  classifyEngine.ts     Classification engine switch (CLASSIFY_ENGINE)
  scanChunk.ts          Resumable scan pipeline
components/             Dashboard, applications table, detail views, charts
hooks/                  useApplications (load, scan, filter, sort — React Query)
prisma/                 Database schema and migrations
```

---

## Design notes

A few decisions worth highlighting:

- **Stable application identity.** Each application is a first-class record with a permanent ID; emails
  attach to it by foreign key. Re-running the classifier or changing logic cannot orphan transcripts or
  outcomes — they live in their own tables, independent of email classification.
- **One switch for the whole AI layer.** Classification and every other AI feature route through a
  single engine selector, so the app runs entirely on free models or on Claude by changing an
  environment variable, with Claude's code fully preserved.
- **Tool-calling agent, not RAG.** The Ask agent answers by calling typed tools that query the database
  directly. Each tool has a name, description, and a Zod-validated input schema, and every tool is
  scoped to the authenticated user — the agent cannot read another user's data. The same tools are
  reused by the MCP server, so there is one implementation, not two.
- **Grounded answers and validated outputs.** The agent is grounded in real data through tools rather
  than guessing, and AI-extracted skills are validated against a fixed allowed-list so anything invented
  is discarded — both guard against hallucinated data reaching the UI or database.
- **Safe reclassification.** Re-running classification only updates email stage/status fields, and if the
  model fails on an email it is skipped rather than overwritten with a weaker guess — a failed AI call
  can never corrupt stored data.
- **Resumable scanning.** The scan is chunked and idempotent, using the database itself as the cursor, so
  a scan that fails or times out resumes exactly where it left off. Each chunk is an Inngest step with
  its own retry budget, and only one scan runs per user at a time.
- **Reliable rejection detection.** A deterministic keyword check overrides the AI for rejection emails,
  so the app never reports an application as advancing when it was actually rejected; recorded manual
  outcomes override everything.
- **Encrypted tokens.** Stored Gmail tokens are encrypted at rest; MCP access tokens are stored only as
  hashes.

---

## Roadmap

- Splitting an application into two (merging is already reversible)
- Manual application entry for applications that never generated an email
- In-app Gmail reconnect to handle token expiry
- A pre-filter before AI classification to further reduce scan time and cost
- LLM-output evaluation and richer agent observability (step tracing, token/latency metrics)