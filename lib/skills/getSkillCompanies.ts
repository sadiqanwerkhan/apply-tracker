import { prisma } from "@/lib/prisma";

// For one skill: which companies rated the user weak, and which strong.
export type SkillCompanies = {
  weakAt: string[];   // distinct company names where this skill was weak
  strongAt: string[]; // distinct company names where this skill was strong
};

/**
 * Build a per-skill company breakdown for a user: for each skill, the distinct
 * companies where it showed up weak vs strong. Pure data (no AI) — every signal
 * links to an application, and applications have a company name, so this is an
 * exact join. "okay" signals are ignored here (only the clear ends are useful
 * for "where did I struggle / shine").
 *
 * Returns a map keyed by skill name.
 */
export async function getSkillCompanies(userId: string): Promise<Record<string, SkillCompanies>> {
  const signals = await prisma.skillSignal.findMany({
    where: { userId },
    select: {
      skill: true,
      performance: true,
      application: { select: { company: true } },
    },
  });

  const map: Record<string, { weak: Set<string>; strong: Set<string> }> = {};

  for (const s of signals) {
    const company = s.application?.company?.trim();
    if (!company) continue;
    if (!map[s.skill]) map[s.skill] = { weak: new Set(), strong: new Set() };
    if (s.performance === "weak") map[s.skill].weak.add(company);
    else if (s.performance === "strong") map[s.skill].strong.add(company);
  }

  const out: Record<string, SkillCompanies> = {};
  for (const [skill, v] of Object.entries(map)) {
    out[skill] = { weakAt: [...v.weak], strongAt: [...v.strong] };
  }
  return out;
}