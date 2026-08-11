import type { SkillStat } from "./getSkillStats";

// ── Learning-order tiers (generic, not frontend-specific) ────────────────────
// Lower tier = more foundational = learn earlier. The idea: you can't
// effectively learn a framework before the language it's written in, or system
// design before you understand data structures. This is a curated difficulty
// ranking — accurate and free. Skill names match skillKeywords.ts canonicals.
//
// Any skill not listed defaults to a middle tier, so unknown/new skills still
// slot in sensibly without breaking the order.
const TIER: Record<string, number> = {
  // Tier 0 — absolute fundamentals (languages & the basics everything rests on)
  "JavaScript": 0,
  "HTML": 0,
  "CSS": 0,
  "Git": 0,

  // Tier 1 — core language/skill layers built directly on the fundamentals
  "TypeScript": 1,
  "Data Structures & Algorithms": 1,
  "SQL / Databases": 1,

  // Tier 2 — frameworks, libraries, and applied building blocks
  "React": 2,
  "Node.js": 2,
  "REST / APIs": 2,
  "Testing": 2,

  // Tier 3 — things built on the frameworks
  "Next.js": 3,
  "State Management": 3,
  "Docker": 3,

  // Tier 4 — advanced / cross-cutting concerns you tackle once the basics are solid
  "Performance": 4,
  "System Design": 4,
  "Kubernetes": 4,
  "AWS / Cloud": 4,

  // Tier 5 — non-technical, ongoing (never a blocker, so learn/practice last)
  "Behavioral / Communication": 5,
};

const DEFAULT_TIER = 2; // unknown skills land in the middle

function tierOf(skill: string): number {
  return TIER[skill] ?? DEFAULT_TIER;
}

export type LearningStep = SkillStat & {
  tier: number;
};

/**
 * Turn ranked weak skills into an ordered learning path, foundations first.
 *
 * Only skills the user is actually weak in (weak > 0) are included.
 *
 * Ordering:
 *  1. By TIER ascending — fundamentals before advanced topics. This guarantees
 *     a sensible path (e.g. JavaScript/CSS before React before System Design),
 *     regardless of how the weakness counts fall.
 *  2. Within the same tier, the skill the user is MORE weak in comes first
 *     (weak count, then weakRatio) — so among equally-foundational skills you
 *     tackle your worst one first.
 *  3. Alphabetical as a final stable tiebreak.
 */
export function buildLearningPath(stats: SkillStat[]): LearningStep[] {
  const weak = stats.filter((s) => s.weak > 0);
  if (weak.length === 0) return [];

  return weak
    .map((s) => ({ ...s, tier: tierOf(s.skill) }))
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        b.weak - a.weak ||
        b.weakRatio - a.weakRatio ||
        a.skill.localeCompare(b.skill)
    );
}