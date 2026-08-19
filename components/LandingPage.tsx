'use client'

import type React from 'react'
import { useEffect, useState } from 'react'
import {
  MailSearch,
  Activity,
  MessageSquareText,
  Server,
  GitMerge,
  FileDown,
  ShieldCheck,
  ArrowRight,
  Send,
  CalendarClock,
  BarChart3,
  Trophy,
  Mail,
  Sparkles,
  Route,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { Reveal } from '@/components/Reveal'

/* ------------------------------------------------------------------ */
/*  Sign in button — wire your own auth to this.                       */
/*  Look for id="apply-tracker-google-signin" or the exported          */
/*  GoogleSignInButton component. It intentionally has no onClick.     */
/* ------------------------------------------------------------------ */
export function GoogleSignInButton({
    className = '',
    size = 'lg',
    variant = 'primary',
    onSignIn,
  }: {
    className?: string
    size?: 'sm' | 'lg'
    variant?: 'primary' | 'inverted'
    onSignIn?: () => Promise<void>
  }) {
    const sizing = size === 'lg' ? 'px-6 py-3.5 text-base' : 'px-4 py-2.5 text-sm'
    const variants: Record<string, string> = {
      primary:
        'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30',
      inverted:
        'bg-background text-foreground ring-1 ring-inset ring-border shadow-lg shadow-black/10 hover:bg-secondary hover:shadow-xl',
    }
    return (
      <form action={onSignIn} className={`inline-flex ${className}`}>
        <button
          id="apply-tracker-google-signin"
          data-auth="google"
          type="submit"
          className={`group inline-flex items-center justify-center gap-3 rounded-full font-semibold transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${variants[variant]} ${sizing}`}
        >
          <GoogleGlyph className="h-5 w-5" />
          Sign in with Google
          <ArrowRight
            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </form>
    )
  }

function GoogleGlyph({ className = '' }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-full bg-white ring-1 ring-border ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
        />
      </svg>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */
const features: { icon: React.ElementType; title: string; body: string }[] = [
  {
    icon: MailSearch,
    title: 'Automatic email classification',
    body: 'AI reads your inbox and identifies every job-application email — no manual tagging.',
  },
  {
    icon: Activity,
    title: 'Live application timelines',
    body: 'See each role move from applied to phone screen to interview to offer or rejection.',
  },
  {
    icon: MessageSquareText,
    title: 'AI interview coaching',
    body: 'Paste your interview transcript and get honest feedback on how it went.',
  },
  {
    icon: Server,
    title: 'Durable background scanning',
    body: 'Close the tab and it keeps working — your dashboard is ready when you return.',
  },
  {
    icon: GitMerge,
    title: 'Merge duplicates & off-channel outcomes',
    body: 'Combine duplicate threads and record calls or events that never hit your inbox.',
  },
  {
    icon: FileDown,
    title: 'Export anywhere',
    body: 'Download your tracked applications to PDF, Excel, or Word in one click.',
  },
]

const stats: { value: string; label: string }[] = [
  { value: '100%', label: 'Read-only access' },
  { value: '0', label: 'Manual entries needed' },
  { value: '1', label: 'Dashboard for everything' },
]

/* ------------------------------------------------------------------ */
/*  Dashboard mockups — crisp coded replicas of the real product.      */
/*  All data is dummy (fictional companies + a placeholder email).     */
/* ------------------------------------------------------------------ */
function MockFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/5">
      <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-chart-4/50" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary/40" />
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

const statusTone: Record<string, string> = {
  Advancing: 'bg-primary/10 text-primary',
  Pending: 'bg-chart-4/15 text-chart-4',
  Rejected: 'bg-destructive/10 text-destructive',
  Offer: 'bg-primary text-primary-foreground',
}

/* Step 1 — Apply: dashboard header + scan bar */
function MockApply() {
  return (
    <MockFrame>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-bold tracking-tight">Apply Tracker</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Signed in as alex.morgan@gmail.com</div>
        </div>
        <span className="text-xs text-muted-foreground">Sign out</span>
      </div>
      <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
        <div className="grid grid-cols-2 gap-3">
          {['From', 'To'].map((l, i) => (
            <div key={l}>
              <div className="text-[11px] text-muted-foreground">{l}</div>
              <div className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium">
                {i === 0 ? '25/05/2026' : '24/07/2026'}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 w-full rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
          Scan my applications
        </div>
      </div>
    </MockFrame>
  )
}

/* Step 2 — Keep track: application list */
function MockList() {
  const rows = [
    { company: 'Northwind', role: 'Senior Frontend Engineer', status: 'Advancing', stage: 'Interview' },
    { company: 'Lumina', role: 'Fullstack Engineer', status: 'Pending', stage: 'Phone screen' },
    { company: 'Vertex Labs', role: 'Software Engineer', status: 'Rejected', stage: 'Rejected' },
    { company: 'Nimbus', role: 'Frontend Developer', status: 'Advancing', stage: 'Assessment' },
  ]
  return (
    <MockFrame>
      <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Company / Role</span>
        <span>Status</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.company} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-[11px] font-bold text-secondary-foreground">
                {r.company.slice(0, 2)}
              </span>
              <div>
                <div className="text-sm font-semibold leading-tight">{r.company}</div>
                <div className="text-xs text-muted-foreground">{r.role}</div>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone[r.status]}`}>
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

/* Step 3 — Schedule interviews: application timeline */
function MockTimeline() {
  const steps = [
    { label: 'Applied', date: '2026-07-11', tone: 'bg-muted-foreground/40', note: 'Senior Frontend Engineer @ Northwind' },
    { label: 'Phone screen', date: '2026-07-14', tone: 'bg-primary', note: 'Intro call with hiring manager' },
    { label: 'Assessment', date: '2026-07-16', tone: 'bg-primary', note: 'Take-home project invited' },
    { label: 'Interview', date: '2026-07-22', tone: 'bg-primary', note: 'On-site technical, 10:00 AM' },
  ]
  return (
    <MockFrame>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Application timeline</div>
      <ol className="mt-4 space-y-4">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-3 pl-1">
            <div className="flex flex-col items-center">
              <span className={`mt-1 h-3 w-3 rounded-full ${s.tone}`} />
              {i < steps.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{s.label}</span>
                <span className="text-[11px] text-muted-foreground">{s.date}</span>
              </div>
              <div className="text-xs text-muted-foreground">{s.note}</div>
            </div>
          </li>
        ))}
      </ol>
    </MockFrame>
  )
}

/* Step 4 — Total applications: stat overview */
function MockStats() {
  const tiles = [
    { v: '48', l: 'Applications', c: 'text-foreground' },
    { v: '53%', l: 'Response rate', c: 'text-primary' },
    { v: '12', l: 'Reached interview', c: 'text-primary' },
    { v: '7', l: 'Advancing', c: 'text-primary' },
    { v: '9', l: 'Rejected', c: 'text-destructive' },
    { v: '3', l: 'Offers', c: 'text-primary' },
  ]
  return (
    <MockFrame>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.l} className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
            <div className={`text-2xl font-bold tracking-tight ${t.c}`}>{t.v}</div>
            <div className="mt-1 text-[10px] leading-tight text-muted-foreground">{t.l}</div>
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

/* Step 5 — AI interview analysis: readiness panel */
function MockAnalysis() {
  const rows = [
    { icon: CheckCircle2, label: 'What you did well', count: 4, tone: 'text-primary' },
    { icon: AlertTriangle, label: 'Where you struggled', count: 4, tone: 'text-chart-4' },
    { icon: Clock, label: 'Do differently next time', count: 4, tone: 'text-muted-foreground' },
  ]
  return (
    <MockFrame>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Interview analysis</div>
        <span className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
          Re-analyze
        </span>
      </div>
      <div className="mt-3 rounded-xl border border-chart-4/30 bg-chart-4/10 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Interview readiness
        </div>
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-base font-bold text-chart-4">Mixed</span>
          <span className="flex gap-1">
            <span className="h-1.5 w-6 rounded-full bg-chart-4" />
            <span className="h-1.5 w-6 rounded-full bg-chart-4" />
            <span className="h-1.5 w-6 rounded-full bg-border" />
          </span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(({ icon: Icon, label, count, tone }) => (
          <div key={label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
              {label}
            </span>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
              {count}
            </span>
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

/* Step 6 — Offers received */
function MockOffers() {
  const offers = [
    { company: 'Northwind', role: 'Senior Frontend Engineer' },
    { company: 'Meridian', role: 'Fullstack Engineer' },
    { company: 'Cobalt', role: 'Product Engineer' },
  ]
  return (
    <MockFrame>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Offers</span>
        <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
          3 received
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {offers.map((o) => (
          <div
            key={o.company}
            className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
                {o.company.slice(0, 2)}
              </span>
              <div>
                <div className="text-sm font-semibold leading-tight">{o.company}</div>
                <div className="text-xs text-muted-foreground">{o.role}</div>
              </div>
            </div>
            <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
        ))}
      </div>
    </MockFrame>
  )
}

/* Roadmap steps — each pairs a coded dashboard mockup with a description. */
const roadmap: {
  icon: React.ElementType
  step: string
  title: string
  body: string
  mock: React.ElementType
}[] = [
  {
    icon: Send,
    step: '01',
    title: 'Apply to jobs',
    body: 'Keep applying the way you already do. Confirmation and reply emails land in your inbox — connect it once and press scan.',
    mock: MockApply,
  },
  {
    icon: Route,
    step: '02',
    title: 'Keep track automatically',
    body: 'AI reads each application email and organizes it by company, role, and status — no spreadsheets, no manual entry.',
    mock: MockList,
  },
  {
    icon: CalendarClock,
    step: '03',
    title: 'Schedule interviews',
    body: 'Every stage is laid out on a clean timeline with dates, so interview invites never slip through the cracks.',
    mock: MockTimeline,
  },
  {
    icon: BarChart3,
    step: '04',
    title: 'See total applications',
    body: 'One dashboard rolls up every application, response rate, and stage so you always know where your search stands.',
    mock: MockStats,
  },
  {
    icon: Sparkles,
    step: '05',
    title: 'Review AI interview analysis',
    body: 'Paste your interview transcripts and get an honest readiness read — what went well, what to fix, and what to do next time.',
    mock: MockAnalysis,
  },
  {
    icon: Trophy,
    step: '06',
    title: 'Receive offers',
    body: 'Watch roles move all the way to offer. Compare, decide, and export your full history whenever you need it.',
    mock: MockOffers,
  },
]

/* ------------------------------------------------------------------ */
/*  Shared bits                                                        */
/* ------------------------------------------------------------------ */
function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30">
        <MailSearch className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className={`text-lg font-semibold tracking-tight ${dark ? 'text-primary-foreground' : ''}`}>
        Apply Tracker
      </span>
    </div>
  )
}

function Nav({ onSignIn }: { onSignIn?: () => Promise<void> }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`transition-all duration-300 ${
          scrolled ? 'border-b border-border bg-background/80 backdrop-blur-xl' : 'border-b border-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Wordmark />
          <div className="flex items-center gap-6">
            <a
              href="#features"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              How it works
            </a>
            <GoogleSignInButton size="sm" className="hidden sm:inline-flex" onSignIn={onSignIn} />
          </div>
        </div>
      </div>
    </header>
  )
}

/* Clean coded product preview in the hero. */
function HeroPreview() {
  const rows = [
    { company: 'Vercel', role: 'Frontend Engineer', stage: 'Interview', tone: 'primary' },
    { company: 'Linear', role: 'Product Designer', stage: 'Applied', tone: 'muted' },
    { company: 'Notion', role: 'Software Engineer', stage: 'Offer', tone: 'success' },
    { company: 'Figma', role: 'Design Engineer', stage: 'Phone screen', tone: 'muted' },
  ]
  const badge: Record<string, string> = {
    primary: 'bg-accent text-accent-foreground',
    success: 'bg-primary text-primary-foreground',
    muted: 'bg-secondary text-secondary-foreground',
  }
  return (
    <div className="relative rounded-2xl border border-border bg-card p-2 shadow-2xl shadow-primary/10 sm:rounded-3xl sm:p-3">
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <span className="h-3 w-3 rounded-full bg-destructive/50" />
        <span className="h-3 w-3 rounded-full bg-chart-4/60" />
        <span className="h-3 w-3 rounded-full bg-primary/40" />
      </div>
      <div className="rounded-xl border border-border bg-background p-4 sm:rounded-2xl sm:p-6">
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: '48', l: 'Applications' },
            { v: '7', l: 'Interviews' },
            { v: '3', l: 'Offers' },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-border bg-card p-3 text-center sm:p-4">
              <div className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{s.v}</div>
              <div className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div
              key={r.company}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-xs font-bold text-secondary-foreground">
                  {r.company.slice(0, 2)}
                </span>
                <div className="text-left">
                  <div className="text-sm font-semibold leading-tight">{r.role}</div>
                  <div className="text-xs text-muted-foreground">{r.company}</div>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badge[r.tone]}`}>{r.stage}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Hero({ onSignIn }: { onSignIn?: () => Promise<void> }) {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-36">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="mx-auto max-w-4xl px-6 text-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Read-only. Private to your account.
          </span>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="mt-6 text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            Your job search,
            <br />
            <span className="text-primary">on autopilot.</span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Apply Tracker reads your inbox, finds every job application automatically, and turns the
            chaos into one clean dashboard — with AI interview coaching.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="mt-9 flex flex-col items-center gap-3">
          <GoogleSignInButton onSignIn={onSignIn} />
            <p className="max-w-md text-pretty text-sm text-muted-foreground">
              Read-only access to find application emails. Your data stays private to your account.
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal delay={200} y={40} className="mx-auto mt-16 max-w-3xl px-6">
        <HeroPreview />
      </Reveal>
    </section>
  )
}

function Stats() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
      <div className="grid gap-8 sm:grid-cols-3">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 100} className="text-center">
            <div className="text-5xl font-bold tracking-tight text-primary sm:text-6xl">{s.value}</div>
            <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Everything your job hunt needs
        </h2>
        <p className="mt-4 text-pretty text-lg text-muted-foreground">
          From inbox to offer, Apply Tracker keeps every detail organized so you can focus on
          landing the role.
        </p>
      </Reveal>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }, i) => (
          <Reveal key={title} delay={(i % 3) * 90}>
            <article className="group h-full rounded-2xl border border-border bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-foreground transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* STRABL-style flowing roadmap: a center spine connects each step, with a
   coded dashboard mockup paired to every description (alternating sides). */
function Roadmap() {
  const powered = [
    { icon: Mail, label: 'Email' },
    { icon: Sparkles, label: 'AI' },
    { icon: Route, label: 'Tracking' },
  ]
  return (
    <section id="how-it-works" className="border-y border-border bg-muted/40">
      <div className="mx-auto max-w-5xl px-6 pt-20 sm:pt-28">
        <Reveal className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">How it works</span>
          <h2 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            One path, from apply to offer
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-muted-foreground">
            Follow the journey step by step — every stage runs itself, powered by your email, AI,
            and automatic tracking.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            {powered.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm"
              >
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </Reveal>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-24 pt-16">
        <div className="relative">
          {/* Spine */}
          <div
            aria-hidden="true"
            className="absolute left-6 top-0 h-full w-0.5 bg-gradient-to-b from-primary/50 via-primary/40 to-primary/10 md:left-1/2 md:-translate-x-1/2"
          />
          <div className="space-y-14 md:space-y-24">
            {roadmap.map(({ icon: Icon, step, title, body, mock: Mock }, i) => {
              const flip = i % 2 === 1
              return (
                <div key={step} className="relative md:grid md:grid-cols-2 md:items-center md:gap-14">
                  {/* Node on the spine */}
                  <span
                    aria-hidden="true"
                    className="absolute left-6 top-1 z-10 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-primary ring-4 ring-muted md:left-1/2"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                  </span>

                  {/* Text */}
                  <Reveal
                    y={30}
                    className={`pl-16 md:pl-0 ${flip ? 'md:order-2 md:pl-14' : 'md:order-1 md:pr-14'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-4xl font-bold tabular-nums text-primary/25 sm:text-5xl">{step}</span>
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    </div>
                    <h3 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h3>
                    <p className="mt-3 max-w-md text-pretty leading-relaxed text-muted-foreground">{body}</p>
                  </Reveal>

                  {/* Mockup */}
                  <Reveal
                    y={30}
                    delay={100}
                    className={`mt-6 pl-16 md:mt-0 md:pl-0 ${flip ? 'md:order-1 md:pr-14' : 'md:order-2 md:pl-14'}`}
                  >
                    <Mock />
                  </Reveal>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function CtaBanner({ onSignIn }: { onSignIn?: () => Promise<void> }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center shadow-2xl shadow-primary/25 sm:px-16 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-foreground/10 blur-2xl"
          />
          <h2 className="text-balance text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl">
            Stop tracking applications in spreadsheets.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-primary-foreground/80">
            Let AI do the busywork. Connect your inbox and see your entire job search in one place.
          </p>
          <div className="mt-8 flex justify-center">
          <GoogleSignInButton variant="inverted" onSignIn={onSignIn} />
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function Footer() {
  const columns: { title: string; links: string[] }[] = [
    { title: 'Product', links: ['Features', 'How it works', 'Pricing', 'Export'] },
    { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
    { title: 'Legal', links: ['Privacy policy', 'Terms of service', 'Security'] },
  ]
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Your job search, organized — from inbox to offer, powered by AI.
            </p>
            <div className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Apply Tracker HQ
                <br />
                Torstraße 123, 10119
                <br />
                Berlin, Germany
              </span>
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Apply Tracker. All rights reserved.</p>
          <p>Made in Berlin, Germany.</p>
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function ApplyTrackerLanding({ onSignIn }: { onSignIn?: () => Promise<void> }) {
    // The signed-out landing page always uses its light design, regardless of any
    // saved dark-theme preference from the signed-in app. The saved preference is
    // restored when the user leaves this page (e.g. after signing in).
    useEffect(() => {
      const root = document.documentElement;
      root.classList.remove("dark");
      root.classList.add("light");
      return () => {
        if (localStorage.getItem("theme") === "dark") {
          root.classList.add("dark");
          root.classList.remove("light");
        }
      };
    }, []);

    return (
      <main className="min-h-screen bg-background text-foreground">
        <Nav onSignIn={onSignIn} />
        <Hero onSignIn={onSignIn} />
        <Stats />
        <Features />
        <Roadmap />
        <CtaBanner onSignIn={onSignIn} />
        <Footer />
      </main>
    )
  }
