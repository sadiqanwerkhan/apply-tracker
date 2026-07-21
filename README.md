# Apply Tracker

Apply Tracker connects to your Gmail, uses AI to automatically find and classify job-application
emails, and presents a single dashboard of every application — grouped by company and role, with the
full timeline of each (applied, phone screen, interview, offer, rejection). It can also analyze pasted
interview transcripts and give feedback on how each interview went.

Live: https://apply-tracker-rust.vercel.app

## Overview

Scanning your inbox is the core loop: you pick a date range, and the app searches Gmail, classifies
each email with Claude (application, interview, rejection, or noise — and the company and role it
belongs to), and attaches it to a stable application record. The scan runs as a background job, so it
survives failures and you can close the tab while it works; progress streams into the dashboard as it
goes.

Beyond automatic tracking, you can merge duplicate applications (for example when a recruiter and the
company both email you about one role), record outcomes that arrived off-channel (WhatsApp, LinkedIn,
phone), paste interview transcripts per stage, and get an AI readiness assessment of your interviews.

## Tech stack

- Next.js 16 (App Router, TypeScript) with Tailwind CSS
- Neon (serverless Postgres) with Prisma 7
- Auth.js v5 for Google sign-in
- Gmail API for reading email
- Claude (Anthropic) for classification and interview analysis
- Inngest for background jobs
- Deployed on Vercel

## Getting started

### Prerequisites

- Node.js 20 or newer
- A Neon Postgres database
- A Google Cloud project with OAuth credentials and the Gmail API enabled
- An Anthropic API key
- An Inngest account

### Installation

```bash
git clone https://github.com/sadiqanwerkhan/apply-tracker.git
cd apply-tracker
npm install
```

### Environment variables

Create a `.env` file in the project root:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
ANTHROPIC_API_KEY=your_anthropic_api_key
DATABASE_URL=postgresql://user:password@host/db?sslmode=verify-full
AUTH_SECRET=your_generated_secret
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
```

Generate `AUTH_SECRET` with `npx auth secret` (keep the variable name as `AUTH_SECRET`). Note that
`DATABASE_URL` also needs to be readable by Prisma via `prisma.config.ts`.

### Database

```bash
npx prisma migrate dev
npx prisma generate
```

### Google OAuth

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

## Deployment

Deploy on Vercel: add the six environment variables, add your production redirect URI in Google Cloud
Console, and deploy. After deploying, sync the app in the Inngest dashboard to
`https://<your-app>.vercel.app/api/inngest` — without this step, production jobs are created but never run.

## Project structure

```
app/            Pages and API routes
lib/            Scan pipeline, AI classification, aggregation, Inngest jobs
components/     Dashboard, table, detail page, stats
hooks/          useApplications (load, scan, filter, sort)
prisma/         Database schema
```

## Design notes

A few decisions worth highlighting:

- **Stable application identity.** Each application is a first-class record with a permanent ID; emails
  attach to it by foreign key and never detach. Re-running the classifier or changing logic cannot
  orphan transcripts or outcomes.
- **Resumable scanning.** The scan is chunked and idempotent, using the database itself as the cursor,
  so a scan that fails or times out resumes exactly where it left off with no separate job state.
- **Durable background jobs.** Each chunk is an Inngest step with its own retry budget, so a transient
  API rate-limit retries a single chunk rather than failing the whole scan. Only one scan runs per user
  at a time.
- **Reliable rejection detection.** A deterministic keyword check overrides the AI for rejection emails,
  so the app never reports an application as advancing when it was actually rejected.

## Roadmap

- Splitting an application into two (merging is already reversible)
- Manual application entry for applications that never generated an email
- In-app Gmail reconnect to handle token expiry
- A pre-filter before AI classification to reduce scan time and cost

## Update
- More features in pipeline.
- Currently, the app is under construction that's why the scan is not working properly. We are fixing it.
- We apologize for the inconvenience.