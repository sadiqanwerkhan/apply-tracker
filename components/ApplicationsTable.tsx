"use client";

import { Fragment, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Row, STAGE_LABELS } from "@/lib/types";

type Props = {
  items: Row[];
  allRows: Row[];
  scanning: boolean;
  emptyMessage?: string;
  isNewRow?: (r: Row) => boolean;
  onSeen?: (id: string) => void;
};

function statusClasses(status: string) {
  if (status === "Advancing") return "bg-green-100 text-green-700";
  if (status === "Rejected") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}
function stageClasses(stage: string) {
  if (stage === "rejected") return "bg-red-50 text-red-600";
  if (stage === "offer") return "bg-emerald-50 text-emerald-700";
  if (stage === "interview" || stage === "assessment" || stage === "screening") return "bg-blue-50 text-blue-600";
  return "bg-gray-100 text-gray-500";
}
function dotClasses(stage: string) {
  if (stage === "rejected") return "bg-red-500";
  if (stage === "offer") return "bg-emerald-500";
  if (stage === "interview" || stage === "assessment" || stage === "screening") return "bg-blue-500";
  return "bg-gray-400";
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

// Compact, named indicator for the collapsed row: pulsing green dot + round name + short time.
function NextInterviewPill({ row }: { row: Row }) {
  if (row.nextInterviewAt == null) return null;
  const name = row.nextInterviewName || "Interview";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-green-50 text-green-800 border border-green-200 pl-1.5 pr-2 py-0.5 text-[11px] font-medium max-w-[240px]"
      title={`${name} · ${formatInterview(row.nextInterviewAt)}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-70 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      <span className="truncate">{name} · {shortWhen(row.nextInterviewAt)}</span>
    </span>
  );
}

const btnSecondary =
  "inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-gray-100 transition";
const btnGhost = "text-xs text-gray-500 hover:text-gray-800 transition";

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
        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60"
      >
        {loading ? "Opening…" : "Interview details & transcripts →"}
      </button>

      {loading && (
        <div className="fixed inset-0 z-50 bg-white/70 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
            <p className="text-sm text-gray-600">Opening interview details…</p>
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
    <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-green-100 text-green-700 shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-green-900 flex items-center gap-2 flex-wrap">
            <span className="break-words">{name}</span>
            {typeLabel && <span className="text-[11px] font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">{typeLabel}</span>}
          </p>
          <p className="text-xs text-green-700">{formatInterview(row.nextInterviewAt)} — open to prep for it.</p>
        </div>
      </div>
      <button
        onClick={open}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-60 shrink-0"
      >
        {loading ? "Opening…" : "Prep for this →"}
      </button>
    </div>
  );
}

function MergeControl({ row, allRows }: { row: Row; allRows: Row[] }) {
  const [mode, setMode] = useState<"idle" | "picking" | "naming">("idle");
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
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 rounded-full px-3 py-1 text-xs font-medium max-w-full break-words">
          <LinkIcon /> Merged with {row.mergedWith.join(", ")}
        </span>
        <button onClick={unmerge} disabled={saving} className={btnGhost}>Unmerge</button>
      </div>
    );
  }

  return (
    <div>
      {mode === "idle" && (
        <button onClick={() => setMode("picking")} className={btnSecondary}>
          <LinkIcon /> Merge with another
        </button>
      )}

      {mode === "picking" && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 w-full sm:max-w-xl">
          <p className="text-sm font-medium text-gray-800 mb-1">Which application is the same as this one?</p>
          <p className="text-xs text-gray-500 mb-3">Useful when a recruiter and the company both emailed you about the same role.</p>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company or role…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            autoFocus
          />
          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-100">
            {candidates.length === 0 ? (
              <p className="text-sm text-gray-400 px-3 py-3">No other applications match.</p>
            ) : (
              candidates.map((c) => (
                <button key={c.id} onClick={() => { setPicked(c); setMode("naming"); }} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition">
                  <span className="block text-sm font-medium text-gray-800 break-words">{c.company}</span>
                  {c.role && <span className="block text-xs text-gray-500 break-words mt-0.5">{c.role}</span>}
                </button>
              ))
            )}
          </div>
          <button onClick={() => { setMode("idle"); setQ(""); }} className={`${btnGhost} mt-3`}>Cancel</button>
        </div>
      )}

      {mode === "naming" && picked && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 w-full sm:max-w-xl">
          <p className="text-sm font-medium text-gray-800 mb-1">Which name should the merged application show?</p>
          <p className="text-xs text-gray-500 mb-3">Pick the real company (usually not the recruiter).</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => doMerge(row, picked)} disabled={saving} className="text-left rounded-lg border-2 border-gray-200 hover:border-indigo-400 px-4 py-3 transition disabled:opacity-60">
              <span className="block text-sm font-semibold text-gray-800 break-words">{row.company}</span>
              {row.role && <span className="block text-xs text-gray-500 mt-0.5 break-words">{row.role}</span>}
            </button>
            <button onClick={() => doMerge(picked, row)} disabled={saving} className="text-left rounded-lg border-2 border-gray-200 hover:border-indigo-400 px-4 py-3 transition disabled:opacity-60">
              <span className="block text-sm font-semibold text-gray-800 break-words">{picked.company}</span>
              {picked.role && <span className="block text-xs text-gray-500 mt-0.5 break-words">{picked.role}</span>}
            </button>
          </div>
          <button onClick={() => { setMode("picking"); setPicked(null); }} className={`${btnGhost} mt-3`}>Back</button>
        </div>
      )}
    </div>
  );
}

function OutcomeControl({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"Rejected" | "Advancing">("Rejected");
  const [channel, setChannel] = useState("LinkedIn");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

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

  return (
    <div>
      {row.manual ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-xs font-medium max-w-full break-words">
            <CheckIcon /> Outcome recorded via {row.manualChannel}
          </span>
          <button onClick={() => setOpen((o) => !o)} disabled={saving} className={btnGhost}>Change</button>
          <button onClick={remove} disabled={saving} className={`${btnGhost} hover:text-red-600`}>Remove</button>
        </div>
      ) : (
        !open && (
          <button onClick={() => setOpen(true)} className={btnSecondary}>
            <EditIcon /> Record outcome
          </button>
        )
      )}

      {open && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 sm:p-4 w-full sm:max-w-2xl">
          <p className="text-sm font-medium text-gray-800 mb-1">Record an outcome from another channel</p>
          <p className="text-xs text-gray-500 mb-3">For results that came by WhatsApp, LinkedIn, phone, etc. — not email.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Outcome</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as "Rejected" | "Advancing")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="Rejected">Rejected</option>
                <option value="Advancing">Moved forward</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date (optional)</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reason (optional)</label>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Went with a more senior candidate" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">
              {saving ? "Saving…" : "Save outcome"}
            </button>
            <button onClick={() => setOpen(false)} disabled={saving} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Timeline({ row, allRows }: { row: Row; allRows: Row[] }) {
  const showDetails = hasRealInterview(row);

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gray-50">
      {interviewSoon(row, Date.now()) && <PrepNudge row={row} />}

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">Application timeline</p>
      {row.timeline && row.timeline.length > 0 ? (
        <ol className="relative border-l-2 border-gray-200 ml-2">
          {row.timeline.map((e, idx) => (
            <li key={idx} className="mb-5 last:mb-0 ml-6">
              <span className={`absolute -left-[9px] mt-1 h-4 w-4 rounded-full border-2 border-white ${dotClasses(e.stage)}`} />
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-semibold text-gray-800">{e.label || STAGE_LABELS[e.stage] || "Update"}</span>
                <span className="text-xs text-gray-400">{e.date}</span>
              </div>
              {e.subject && <p className="text-sm text-gray-500 mt-1 break-words">{e.subject}</p>}
              {e.reason && <p className="text-sm text-red-600 mt-1.5 break-words"><span className="font-medium">Why:</span> {e.reason}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-gray-400">No timeline details available.</p>
      )}

      <div className="mt-5 pt-4 border-t border-gray-200 flex flex-col gap-3">
        {/* Details + transcripts appear only once a real interview exists —
            not for applied-only or applied→rejected. Merge and Record outcome
            are always available (a next-round or rejection email may arrive
            from a different address and need merging or recording). */}
        {showDetails && <ViewDetailsButton row={row} />}
        <MergeControl row={row} allRows={allRows} />
        <OutcomeControl row={row} />
      </div>
    </div>
  );
}

function MetaRow({ r }: { r: Row }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
      <span>Applied {r.firstSeen}</span>
      <span>Updated {r.lastSeen}</span>
      <span className="inline-flex items-center gap-1">
        Stage:
        <span className={`px-2 py-0.5 rounded-full ${stageClasses(r.currentStage)}`}>{STAGE_LABELS[r.currentStage] || "Update"}</span>
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
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-center text-gray-400 py-8">{emptyMessage}</p>;
  }

  return (
    <div>
      {/* DESKTOP: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-3 px-3 font-medium">Company</th>
              <th className="py-3 px-3 font-medium">Role</th>
              <th className="py-3 px-3 font-medium">Status</th>
              <th className="py-3 px-3 font-medium">Applied</th>
              <th className="py-3 px-3 font-medium">Last update</th>
              <th className="py-3 px-3 font-medium">Current stage</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => {
              const isOpen = expanded === i;
              const isNew = isNewRow?.(r) ?? false;
              const showPill = !isOpen && interviewSoon(r, now);
              return (
                <Fragment key={i}>
                  <tr
                    onClick={() => { onSeen?.(r.id); setExpanded(isOpen ? null : i); }}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      isNew ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="py-3 px-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-2">
                          <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                          {r.company}
                          {r.merged && <span className="text-indigo-400" title="Merged application"><LinkIcon /></span>}
                        </span>
                        {showPill && <NextInterviewPill row={r} />}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{r.role || "—"}</td>
                    <td className="py-3 px-3"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClasses(r.status)}`}>{r.status}</span></td>
                    <td className="py-3 px-3 text-gray-500">{r.firstSeen}</td>
                    <td className="py-3 px-3 text-gray-500">{r.lastSeen}</td>
                    <td className="py-3 px-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${stageClasses(r.currentStage)}`}>{STAGE_LABELS[r.currentStage] || "Update"}</span></td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} className="p-0 border-b border-gray-100"><Timeline row={r} allRows={allRows} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MOBILE: cards */}
      <div className="md:hidden space-y-3">
        {items.map((r, i) => {
          const isOpen = expanded === i;
          const isNew = isNewRow?.(r) ?? false;
          const showPill = !isOpen && interviewSoon(r, now);
          return (
            <div
              key={i}
              className={`border rounded-xl overflow-hidden transition-colors ${
                isNew ? "border-blue-200 bg-blue-50" : "border-gray-200"
              }`}
            >
              <div
                onClick={() => { onSeen?.(r.id); setExpanded(isOpen ? null : i); }}
                className="p-4 cursor-pointer"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 flex items-center gap-1.5 break-words">
                      <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                      <span className="break-words">{r.company}</span>
                      {r.merged && <span className="text-indigo-400"><LinkIcon /></span>}
                    </div>
                    {r.role && <div className="text-sm text-gray-600 mt-0.5 break-words pl-5">{r.role}</div>}
                    {showPill && <div className="pl-5 mt-1.5"><NextInterviewPill row={r} /></div>}
                  </div>
                  <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${statusClasses(r.status)}`}>{r.status}</span>
                </div>
                <div className="pl-5"><MetaRow r={r} /></div>
              </div>
              {isOpen && <Timeline row={r} allRows={allRows} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
