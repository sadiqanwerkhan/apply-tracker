"use client";

import { Fragment, useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { Row, STAGE_LABELS } from "@/lib/types";
import { statusMeta, stageClasses, initials, interviewSoon, formatInterview, shortWhen } from "../components/applications-table/shared";
import { LinkIcon } from "../components/applications-table/icons";
import { Timeline } from "../components/applications-table/Timeline";

type Props = {
  items: Row[];
  allRows: Row[];
  scanning: boolean;
  emptyMessage?: string;
  isNewRow?: (r: Row) => boolean;
  onSeen?: (id: string) => void;
};

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
  // crosses the 2-day line or passes — without a page reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // restore which row was expanded before navigating to a detail page.
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
      <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[760px] text-sm">
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
                      <td colSpan={6} className="border-b border-border p-0"><Timeline row={r} allRows={allRows} now={now} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MOBILE: cards */}
      <div className="space-y-3 lg:hidden">
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
              {isOpen && <Timeline row={r} allRows={allRows} now={now} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
