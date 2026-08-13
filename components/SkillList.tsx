import type { SkillStat } from "@/lib/skills/getSkillStats";
import type { LearningStep } from "@/lib/skills/learningPath";
import type { SkillCompanies } from "@/lib/skills/getSkillCompanies";

const TIER_LABEL: Record<number, string> = {
  0: "Fundamental", 1: "Core", 2: "Framework", 3: "Applied", 4: "Advanced", 5: "Ongoing",
};

// One professional, information-dense list. Each row = everything about a skill:
// its learning-order rank, name, tier, a thin performance bar, counts, and the
// companies where it was weak/strong. Muted palette, generous whitespace — a
// calm dashboard, not an alarm. Rows are already in learning order (foundations
// first); a subtle rank badge conveys the order without a separate section.
export function SkillList({
  steps,
  statsBySkill,
  companies,
}: {
  steps: LearningStep[];
  statsBySkill: Record<string, SkillStat>;
  companies?: Record<string, SkillCompanies>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {steps.map((step, i) => {
        const s = statsBySkill[step.skill];
        if (!s) return null;
        const co = companies?.[step.skill];
        const pct = (n: number) => (s.total > 0 ? (n / s.total) * 100 : 0);

        return (
          <div
            key={step.skill}
            className="flex gap-3.5 border-b border-border/60 px-4 py-3.5 last:border-b-0 sm:px-5"
          >
            {/* rank */}
            <div className="flex w-6 shrink-0 justify-center pt-0.5">
              <span className="tnum text-[13px] font-semibold text-muted-foreground/60">{i + 1}</span>
            </div>

            {/* body */}
            <div className="min-w-0 flex-1">
              {/* title row */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[15px] font-semibold text-foreground">{step.skill}</span>
                <span className="rounded border border-border px-1.5 py-px text-[11px] font-medium text-muted-foreground">
                  {TIER_LABEL[step.tier] ?? "Skill"}
                </span>
              </div>

              {/* thin performance bar */}
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-secondary">
                {s.weak > 0 && <div style={{ width: `${pct(s.weak)}%`, background: "var(--danger)", opacity: 0.55 }} />}
                {s.okay > 0 && <div style={{ width: `${pct(s.okay)}%`, background: "var(--warning)", opacity: 0.55 }} />}
                {s.strong > 0 && <div style={{ width: `${pct(s.strong)}%`, background: "var(--success)", opacity: 0.55 }} />}
              </div>

              {/* counts + companies, in muted text */}
              <div className="mt-2 flex flex-col gap-1 text-[12.5px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {s.weak > 0 && <span><span className="tnum font-medium text-foreground/70">{s.weak}</span> weak</span>}
                  {s.okay > 0 && <span><span className="tnum font-medium text-foreground/70">{s.okay}</span> okay</span>}
                  {s.strong > 0 && <span><span className="tnum font-medium text-foreground/70">{s.strong}</span> strong</span>}
                </div>
                {co && (co.weakAt.length > 0 || co.strongAt.length > 0 || co.mixedAt.length > 0) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px]">
                    {co.weakAt.length > 0 && (
                      <span className="text-muted-foreground">
                        weak at <span className="text-foreground/70">{cap(co.weakAt)}</span>
                      </span>
                    )}
                    {co.mixedAt.length > 0 && (
                      <span className="text-muted-foreground">
                        mixed at <span className="text-foreground/70">{cap(co.mixedAt)}</span>
                      </span>
                    )}
                    {co.strongAt.length > 0 && (
                      <span className="text-muted-foreground">
                        strong at <span className="text-foreground/70">{cap(co.strongAt)}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function cap(arr: string[]): string {
  if (arr.length <= 2) return arr.join(", ");
  return `${arr.slice(0, 2).join(", ")} +${arr.length - 2}`;
}
