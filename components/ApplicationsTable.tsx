"use client";

import { Fragment, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Row, STAGE_LABELS } from "@/lib/types";

type Props = {
  items: Row[];
  allRows: Row[];
  scanning: boolean;
  emptyMessage?: string;
  isNewRow?: (r: Row) => boolean;
  onSeen?: (id: string) => void;
};

const STATUS_META: Record<string, { pill: string; dot: string }> = {
  Advancing: { pill: "bg-success-muted text-success", dot: "bg-success" },
  Pending: { pill: "bg-warning-muted text-warning", dot: "bg-warning" },
  Rejected: { pill: "bg-danger-muted text-danger", dot: "bg-danger" },
};
function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.Pending;
}
function stageClasses(stage: string) {
  if (stage === "rejected") return "bg-danger-muted text-danger";
  if (stage === "offer") return "bg-success-muted text-success";
  if (stage === "interview" || stage === "assessment" || stage === "screening") return "bg-accent/10 text-accent";
  return "bg-secondary text-muted-foreground";
}
function dotClasses(stage: string) {
  if (stage === "rejected") return "bg-danger";
  if (stage === "offer") return "bg-success";
  if (stage === "interview" || stage === "assessment" || stage === "screening") return "bg-accent";
  return "bg-muted-foreground";
}

