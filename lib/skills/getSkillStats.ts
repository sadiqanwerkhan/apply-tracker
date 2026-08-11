import { prisma } from "@/lib/prisma";

export type SkillStat = {
  skill: string;
  weak: number;
  okay: number;
  strong: number;
  total: number;
  // 0..1 — share of appearances where the user was weak. Drives the ranking.
  weakRatio: number;
};

/**
 * Aggregate a user's SkillSignals into per-skill counts, ranked so the biggest
 * weaknesses surface first. This is pure database aggregation (no AI) — the math
 * lives here, not in a model, so the numbers are always exact.
 *
 * Ranking: most-weak first. We sort by (weak count desc), then by weakRatio desc,
 * so a skill you failed 4/5 times outranks one you failed 1/1 time — repeated
 * weakness matters more than a single bad showing.
 */
export async function getSkillStats(userId: string): Promise<SkillStat[]> {
  const signals = await prisma.skillSignal.findMany({
    where: { userId },
    select: { skill: true, performance: true },
  });

  const map = new Map<string, { weak: number; okay: number; strong: number }>();
  for (const s of signals) {
    const row = map.get(s.skill) ?? { weak: 0, okay: 0, strong: 0 };
    if (s.performance === "weak") row.weak++;
    else if (s.performance === "okay") row.okay++;
    else if (s.performance === "strong") row.strong++;
    map.set(s.skill, row);
  }

  const stats: SkillStat[] = [...map.entries()].map(([skill, c]) => {
    const total = c.weak + c.okay + c.strong;
    return { skill, ...c, total, weakRatio: total > 0 ? c.weak / total : 0 };
  });

  stats.sort((a, b) => b.weak - a.weak || b.weakRatio - a.weakRatio || b.total - a.total);
  return stats;
}