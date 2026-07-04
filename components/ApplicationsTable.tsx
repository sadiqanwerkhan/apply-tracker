"use client";

import { Fragment, useState } from "react";
import { Row, STAGE_LABELS } from "@/lib/types";

type Props = {
  items: Row[];
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

function OutcomeForm({ row }: { row: Row }) {
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
        body: JSON.stringify({
          company: row.company,
          role: row.role,
          status,
          channel,
          reason: reason || undefined,
          date: date || undefined,
        }),
      });
      if (res.ok) window.location.reload();
      else { setSaving(false); alert("Could not save the outcome. Please try again."); }
    } catch {
      setSaving(false);
      alert("Could not save the outcome. Please try again.");
    }
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
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      {row.manual ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600">
            ✔ Outcome recorded manually via <strong>{row.manualChannel}</strong>
          </span>
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-indigo-600 hover:underline"
            disabled={saving}
          >
            Change
          </button>
          <button
            onClick={remove}
            className="text-xs text-red-500 hover:underline"
            disabled={saving}
          >
            Remove
          </button>
        </div>
      ) : (
        !open && (
          <button
            onClick={() => setOpen(true)}
            className="text-sm text-indigo-600 hover:underline"
          >
            + Record an outcome from another channel
          </button>
        )
      )}

      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 max-w-2xl">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Outcome</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "Rejected" | "Advancing")}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="Rejected">Rejected</option>
              <option value="Advancing">Moved forward</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date (optional)</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Went with a more senior candidate"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save outcome"}
            </button>
            <button
              onClick={() => setOpen(false)}
              disabled={saving}
              className="text-sm text-gray-500 px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Timeline({ row }: { row: Row }) {
  return (
    <div className="px-6 py-5 bg-gray-50">
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
              {e.subject && <p className="text-sm text-gray-500 mt-1">{e.subject}</p>}
              {e.reason && (
                <p className="text-sm text-red-600 mt-1.5">
                  <span className="font-medium">Why:</span> {e.reason}
                </p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-gray-400">No timeline details available.</p>
      )}
      <OutcomeForm row={row} />
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-gray-100">
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "70%" }} /></td>
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "85%" }} /></td>
          <td className="py-4 px-3"><div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" /></td>
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "70%" }} /></td>
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "70%" }} /></td>
          <td className="py-4 px-3"><div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" /></td>
        </tr>
      ))}
    </>
  );
}

export default function ApplicationsTable({ items, scanning, emptyMessage = "No applications match your filters." }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto">
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
          {scanning ? (
            <SkeletonRows />
          ) : (
            items.map((r, i) => {
              const isOpen = expanded === i;
              return (
                <Fragment key={i}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : i)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-3 px-3 font-medium text-gray-900">
                      <span className="inline-flex items-center gap-2">
                        <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                        {r.company}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{r.role || "—"}</td>
                    <td className="py-3 px-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClasses(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-500">{r.firstSeen}</td>
                    <td className="py-3 px-3 text-gray-500">{r.lastSeen}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${stageClasses(r.currentStage)}`}>
                        {STAGE_LABELS[r.currentStage] || "Update"}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} className="p-0 border-b border-gray-100">
                        <Timeline row={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
      {!scanning && items.length === 0 && (
        <p className="text-center text-gray-400 py-8">{emptyMessage}</p>
      )}
    </div>
  );
}