import { describe, it, expect } from "vitest";
import { buildLearningPath } from "./learningPath";
import type { SkillStat } from "./getSkillStats";

const w = (skill: string, weak: number, okay = 0, strong = 0): SkillStat => {
  const total = weak + okay + strong;
  return { skill, weak, okay, strong, total, weakRatio: total ? weak / total : 0 };
};

describe("buildLearningPath — generic difficulty tiers, foundations first", () => {
  it("puts a fundamental before a framework even if the framework is more weak", () => {
    // React (tier 2) is weaker, but JavaScript (tier 0) must come first.
    const path = buildLearningPath([w("React", 5), w("JavaScript", 1)]);
    const names = path.map((s) => s.skill);
    expect(names.indexOf("JavaScript")).toBeLessThan(names.indexOf("React"));
  });

  it("orders a full stack foundations-first: JS/CSS -> TS -> React -> Next.js -> System Design", () => {
    const path = buildLearningPath([
      w("System Design", 2),
      w("Next.js", 1),
      w("React", 1),
      w("TypeScript", 1),
      w("JavaScript", 1),
      w("CSS", 1),
    ]);
    const names = path.map((s) => s.skill);
    // tier order must hold regardless of the weak counts
    expect(names.indexOf("JavaScript")).toBeLessThan(names.indexOf("TypeScript"));
    expect(names.indexOf("TypeScript")).toBeLessThan(names.indexOf("React"));
    expect(names.indexOf("React")).toBeLessThan(names.indexOf("Next.js"));
    expect(names.indexOf("Next.js")).toBeLessThan(names.indexOf("System Design"));
  });

  it("System Design and Performance (advanced) come AFTER fundamentals", () => {
    const path = buildLearningPath([w("Performance", 3), w("System Design", 3), w("CSS", 1)]);
    expect(path[0].skill).toBe("CSS"); // tier 0 beats tier 4 despite fewer weak
  });

  it("Behavioral / Communication is always last (tier 5)", () => {
    const path = buildLearningPath([w("Behavioral / Communication", 5), w("React", 1)]);
    expect(path[path.length - 1].skill).toBe("Behavioral / Communication");
  });

  it("within the same tier, the more-weak skill comes first", () => {
    // CSS and JavaScript are both tier 0 → order by weak count
    const path = buildLearningPath([w("CSS", 1), w("JavaScript", 4)]);
    expect(path[0].skill).toBe("JavaScript");
  });

  it("Docker before Kubernetes (tier 3 before tier 4)", () => {
    const path = buildLearningPath([w("Kubernetes", 3), w("Docker", 1)]);
    expect(path.map((s) => s.skill)).toEqual(["Docker", "Kubernetes"]);
  });

  it("only includes weak skills; strong ones are excluded", () => {
    const path = buildLearningPath([w("React", 2), w("TypeScript", 0, 0, 3)]);
    const names = path.map((s) => s.skill);
    expect(names).toContain("React");
    expect(names).not.toContain("TypeScript");
  });

  it("unknown skills default to the middle tier without crashing", () => {
    const path = buildLearningPath([w("Rust", 2), w("JavaScript", 1), w("System Design", 1)]);
    const names = path.map((s) => s.skill);
    // JS (0) first, System Design (4) last, Rust (default 2) in between
    expect(names[0]).toBe("JavaScript");
    expect(names[names.length - 1]).toBe("System Design");
    expect(names).toContain("Rust");
  });

  it("returns empty when nothing is weak", () => {
    expect(buildLearningPath([w("React", 0, 1, 2)])).toHaveLength(0);
    expect(buildLearningPath([])).toHaveLength(0);
  });
});