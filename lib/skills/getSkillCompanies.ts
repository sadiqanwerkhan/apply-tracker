import { prisma } from "@/lib/prisma";

// For one skill: which companies rated the user weak, strong, or BOTH (mixed).
// A company that appears as both weak and strong for the same skill is "mixed" —
// it lives ONLY in mixedAt, never double-listed in weakAt and strongAt. This
// removes the confusing "weak at X · strong at X" overlap.
export type SkillCompanies = {
  weakAt: string[];   // companies where this skill was ONLY weak
  strongAt: string[]; // companies where this skill was ONLY strong
  mixedAt: string[];  // companies where it was both weak AND strong
};

/**
 * Build a per-skill company breakdown for a user. Pure data (no AI) — every
 * signal links to an application with a company name, so this is an exact join.
 * "okay" signals are ignored (only the clear ends matter for "where I struggled
 * / shone"). Companies seen as both weak and strong for a skill become "mixed".
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
    const weakOnly: string[] = [];
    const mixed: string[] = [];
    for (const c of v.weak) {
      if (v.strong.has(c)) mixed.push(c); // both → mixed
      else weakOnly.push(c);              // weak only
    }
    const strongOnly = [...v.strong].filter((c) => !v.weak.has(c));
    out[skill] = { weakAt: weakOnly, strongAt: strongOnly, mixedAt: mixed };
  }
  return out;
}