"use client";

import { useState } from "react";

type GapResult = {
  score: number;
  summary: string;
  matches: string[];
  gaps: { area: string; why: string; howToClose: string }[];
};

// "Gap to this role" — compares the user's honest profile against this
// application's job description and shows a fit score plus what they match, what's
// missing, and how to close each gap. Framed as next steps, never as inadequacy.
export function GapAnalysis({ applicationId, hasJobDescription }: { applicationId: string; hasJobDescription: boolean }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/application/gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(
          d.error === "no_job_description" ? "Add a job description above first."
          : d.error === "empty_profile" ? "Fill in your profile first (work, skills, etc.)."
          : d.error === "rate_limited" ? "Daily limit reached — try again tomorrow."
          : "Couldn't analyze right now. Please try again."
        );
      } else {
        setResult(d.result);
        setOpen(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const scoreColor = (s: number) => (s >= 75 ? "text-success" : s >= 50 ? "text-warning" : "text-danger");
  const ringColor = (s: number) => (s >= 75 ? "var(--success)" : s >= 50 ? "var(--warning)" : "var(--danger)");

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Gap to this role</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">How your profile matches this job — and how to close the gap.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {result && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-foreground/70 transition-colors hover:bg-secondary"
            >
              {open ? "Hide" : "Show"}
            </button>
          )}
          <button
            onClick={run}
            disabled={loading || !hasJobDescription}
            className="rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Analyzing…" : result ? "Re-analyze" : "Analyze"}
          </button>
        </div>
      </div>

      {!hasJobDescription && <p className="mt-3 text-[12px] text-muted-foreground">Add a job description above to enable this.</p>}
      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

      {result && open && (
        <div className="mt-4">
          {/* Score ring + summary */}
          <div className="flex items-center gap-4">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center">
              <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--secondary)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={ringColor(result.score)} strokeWidth="3"
                  strokeDasharray={`${result.score} 100`} strokeLinecap="round" />
              </svg>
              <span className={`absolute text-lg font-bold ${scoreColor(result.score)}`}>{result.score}</span>
            </div>
            <p className="text-[13px] leading-relaxed text-foreground/90">{result.summary}</p>
          </div>

          {/* Matches */}
          {result.matches.length > 0 && (
            <div className="mt-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-success">What you bring</p>
              <ul className="mt-2 space-y-1.5">
                {result.matches.map((m, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-foreground/85">
                    <span className="mt-0.5 text-success">✓</span> {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps */}
          {result.gaps.length > 0 && (
            <div className="mt-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">Where to grow</p>
              <ul className="mt-2 space-y-2.5">
                {result.gaps.map((g, i) => (
                  <li key={i} className="rounded-lg border border-border/60 p-3">
                    <p className="text-[13px] font-medium text-foreground">{g.area}</p>
                    {g.why && <p className="mt-0.5 text-[12px] text-muted-foreground">{g.why}</p>}
                    {g.howToClose && <p className="mt-1.5 text-[12px] text-accent">→ {g.howToClose}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-4 text-[11px] text-muted-foreground">Based on your profile and this job description. An honest guide, not a verdict.</p>
        </div>
      )}
    </div>
  );
}
