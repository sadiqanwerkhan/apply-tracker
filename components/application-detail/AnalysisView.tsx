"use client";

import { useState } from "react";
import type { AnalysisSection, Readiness, ParsedAnalysis } from "./shared";

export function parseAnalysis(raw: string): ParsedAnalysis | null {
  try {
    const p = JSON.parse(raw);
    if (p && Array.isArray(p.sections)) return p as ParsedAnalysis;
  } catch {
    // not JSON
  }
  return null;
}

const SECTION_META: Record<string, { label: string; badge: string; dot: string; ring: string }> = {
  strengths: { label: "What you did well", badge: "bg-success-muted text-success", dot: "bg-success", ring: "border-success/25" },
  struggles: { label: "Where you struggled", badge: "bg-warning-muted text-warning", dot: "bg-warning", ring: "border-warning/25" },
  unsure: { label: "Questions you were unsure of", badge: "bg-danger-muted text-danger", dot: "bg-danger", ring: "border-danger/25" },
  patterns: { label: "Recurring patterns", badge: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground", ring: "border-border" },
  actions: { label: "Do differently next time", badge: "bg-accent/10 text-accent", dot: "bg-accent", ring: "border-accent/30" },
};

const SECTION_ORDER = ["strengths", "struggles", "unsure", "patterns", "actions"];

function SectionIcon({ type }: { type: string }) {
  const c = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "strengths") return <svg {...c}><path d="M20 6 9 17l-5-5" /></svg>;
  if (type === "struggles") return <svg {...c}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
  if (type === "unsure") return <svg {...c}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
  if (type === "patterns") return <svg {...c}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>;
  if (type === "actions") return <svg {...c}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
  return <svg {...c}><circle cx="12" cy="12" r="10" /></svg>;
}

function ReadinessBand({ readiness }: { readiness: Readiness }) {
  const meta =
    ({
      strong: { label: "Strong", wrap: "bg-success-muted border-success/25", text: "text-success", seg: "bg-success", filled: 3 },
      mixed: { label: "Mixed", wrap: "bg-warning-muted border-warning/25", text: "text-warning", seg: "bg-warning", filled: 2 },
      needs_work: { label: "Needs work", wrap: "bg-danger-muted border-danger/25", text: "text-danger", seg: "bg-danger", filled: 1 },
    } as Record<string, { label: string; wrap: string; text: string; seg: string; filled: number }>)[readiness.band] ||
    { label: readiness.band, wrap: "bg-secondary border-border", text: "text-foreground", seg: "bg-muted-foreground", filled: 0 };

  return (
    <div className={`mb-4 rounded-2xl border ${meta.wrap} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-mono text-[11px] text-muted-foreground">Interview readiness</p>
          <p className={`text-lg font-bold ${meta.text}`}>{meta.label}</p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2 w-8 rounded-full ${i < meta.filled ? meta.seg : "bg-secondary"}`} />
          ))}
        </div>
      </div>
      {readiness.reason && <p className="mt-2 break-words text-sm text-muted-foreground">{readiness.reason}</p>}
    </div>
  );
}

function CollapsibleSection({ section, defaultOpen }: { section: AnalysisSection; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = SECTION_META[section.type] || { label: section.type, badge: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground", ring: "border-border" };
  const emphasize = section.type === "actions";

  return (
    <div className={`overflow-hidden rounded-xl border ${meta.ring} ${emphasize ? "bg-accent/[0.05]" : "bg-card"}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 p-4 text-left transition hover:bg-foreground/[0.02]">
        <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${meta.badge}`}>
          <SectionIcon type={section.type} />
        </span>
        <h3 className="flex-1 break-words text-sm font-semibold text-foreground">{meta.label}</h3>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{section.points.length}</span>
        <span className={`text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </button>
      {open && (
        <ul className="space-y-1.5 px-4 pb-4">
          {section.points.map((p, j) => (
            <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-foreground/80">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
              <span className="break-words">{p}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnalysisView({ raw }: { raw: string }) {
  const parsed = parseAnalysis(raw);

  // fallback for old plain-text analyses (still fully readable)
  if (!parsed) {
    return <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/90">{raw}</pre>;
  }

  const sections = parsed.sections
    .filter((s) => s.points && s.points.length > 0)
    .sort((a, b) => SECTION_ORDER.indexOf(a.type) - SECTION_ORDER.indexOf(b.type));

  return (
    <div>
      {parsed.readiness && parsed.readiness.band && <ReadinessBand readiness={parsed.readiness} />}
      {parsed.headline && <p className="mb-4 break-words text-base font-medium text-foreground">{parsed.headline}</p>}
      <div className="space-y-2.5">
        {sections.map((s) => (
          <CollapsibleSection key={s.type} section={s} defaultOpen={s.type === "actions"} />
        ))}
      </div>
    </div>
  );
}
