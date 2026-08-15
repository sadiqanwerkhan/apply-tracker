import { describe, it, expect } from "vitest";

// Mirrors getSkillFrequency's aggregation without importing Prisma.
type Sig = { skill: string };
function aggregate(signals: Sig[]) {
  const counts = new Map<string, number>();
  for (const s of signals) counts.set(s.skill, (counts.get(s.skill) ?? 0) + 1);
  const total = signals.length;
  const rows = [...counts.entries()].map(([skill, count]) => ({
    skill, count, pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  }));
  rows.sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill));
  return rows;
}

describe("skill frequency aggregation", () => {
  it("counts signals per skill", () => {
    const r = aggregate([{ skill: "React" }, { skill: "React" }, { skill: "SQL / Databases" }]);
    expect(r.find((x) => x.skill === "React")!.count).toBe(2);
    expect(r.find((x) => x.skill === "SQL / Databases")!.count).toBe(1);
  });

  it("computes percentage of all signals", () => {
    const r = aggregate([{ skill: "React" }, { skill: "React" }, { skill: "Node.js" }, { skill: "Node.js" }]);
    expect(r[0].pct).toBe(50);
  });

  it("sorts most-frequent first", () => {
    const r = aggregate([{ skill: "A" }, { skill: "B" }, { skill: "B" }, { skill: "B" }, { skill: "C" }, { skill: "C" }]);
    expect(r.map((x) => x.skill)).toEqual(["B", "C", "A"]);
  });

  it("percentages sum to ~100", () => {
    const r = aggregate([{ skill: "A" }, { skill: "B" }, { skill: "C" }]);
    const sum = r.reduce((n, x) => n + x.pct, 0);
    expect(Math.round(sum)).toBe(100);
  });

  it("handles empty input", () => {
    expect(aggregate([])).toHaveLength(0);
  });
});