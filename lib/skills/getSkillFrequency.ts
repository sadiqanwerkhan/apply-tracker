import { prisma } from "@/lib/prisma";

export type SkillFrequency = {
  skill: string;
  count: number;   // total signals for this skill (any performance)
  pct: number;     // 0..100, share of ALL skill signals
};

/**
 * How often each skill comes up across ALL the user's interviews, regardless of
 * how they did — a "what gets asked most" view. Pure DB aggregation (no AI); the
 * math lives here so the numbers are always exact. Sorted most-frequent first.
 */
export async function getSkillFrequency(userId: string): Promise<SkillFrequency[]> {
  const signals = await prisma.skillSignal.findMany({
    where: { userId },
    select: { skill: true },
  });

  const counts = new Map<string, number>();
  for (const s of signals) counts.set(s.skill, (counts.get(s.skill) ?? 0) + 1);

  const total = signals.length;
  const rows: SkillFrequency[] = [...counts.entries()].map(([skill, count]) => ({
    skill,
    count,
    pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0, // one decimal
  }));

  rows.sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill));
  return rows;
}