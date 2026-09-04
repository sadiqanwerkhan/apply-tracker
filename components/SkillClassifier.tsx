"use client";

import { useState } from "react";
import { fieldBase, btnPrimary } from "@/components/application-detail/shared";

type Classified = { name: string; category: string; what: string; known: boolean };
type Group = { category: string; meaning: string; skills: Classified[] };

// The skills classifier — paste a messy skill list, get it organized into clear
// categories (frontend, backend, databases, observability, etc.) with a plain
// explanation of each, plus an encouraging read on what kind of developer you are.
// Categorization of known tools is instant and free; only unknown tools and the
// summary use AI.
export function SkillClassifier() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function classify() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/skills/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: input }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error === "rate_limited" ? "Daily limit reached — try again tomorrow." : "Couldn't classify. Please try again.");
      } else {
        setGroups(d.grouped || []);
        setInsight(d.insight || null);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-base font-semibold text-foreground">Understand your skills</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        Paste your skills the way you&apos;d list them on a CV — comma or line separated. We&apos;ll organize them
        into clear areas, explain what each one is, and give you an honest read on what kind of developer you are.
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="e.g. TypeScript, React, Prisma, GraphQL, Datadog, Python, Milvus, Docker, AWS…"
        rows={4}
        className={`${fieldBase} mt-4 w-full`}
      />

      <div className="mt-3 flex items-center gap-3">
        <button onClick={classify} disabled={loading || !input.trim()} className={btnPrimary}>
          {loading ? "Analyzing…" : "Analyze my skills"}
        </button>
        {error && <span className="text-[13px] text-danger">{error}</span>}
      </div>

      {/* The encouraging developer-profile summary */}
      {insight && (
        <div className="mt-6 rounded-lg border border-accent/25 bg-accent/[0.05] p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">Your developer profile</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-foreground/90">{insight}</p>
        </div>
      )}

      {/* Categorized skills */}
      {groups && groups.length > 0 && (
        <div className="mt-6 space-y-5">
          {groups.map((g) => (
            <div key={g.category}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[14px] font-semibold text-foreground">{g.category}</h3>
                <span className="text-[11px] text-muted-foreground">{g.skills.length}</span>
              </div>
              <p className="text-[12px] text-muted-foreground">{g.meaning}</p>
              <ul className="mt-2 space-y-1.5">
                {g.skills.map((s) => (
                  <li key={s.name} className="rounded-lg border border-border/60 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground">{s.name}</span>
                      {!s.known && <span className="rounded bg-secondary px-1.5 py-px text-[10px] text-muted-foreground">AI-classified</span>}
                    </div>
                    {s.what && <p className="mt-0.5 text-[12px] text-muted-foreground">{s.what}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {groups && groups.length === 0 && !loading && (
        <p className="mt-4 text-[13px] text-muted-foreground">No recognizable skills found — try listing them separated by commas.</p>
      )}
    </div>
  );
}
