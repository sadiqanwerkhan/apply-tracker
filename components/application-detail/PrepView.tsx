"use client";

import type { Prep } from "./shared";
import { Chevron } from "./icons";

export function PrepView({ prep, onRegenerate, regenerating, onCollapse }: { prep: Prep; onRegenerate: () => void; regenerating: boolean; onCollapse: () => void }) {
  const blocks: { label: string; items: string[]; dot: string }[] = [];
  if (prep.focusAreas?.length) blocks.push({ label: "What to cover", items: prep.focusAreas, dot: "bg-accent" });
  if (prep.questionsToAsk?.length) blocks.push({ label: "Smart questions to ask", items: prep.questionsToAsk, dot: "bg-success" });
  if (prep.watchOuts?.length) blocks.push({ label: "Watch out for", items: prep.watchOuts, dot: "bg-warning" });

  return (
    <div className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/[0.08] to-transparent p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>
          </span>
          <h4 className="text-sm font-semibold text-foreground">Interview prep</h4>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={onRegenerate} disabled={regenerating} className="text-xs text-accent hover:opacity-70 disabled:opacity-50">
            {regenerating ? "Refreshing…" : "Regenerate"}
          </button>
          <button onClick={onCollapse} className="rounded-lg p-1.5 hover:bg-accent/10" aria-label="Collapse">
            <Chevron open={true} />
          </button>
        </div>
      </div>

      {prep.encouragement && (
        <p className="mb-3 break-words text-sm text-foreground/80">{prep.encouragement}</p>
      )}

      <div className="space-y-3">
        {blocks.map((b, i) => (
          <div key={i}>
            <p className="label-mono mb-1.5 text-[11px] text-muted-foreground">{b.label}</p>
            <ul className="space-y-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed text-foreground/80">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${b.dot}`} />
                  <span className="break-words">{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
