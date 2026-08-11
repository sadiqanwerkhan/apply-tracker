import type { SkillStat } from "@/lib/skills/getSkillStats";

// A ranked list of skills as stacked weak/okay/strong bars — biggest weaknesses
// on top. Pure CSS (divs), no chart library. Widths are proportional to counts.
export function SkillBars({ stats }: { stats: SkillStat[] }) {
  if (stats.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm font-medium text-foreground">No skill data yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Analyze a few interviews on their detail pages, and the skills that came up will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats.map((s) => (
        <div key={s.skill}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="break-words text-sm font-medium text-foreground">{s.skill}</span>
            <span className="tnum shrink-0 text-xs text-muted-foreground">
              {s.weak > 0 && <span className="font-semibold text-danger">{s.weak} weak</span>}
              {s.weak > 0 && (s.okay > 0 || s.strong > 0) && " · "}
              {s.okay > 0 && <span className="text-warning">{s.okay} okay</span>}
              {s.okay > 0 && s.strong > 0 && " · "}
              {s.strong > 0 && <span className="text-success">{s.strong} strong</span>}
            </span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-secondary" title={`${s.weak} weak, ${s.okay} okay, ${s.strong} strong`}>
            {s.weak > 0 && <div className="bg-danger" style={{ width: `${(s.weak / s.total) * 100}%` }} />}
            {s.okay > 0 && <div className="bg-warning" style={{ width: `${(s.okay / s.total) * 100}%` }} />}
            {s.strong > 0 && <div className="bg-success" style={{ width: `${(s.strong / s.total) * 100}%` }} />}
          </div>
        </div>
      ))}
    </div>
  );
}
