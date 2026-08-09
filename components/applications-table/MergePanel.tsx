"use client";

import { useState } from "react";
import { Row } from "@/lib/types";
import { btnGhost, triggerClass } from "./shared";
import { LinkIcon } from "./icons";

export function MergeButton({ row, active, onToggle }: { row: Row; active: boolean; onToggle: () => void }) {
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

export function MergePanel({ row, allRows, onClose }: { row: Row; allRows: Row[]; onClose: () => void }) {
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
