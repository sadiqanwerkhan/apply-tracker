"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Row, STAGE_LABELS } from "@/lib/types";
import { hasRealInterview, interviewSoon, formatInterview, dotClasses, seedAndOpen, STAGE_TYPE_LABELS } from "./shared";
import { MergeButton, MergePanel } from "./MergePanel";
import { OutcomeButton, OutcomePanel } from "./OutcomePanel";

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

// The clean "next interview" nudge — round the user typed on the detail page.
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

export function Timeline({ row, allRows, now }: { row: Row; allRows: Row[]; now: number }) {
  const showDetails = hasRealInterview(row);
  const [openPanel, setOpenPanel] = useState<null | "merge" | "outcome">(null);
  const sideBySide = !row.merged && !row.manual;

  return (
    <div className="animate-row-expand bg-secondary/30 px-4 py-4 sm:px-6 sm:py-5">
      {interviewSoon(row, now) && <PrepNudge row={row} />}

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

      {openPanel === "merge" && <MergePanel row={row} allRows={allRows} onClose={() => setOpenPanel(null)} />}
      {openPanel === "outcome" && <OutcomePanel row={row} onClose={() => setOpenPanel(null)} />}
    </div>
  );
}
