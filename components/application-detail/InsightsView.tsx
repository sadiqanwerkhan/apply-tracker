"use client";

import { useMemo } from "react";
import type { Insights, ReactNode } from "./shared";

export function InsightsView({ insights }: { insights: Insights }) {
  const rows = useMemo(() => {
    const out: { label: string; value: ReactNode }[] = [];
    if (insights.techStack && insights.techStack.length > 0)
      out.push({
        label: "Tech stack",
        value: (
          <div className="flex flex-wrap gap-1.5">
            {insights.techStack.map((t, i) => (
              <span key={i} className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">{t}</span>
            ))}
          </div>
        ),
      });
    if (insights.teamSize) out.push({ label: "Team size", value: insights.teamSize });
    if (insights.teamStructure) out.push({ label: "Team structure", value: insights.teamStructure });
    if (insights.product) out.push({ label: "Product", value: insights.product });
    if (insights.payRange) out.push({ label: "Pay range", value: insights.payRange });
    if (insights.nextSteps) out.push({ label: "Next steps", value: insights.nextSteps });
    return out;
  }, [insights]);

  const hasNotes = !!(insights.notes && insights.notes.length > 0);

  if (rows.length === 0 && !hasNotes) {
    return <p className="mt-3 text-xs text-muted-foreground">No specific details were found in the transcripts yet.</p>;
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
          <span className="label-mono shrink-0 pt-0.5 text-[10px] text-muted-foreground sm:w-32">{r.label}</span>
          <div className="flex-1 break-words text-sm text-foreground">{r.value}</div>
        </div>
      ))}
      {hasNotes && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
          <span className="label-mono shrink-0 pt-0.5 text-[10px] text-muted-foreground sm:w-32">Notes</span>
          <ul className="flex-1 space-y-1 text-sm text-foreground">
            {insights.notes!.map((n, i) => (
              <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" /><span className="break-words">{n}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
