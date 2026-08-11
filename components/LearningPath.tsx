import type { LearningStep } from "@/lib/skills/learningPath";

// Human labels for the difficulty tiers (must match the tiers in learningPath.ts).
const TIER_LABEL: Record<number, string> = {
  0: "Fundamental",
  1: "Core",
  2: "Framework",
  3: "Applied",
  4: "Advanced",
  5: "Ongoing",
};

// An ordered "learn this first" study plan. Foundations come before the skills
// built on them (JavaScript before React before Next.js before System Design).
export function LearningPath({ steps }: { steps: LearningStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.06] to-transparent p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        </span>
        <h2 className="text-sm font-semibold text-foreground">Suggested learning order</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Foundations first — build up from the basics so each step makes the next easier.
      </p>

      <ol className="relative ml-3 border-l-2 border-accent/20">
        {steps.map((s, i) => (
          <li key={s.skill} className="mb-4 ml-5 last:mb-0">
            <span className="absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
              {i + 1}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-words text-sm font-medium text-foreground">{s.skill}</span>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {TIER_LABEL[s.tier] ?? "Skill"}
              </span>
              <span className="tnum shrink-0 rounded-full bg-danger-muted px-2 py-0.5 text-[11px] font-medium text-danger">
                weak {s.weak}×
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
