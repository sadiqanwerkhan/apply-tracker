"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { Row, STAGE_LABELS } from "@/lib/types";

type Props = {
  items: Row[];
  allRows: Row[];
  scanning: boolean;
  emptyMessage?: string;
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

const CHANNELS = ["LinkedIn", "WhatsApp", "Phone", "Indeed", "Email", "Other"];

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

const btnSecondary =
  "inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-gray-100 transition";
const btnGhost = "text-xs text-gray-500 hover:text-gray-800 transition";

const INTERVIEW_STAGE_KEYS = ["screening", "assessment", "interview", "offer"];

function ViewDetailsButton({ row }: { row: Row }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    const seen = new Set<string>();
    const seedStages: string[] = [];
    for (const t of row.timeline || []) {
      if (INTERVIEW_STAGE_KEYS.includes(t.stage) && !seen.has(t.stage)) {
        seen.add(t.stage);
        seedStages.push(STAGE_LABELS[t.stage] || t.stage);
      }
    }
    try {
      const res = await fetch("/api/applications/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: row.company, role: row.role, seedStages }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        // keep the overlay up through navigation (don't unset loading)
        router.push(`/application/${data.id}`);
      } else {
        setLoading(false);
        alert("Could not open details. Please try again.");
      }
    } catch {
      setLoading(false);
      alert("Could not open details. Please try again.");
    }
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

function MergeControl({ row, allRows }: { row: Row; allRows: Row[] }) {
  const [mode, setMode] = useState<"idle" | "picking" | "naming">("idle");
  const [picked, setPicked] = useState<Row | null>(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  const candidates = allRows.filter(
    (r) =>
      !(r.company === row.company && r.role === row.role) &&
      (`${r.company} ${r.role}`).toLowerCase().includes(q.toLowerCase())
  );

  async function doMerge(primary: Row, other: Row) {
    setSaving(true);
    try {
      const res = await fetch("/api/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryCompany: primary.company, primaryRole: primary.role, otherCompany: other.company, otherRole: other.role }),
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
        body: JSON.stringify({ company: row.company, role: row.role }),
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
              candidates.map((c, i) => (
                <button key={i} onClick={() => { setPicked(c); setMode("naming"); }} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition">
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
        body: JSON.stringify({ company: row.company, role: row.role, status, channel, reason: reason || undefined, date: date || undefined }),
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
        body: JSON.stringify({ company: row.company, role: row.role }),
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
  return (
    <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gray-50">
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
        <ViewDetailsButton row={row} />
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

export default function ApplicationsTable({ items, allRows, scanning, emptyMessage = "No applications match your filters." }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

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
              return (
                <Fragment key={i}>
                  <tr onClick={() => setExpanded(isOpen ? null : i)} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <td className="py-3 px-3 font-medium text-gray-900">
                      <span className="inline-flex items-center gap-2">
                        <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                        {r.company}
                        {r.merged && <span className="text-indigo-400" title="Merged application"><LinkIcon /></span>}
                      </span>
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
          return (
            <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
              <div onClick={() => setExpanded(isOpen ? null : i)} className="p-4 cursor-pointer">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 flex items-center gap-1.5 break-words">
                      <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                      <span className="break-words">{r.company}</span>
                      {r.merged && <span className="text-indigo-400"><LinkIcon /></span>}
                    </div>
                    {r.role && <div className="text-sm text-gray-600 mt-0.5 break-words pl-5">{r.role}</div>}
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