function initials(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

// An application should offer "Interview details & transcripts" only when a real
// interview happened — i.e. there is a timeline event beyond the initial "applied"
// and the "rejected" ones. Applied-only or applied→rejected has nothing to transcribe.
const NON_INTERVIEW_STAGES = new Set(["applied", "rejected", "update"]);
function hasRealInterview(row: Row): boolean {
  return (row.timeline || []).some((t) => !NON_INTERVIEW_STAGES.has(t.stage));
}

// Category labels for the hand-entered round type (mirrors the detail page's options).
const STAGE_TYPE_LABELS: Record<string, string> = {
  phone_screen: "Phone screen",
  technical: "Technical",
  system_design: "System design",
  cultural_fit: "Cultural fit",
  hr: "HR",
  final: "Final",
  other: "Other",
};

// The green indicator is driven purely by a scheduled round's date
// (row.nextInterviewAt = soonest future round with no transcript). "Soon" = the
// interview is within the next 2 days and hasn't passed. Once it passes or a
// transcript is added, rows.ts drops it and this goes quiet.
// (Ordering these rows to the top of the list is handled globally in useApplications.)
const INTERVIEW_SOON_MS = 48 * 60 * 60 * 1000; // 2 days
function interviewSoon(row: Row, now: number): boolean {
  return row.nextInterviewAt != null && row.nextInterviewAt >= now && row.nextInterviewAt - now <= INTERVIEW_SOON_MS;
}
function formatInterview(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function shortWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

const CHANNELS = ["LinkedIn", "WhatsApp", "Phone", "Indeed", "Email", "Other"];

const INTERVIEW_STAGE_KEYS = ["screening", "assessment", "interview", "offer"];

// Seed the detail page's stages from the email timeline, then navigate there.
// Shared by the "Interview details" button and the prep nudge so they behave identically.
async function seedAndOpen(row: Row, router: ReturnType<typeof useRouter>) {
  sessionStorage.setItem("appsScroll", String(window.scrollY));
  sessionStorage.setItem("appsExpandedKey", `${row.company}|||${row.role}`);
  const seen = new Set<string>();
  const seedStages: string[] = [];
  for (const t of row.timeline || []) {
    if (INTERVIEW_STAGE_KEYS.includes(t.stage) && !seen.has(t.stage)) {
      seen.add(t.stage);
      seedStages.push(STAGE_LABELS[t.stage] || t.stage);
    }
  }
  try {
    await fetch("/api/applications/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: row.id, seedStages }),
    });
  } catch {
    /* stages will seed on next open */
  }
  router.push(`/application/${row.id}`);
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Compact, named indicator for the collapsed row: pulsing dot + round name + short time.
function NextInterviewPill({ row }: { row: Row }) {
  if (row.nextInterviewAt == null) return null;
  const name = row.nextInterviewName || "Interview";
  return (
    <span
      className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-success/25 bg-success-muted py-0.5 pl-1.5 pr-2 text-[11px] font-medium text-success"
      title={`${name} · ${formatInterview(row.nextInterviewAt)}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-70 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <span className="truncate">{name} · {shortWhen(row.nextInterviewAt)}</span>
    </span>
  );
}

const btnGhost = "text-xs text-muted-foreground hover:text-foreground transition-colors";

function ViewDetailsButton({ row }: { row: Row }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    await seedAndOpen(row, router);
  }

  return (
    <>
      <button
        onClick={open}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 py-2.5 text-[13px] font-medium text-accent-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? "Opening…" : "Interview details & transcripts →"}
      </button>

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            <p className="text-sm text-muted-foreground">Opening interview details…</p>
          </div>
        </div>
      )}
    </>
  );
}

// The clean, authoritative "next interview" line — the round the user typed on the
// detail page (name + category + exact date/time), shown above the noisier email timeline.
function PrepNudge({ row }: { row: Row }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (row.nextInterviewAt == null) return null;

  const name = row.nextInterviewName || "Your interview";
  const typeLabel =
    row.nextInterviewType && row.nextInterviewType !== "other"
      ? STAGE_TYPE_LABELS[row.nextInterviewType] || row.nextInterviewType
      : null;

  async function open() {
    setLoading(true);
    await seedAndOpen(row, router);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/25 bg-success-muted p-3 sm:p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            <span className="break-words">{name}</span>
            {typeLabel && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">{typeLabel}</span>}
          </p>
          <p className="text-xs text-muted-foreground">{formatInterview(row.nextInterviewAt)} — open to prep for it.</p>
        </div>
      </div>
      <button
        onClick={open}
        disabled={loading}
        className="shrink-0 rounded-lg bg-success px-4 py-1.5 text-sm font-medium text-success-foreground transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? "Opening…" : "Prep for this →"}
      </button>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="label-mono text-[10px] text-muted-foreground">{label}</span>
      <span className="tnum text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

const triggerBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors";
function triggerClass(active: boolean) {
  return `${triggerBtn} ${
    active
      ? "border-accent bg-accent/10 text-accent"
      : "border-border bg-card text-foreground/80 hover:bg-secondary hover:text-foreground"
  }`;
}

function MergeButton({ row, active, onToggle }: { row: Row; active: boolean; onToggle: () => void }) {
  const [saving, setSaving] = useState(false);

  async function unmerge() {
    if (!window.confirm("Split this merged application back into separate applications?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/merge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: row.id }),
      });
      if (res.ok) window.location.reload();
      else setSaving(false);
    } catch { setSaving(false); }
  }

  if (row.merged) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex max-w-full items-center gap-1.5 break-words rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <LinkIcon /> Merged with {row.mergedWith.join(", ")}
        </span>
        <button onClick={unmerge} disabled={saving} className={btnGhost}>Unmerge</button>
      </div>
    );
  }

  return (
    <button type="button" onClick={onToggle} className={triggerClass(active)}>
      <LinkIcon /> Merge
    </button>
  );
}

function MergePanel({ row, allRows, onClose }: { row: Row; allRows: Row[]; onClose: () => void }) {
  const [mode, setMode] = useState<"picking" | "naming">("picking");
  const [picked, setPicked] = useState<Row | null>(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  const candidates = allRows.filter(
    (r) => r.id !== row.id && (`${r.company} ${r.role}`).toLowerCase().includes(q.toLowerCase())
  );

  async function doMerge(primary: Row, other: Row) {
    setSaving(true);
    try {
      const res = await fetch("/api/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryId: primary.id, otherId: other.id }),
      });
      if (res.ok) window.location.reload();
      else { setSaving(false); alert("Could not merge. Please try again."); }
    } catch { setSaving(false); alert("Could not merge. Please try again."); }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-3 sm:p-4">
      {mode === "picking" ? (
        <>
          <p className="mb-1 text-sm font-medium text-foreground">Which application is the same as this one?</p>
          <p className="mb-3 text-xs text-muted-foreground">Useful when a recruiter and the company both emailed you about the same role.</p>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company or role…"
            className="mb-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-accent focus:ring-4 focus:ring-accent/12"
            autoFocus
          />
          <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {candidates.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">No other applications match.</p>
            ) : (
              candidates.map((c) => (
                <button key={c.id} onClick={() => { setPicked(c); setMode("naming"); }} className="w-full px-3 py-2.5 text-left transition-colors hover:bg-secondary">
                  <span className="block break-words text-sm font-medium text-foreground">{c.company}</span>
                  {c.role && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{c.role}</span>}
                </button>
              ))
            )}
          </div>
          <button onClick={onClose} className={`${btnGhost} mt-3`}>Cancel</button>
        </>
      ) : (
        picked && (
          <>
            <p className="mb-1 text-sm font-medium text-foreground">Which name should the merged application show?</p>
            <p className="mb-3 text-xs text-muted-foreground">Pick the real company (usually not the recruiter).</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => doMerge(row, picked)} disabled={saving} className="rounded-lg border-2 border-border px-4 py-3 text-left transition hover:border-accent disabled:opacity-60">
                <span className="block break-words text-sm font-semibold text-foreground">{row.company}</span>
                {row.role && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{row.role}</span>}
              </button>
              <button onClick={() => doMerge(picked, row)} disabled={saving} className="rounded-lg border-2 border-border px-4 py-3 text-left transition hover:border-accent disabled:opacity-60">
                <span className="block break-words text-sm font-semibold text-foreground">{picked.company}</span>
                {picked.role && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{picked.role}</span>}
              </button>
            </div>
            <button onClick={() => { setMode("picking"); setPicked(null); }} className={`${btnGhost} mt-3`}>Back</button>
          </>
        )
      )}
    </div>
  );
}

function OutcomeButton({ row, active, onToggle }: { row: Row; active: boolean; onToggle: () => void }) {
  const [saving, setSaving] = useState(false);

  async function remove() {
    if (!window.confirm("Remove the manually recorded outcome for this application?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/manual-outcome", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: row.id }),
      });
      if (res.ok) window.location.reload();
      else setSaving(false);
    } catch { setSaving(false); }
  }

  if (row.manual) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex max-w-full items-center gap-1.5 break-words rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground/70">
          <CheckIcon /> Outcome recorded via {row.manualChannel}
        </span>
        <button onClick={onToggle} disabled={saving} className={btnGhost}>Change</button>
        <button onClick={remove} disabled={saving} className={`${btnGhost} hover:text-danger`}>Remove</button>
      </div>
    );
  }

  return (
    <button type="button" onClick={onToggle} className={triggerClass(active)}>
      <EditIcon /> Record outcome
    </button>
  );
}

function OutcomePanel({ row, onClose }: { row: Row; onClose: () => void }) {
  const [status, setStatus] = useState<"Rejected" | "Advancing">("Rejected");
  const [channel, setChannel] = useState("LinkedIn");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const fieldClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/12";

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/manual-outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: row.id, status, channel, reason: reason || undefined, date: date || undefined }),
      });
      if (res.ok) window.location.reload();
      else { setSaving(false); alert("Could not save the outcome. Please try again."); }
    } catch { setSaving(false); alert("Could not save the outcome. Please try again."); }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-3 sm:p-4">
      <p className="mb-1 text-sm font-medium text-foreground">Record an outcome from another channel</p>
      <p className="mb-3 text-xs text-muted-foreground">For results that came by WhatsApp, LinkedIn, phone, etc. — not email.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Outcome</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as "Rejected" | "Advancing")} className={fieldClass}>
            <option value="Rejected">Rejected</option>
            <option value="Advancing">Moved forward</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Channel</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={fieldClass}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Date (optional)</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Reason (optional)</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Went with a more senior candidate" className={fieldClass} />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-60">
          {saving ? "Saving…" : "Save outcome"}
        </button>
        <button onClick={onClose} disabled={saving} className="px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">Cancel</button>
      </div>
    </div>
  );
}

function Timeline({ row, allRows }: { row: Row; allRows: Row[] }) {
  const showDetails = hasRealInterview(row);
  const [openPanel, setOpenPanel] = useState<null | "merge" | "outcome">(null);
  const sideBySide = !row.merged && !row.manual;

  return (
    <div className="animate-row-expand bg-secondary/30 px-4 py-4 sm:px-6 sm:py-5">
      {interviewSoon(row, Date.now()) && <PrepNudge row={row} />}

      <div className="grid gap-6 sm:grid-cols-[minmax(0,280px)_1fr] sm:gap-8">
        {/* Left: meta card + actions */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card px-4 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <MetaItem label="Applied" value={row.firstSeen} />
            <div className="border-t border-border/70" />
            <MetaItem label="Last update" value={row.lastSeen} />
            <div className="border-t border-border/70" />
            <MetaItem label="Current stage" value={STAGE_LABELS[row.currentStage] || "Update"} />
          </div>

          {/* Details + transcripts appear only once a real interview exists —
              not for applied-only or applied→rejected. Merge and Record outcome
              are always available (a next-round or rejection email may arrive
              from a different address and need merging or recording). */}
          <div className="flex flex-col gap-2">
            {showDetails && <ViewDetailsButton row={row} />}
            <div className={sideBySide ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
              <MergeButton row={row} active={openPanel === "merge"} onToggle={() => setOpenPanel((p) => (p === "merge" ? null : "merge"))} />
              <OutcomeButton row={row} active={openPanel === "outcome"} onToggle={() => setOpenPanel((p) => (p === "outcome" ? null : "outcome"))} />
            </div>
          </div>
        </div>

        {/* Right: timeline */}
        <div>
          <p className="label-mono mb-4 text-[10px] text-muted-foreground">Application timeline</p>
          {row.timeline && row.timeline.length > 0 ? (
            <ol className="relative ml-2 border-l-2 border-border">
              {row.timeline.map((e, idx) => (
                <li key={idx} className="mb-5 ml-6 last:mb-0">
                  <span className={`absolute -left-[9px] mt-1 h-4 w-4 rounded-full border-2 border-card ${dotClasses(e.stage)}`} />
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-foreground">{e.label || STAGE_LABELS[e.stage] || "Update"}</span>
                    <span className="tnum text-xs text-muted-foreground">{e.date}</span>
                  </div>
                  {e.subject && <p className="mt-1 break-words text-sm text-muted-foreground">{e.subject}</p>}
                  {e.reason && <p className="mt-1.5 break-words text-sm text-danger"><span className="font-medium">Why:</span> {e.reason}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No timeline details available.</p>
          )}
        </div>
      </div>

      {/* Panels open full-width below the two columns so the picker/form have room */}
      {openPanel === "merge" && <MergePanel row={row} allRows={allRows} onClose={() => setOpenPanel(null)} />}
      {openPanel === "outcome" && <OutcomePanel row={row} onClose={() => setOpenPanel(null)} />}
    </div>
  );
}

function MetaRow({ r }: { r: Row }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="tnum">Applied {r.firstSeen}</span>
      <span className="tnum">Updated {r.lastSeen}</span>
      <span className="inline-flex items-center gap-1">
        Stage:
        <span className={`rounded-full px-2 py-0.5 ${stageClasses(r.currentStage)}`}>{STAGE_LABELS[r.currentStage] || "Update"}</span>
      </span>
    </div>
  );
}

export default function ApplicationsTable({ items, allRows, scanning, emptyMessage = "No applications match your filters.", isNewRow, onSeen }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  // Re-render every minute so the green indicator starts/stops as an interview
  // crosses the 2-day line or passes — without a page reload. (Row ordering is
  // handled in useApplications; this is only the indicator.)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // restore which row was expanded before navigating to a detail page.
  // wait until items have loaded, and only clear the saved key once we've
  // actually found and opened the row (so an early empty render can't eat it).
  useEffect(() => {
    if (items.length === 0) return;
    const key = sessionStorage.getItem("appsExpandedKey");
    if (!key) return;
    const idx = items.findIndex((r) => `${r.company}|||${r.role}` === key);
    if (idx !== -1) {
      const raf = requestAnimationFrame(() => setExpanded(idx));
      sessionStorage.removeItem("appsExpandedKey");
      return () => cancelAnimationFrame(raf);
    }
  }, [items]);

  if (scanning) {
    return (
      <div className="mt-2 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div>
      {/* DESKTOP: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="label-mono px-3 py-2.5 text-[10px] font-normal text-muted-foreground">Company</th>
              <th className="label-mono px-3 py-2.5 text-[10px] font-normal text-muted-foreground">Role</th>
              <th className="label-mono px-3 py-2.5 text-[10px] font-normal text-muted-foreground">Status</th>
              <th className="label-mono px-3 py-2.5 text-[10px] font-normal text-muted-foreground">Applied</th>
              <th className="label-mono px-3 py-2.5 text-[10px] font-normal text-muted-foreground">Last update</th>
              <th className="label-mono px-3 py-2.5 text-[10px] font-normal text-muted-foreground">Current stage</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => {
              const isOpen = expanded === i;
              const isNew = isNewRow?.(r) ?? false;
              const showPill = !isOpen && interviewSoon(r, now);
              const meta = statusMeta(r.status);
              return (
                <Fragment key={i}>
                  <tr
                    onClick={() => { onSeen?.(r.id); setExpanded(isOpen ? null : i); }}
                    className={`cursor-pointer border-b border-border/70 transition-colors ${
                      isNew ? "bg-accent/[0.06] hover:bg-accent/10" : "hover:bg-secondary/60"
                    }`}
                  >
                    <td className="px-3 py-3 font-medium text-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex min-w-0 items-center gap-2.5">
                          <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-90 text-foreground" : ""}`} />
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-[11px] font-semibold text-foreground/70">
                            {initials(r.company)}
                          </span>
                          <span className="truncate">{r.company}</span>
                          {r.merged && <span className="text-accent" title="Merged application"><LinkIcon /></span>}
                          {isNew && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label="New activity" />}
                        </span>
                        {showPill && <NextInterviewPill row={r} />}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-foreground/75">{r.role || "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.pill}`}>
                        <span className={`size-1.5 rounded-full ${meta.dot}`} />
                        {r.status}
                      </span>
                    </td>
                    <td className="tnum px-3 py-3 text-muted-foreground">{r.firstSeen}</td>
                    <td className="tnum px-3 py-3 text-muted-foreground">{r.lastSeen}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${stageClasses(r.currentStage)}`}>{STAGE_LABELS[r.currentStage] || "Update"}</span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} className="border-b border-border p-0"><Timeline row={r} allRows={allRows} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MOBILE: cards */}
      <div className="space-y-3 md:hidden">
        {items.map((r, i) => {
          const isOpen = expanded === i;
          const isNew = isNewRow?.(r) ?? false;
          const showPill = !isOpen && interviewSoon(r, now);
          const meta = statusMeta(r.status);
          return (
            <div
              key={i}
              className={`overflow-hidden rounded-xl border transition-colors ${
                isNew ? "border-accent/30 bg-accent/[0.06]" : "border-border"
              }`}
            >
              <div
                onClick={() => { onSeen?.(r.id); setExpanded(isOpen ? null : i); }}
                className="cursor-pointer p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 break-words font-medium text-foreground">
                      <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-90 text-foreground" : ""}`} />
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-[10px] font-semibold text-foreground/70">
                        {initials(r.company)}
                      </span>
                      <span className="break-words">{r.company}</span>
                      {r.merged && <span className="text-accent"><LinkIcon /></span>}
                      {isNew && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label="New activity" />}
                    </div>
                    {r.role && <div className="mt-0.5 break-words pl-[3.75rem] text-sm text-muted-foreground">{r.role}</div>}
                    {showPill && <div className="mt-1.5 pl-[3.75rem]"><NextInterviewPill row={r} /></div>}
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.pill}`}>
                    <span className={`size-1.5 rounded-full ${meta.dot}`} />
                    {r.status}
                  </span>
                </div>
                <div className="pl-[3.75rem]"><MetaRow r={r} /></div>
              </div>
              {isOpen && <Timeline row={r} allRows={allRows} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}