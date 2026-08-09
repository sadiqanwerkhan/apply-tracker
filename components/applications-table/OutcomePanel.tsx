"use client";

import { useState } from "react";
import { Row } from "@/lib/types";
import { btnGhost, triggerClass, CHANNELS } from "./shared";
import { EditIcon, CheckIcon } from "./icons";

export function OutcomeButton({ row, active, onToggle }: { row: Row; active: boolean; onToggle: () => void }) {
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

export function OutcomePanel({ row, onClose }: { row: Row; onClose: () => void }) {
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
