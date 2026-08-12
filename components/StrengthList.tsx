import type { SkillStat } from "@/lib/skills/getSkillStats";
import type { SkillCompanies } from "@/lib/skills/getSkillCompanies";

// Skills the user is solid on — shown compactly and calmly. No study-order rank,
// no attention-grabbing bar; just a quiet confirmation of strengths with the
// companies where they showed.
export function StrengthList({
  stats,
  companies,
}: {
  stats: SkillStat[];
  companies?: Record<string, SkillCompanies>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {stats.map((s) => {
        const co = companies?.[s.skill];
        return (
          <div key={s.skill} className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 sm:px-5">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--success)", opacity: 0.6 }} />
              <span className="text-[14px] font-medium text-foreground">{s.skill}</span>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
              {co && co.strongAt.length > 0 && (
                <span className="hidden sm:inline">{co.strongAt.slice(0, 2).join(", ")}{co.strongAt.length > 2 ? ` +${co.strongAt.length - 2}` : ""}</span>
              )}
              <span className="tnum"><span className="font-medium text-foreground/70">{s.strong}</span> strong</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
