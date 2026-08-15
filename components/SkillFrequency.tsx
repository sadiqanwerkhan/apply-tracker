import type { SkillFrequency } from "@/lib/skills/getSkillFrequency";

// A "what comes up most" donut: which skills appear most across all interviews.
// Pure CSS conic-gradient — no chart library. Muted palette to match the page.
// Shows the top skills as slices; the rest are grouped into "Other".

const MAX_SLICES = 6;

// Muted, professional slice colors (soft, distinct, not neon).
const COLORS = [
  "oklch(0.62 0.11 250)", // slate blue
  "oklch(0.68 0.10 160)", // sage green
  "oklch(0.72 0.11 60)",  // muted amber
  "oklch(0.66 0.12 20)",  // dusty rose
  "oklch(0.64 0.09 300)", // muted violet
  "oklch(0.70 0.08 200)", // dusty teal
  "oklch(0.75 0.02 250)", // neutral grey (Other)
];

export function SkillFrequency({ data }: { data: SkillFrequency[] }) {
  if (data.length === 0) return null;

  // Collapse the long tail into "Other" so the donut stays readable.
  const top = data.slice(0, MAX_SLICES);
  const restCount = data.slice(MAX_SLICES).reduce((n, d) => n + d.count, 0);
  const restPct = Math.round(data.slice(MAX_SLICES).reduce((n, d) => n + d.pct, 0) * 10) / 10;
  const slices = [
    ...top.map((d, i) => ({ label: d.skill, count: d.count, pct: d.pct, color: COLORS[i] })),
    ...(restCount > 0 ? [{ label: "Other", count: restCount, pct: restPct, color: COLORS[6] }] : []),
  ];

  // Build the conic-gradient stops.
  let acc = 0;
  const stops = slices
    .map((s) => {
      const start = acc;
      acc += s.pct;
      return `${s.color} ${start}% ${acc}%`;
    })
    .join(", ");

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-1 text-[13px] font-semibold text-foreground">What comes up most</h2>
      <p className="mb-4 text-[12px] text-muted-foreground">
        Share of all skill mentions across your interviews.
      </p>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
        {/* Donut */}
        <div className="relative shrink-0">
          <div
            className="h-36 w-36 rounded-full"
            style={{ background: `conic-gradient(${stops})` }}
            role="img"
            aria-label="Skill frequency donut chart"
          />
          {/* center hole → donut */}
          <div className="absolute inset-0 m-auto h-20 w-20 rounded-full bg-card" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="tnum text-lg font-bold text-foreground">{data.length}</span>
            <span className="text-[10px] text-muted-foreground">skills</span>
          </div>
        </div>

        {/* Legend */}
        <ul className="w-full space-y-1.5">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2.5 text-[13px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-foreground/80">{s.label}</span>
              <span className="tnum shrink-0 text-muted-foreground">{s.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
