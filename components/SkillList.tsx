import type { SkillStat } from "@/lib/skills/getSkillStats";
import type { LearningStep } from "@/lib/skills/learningPath";
import type { SkillCompanies } from "@/lib/skills/getSkillCompanies";

const TIER_LABEL: Record<number, string> = {
  0: "Fundamental", 1: "Core", 2: "Framework", 3: "Applied", 4: "Advanced", 5: "Ongoing",
};

// A compact, information-dense study plan. Each row keeps everything about a
// skill — rank, name, tier, a thin performance bar, counts, and the companies
// where it was weak/strong — but lays it out tightly so the whole plan needs far
// less scrolling. Rows reveal in a soft staggered sequence on load, the bar
// fills left-to-right, and hovering a row lifts it subtly. Motion is defined in
// globals.css and disabled under prefers-reduced-motion.
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
            className="skill-row group flex items-center gap-3.5 border-b border-border/60 px-4 py-3 transition-colors duration-200 last:border-b-0 hover:bg-secondary/40 sm:px-5"
            style={{ animationDelay: `${Math.min(i * 45, 400)}ms` }}
          >
            {/* rank */}
            <span className="tnum w-5 shrink-0 text-center text-[13px] font-semibold text-muted-foreground/50 transition-colors group-hover:text-accent">
              {i + 1}
            </span>

            {/* body */}
            <div className="min-w-0 flex-1">
              {/* title + tier + inline bar */}
              <div className="flex items-center gap-2.5">
                <span className="truncate text-[14px] font-semibold text-foreground">{step.skill}</span>
                <span className="hidden shrink-0 rounded border border-border px-1.5 py-px text-[10.5px] font-medium text-muted-foreground sm:inline">
                  {TIER_LABEL[step.tier] ?? "Skill"}
                </span>

                {/* thin performance bar — grows on load */}
                <div className="ml-auto flex h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-secondary sm:w-28">
                  {s.weak > 0 && <div className="bar-grow" style={{ width: `${pct(s.weak)}%`, background: "var(--danger)", opacity: 0.6 }} />}
                  {s.okay > 0 && <div className="bar-grow" style={{ width: `${pct(s.okay)}%`, background: "var(--warning)", opacity: 0.6 }} />}
                  {s.strong > 0 && <div className="bar-grow" style={{ width: `${pct(s.strong)}%`, background: "var(--success)", opacity: 0.6 }} />}
                </div>
              </div>

              {/* counts + companies on one tight line */}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                {s.weak > 0 && <span className="text-danger/80"><span className="tnum font-semibold">{s.weak}</span> weak</span>}
                {s.okay > 0 && <span className="text-warning/90"><span className="tnum font-semibold">{s.okay}</span> okay</span>}
                {s.strong > 0 && <span className="text-success/80"><span className="tnum font-semibold">{s.strong}</span> strong</span>}
                {co && (co.weakAt.length > 0 || co.strongAt.length > 0 || co.mixedAt.length > 0) && (
                  <span className="text-muted-foreground/50">·</span>
                )}
                {co?.weakAt.length ? <span>weak at <span className="text-foreground/70">{cap(co.weakAt)}</span></span> : null}
                {co?.mixedAt.length ? <span>mixed at <span className="text-foreground/70">{cap(co.mixedAt)}</span></span> : null}
                {co?.strongAt.length ? <span>strong at <span className="text-foreground/70">{cap(co.strongAt)}</span></span> : null}
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
