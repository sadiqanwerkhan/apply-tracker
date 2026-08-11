import { describe, it, expect } from "vitest";

// We test the pure ranking logic by re-implementing the aggregation shape the
// query uses. (The DB call itself is thin; the logic worth testing is the
// counting + sort.) This mirrors getSkillStats' in-memory reduction exactly.
type Sig = { skill: string; performance: string };
function aggregate(signals: Sig[]) {
  const map = new Map<string, { weak: number; okay: number; strong: number }>();
  for (const s of signals) {
    const row = map.get(s.skill) ?? { weak: 0, okay: 0, strong: 0 };
    if (s.performance === "weak") row.weak++;
    else if (s.performance === "okay") row.okay++;
    else if (s.performance === "strong") row.strong++;
    map.set(s.skill, row);
  }
  const stats = [...map.entries()].map(([skill, c]) => {
    const total = c.weak + c.okay + c.strong;
    return { skill, ...c, total, weakRatio: total > 0 ? c.weak / total : 0 };
  });
  stats.sort((a, b) => b.weak - a.weak || b.weakRatio - a.weakRatio || b.total - a.total);
  return stats;
}

describe("skill stats aggregation + ranking", () => {
  it("counts weak/okay/strong per skill", () => {
    const s = aggregate([
      { skill: "React", performance: "weak" },
      { skill: "React", performance: "weak" },
      { skill: "React", performance: "strong" },
    ]);
    expect(s[0]).toMatchObject({ skill: "React", weak: 2, strong: 1, total: 3 });
  });

  it("ranks the most-weak skill first", () => {
    const s = aggregate([
      { skill: "TypeScript", performance: "weak" },
      { skill: "React", performance: "weak" },
      { skill: "React", performance: "weak" },
      { skill: "React", performance: "weak" },
    ]);
    expect(s[0].skill).toBe("React"); // 3 weak beats 1 weak
    expect(s[1].skill).toBe("TypeScript");
  });

  it("breaks ties by weakRatio (repeated weakness over a single bad showing)", () => {
    // Both have weak=2, but CSS is 2/2 weak vs React 2/4 weak → CSS ranks higher
    const s = aggregate([
      { skill: "CSS", performance: "weak" },
      { skill: "CSS", performance: "weak" },
      { skill: "React", performance: "weak" },
      { skill: "React", performance: "weak" },
      { skill: "React", performance: "strong" },
      { skill: "React", performance: "strong" },
    ]);
    expect(s[0].skill).toBe("CSS");
  });

  it("computes weakRatio correctly", () => {
    const s = aggregate([
      { skill: "SQL / Databases", performance: "weak" },
      { skill: "SQL / Databases", performance: "okay" },
    ]);
    expect(s[0].weakRatio).toBeCloseTo(0.5);
  });

  it("handles an empty signal list", () => {
    expect(aggregate([])).toHaveLength(0);
  });
});