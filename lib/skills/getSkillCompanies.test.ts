import { describe, it, expect } from "vitest";

// Mirrors getSkillCompanies' grouping, including the mixed bucket.
type Sig = { skill: string; performance: string; application: { company: string } | null };
function group(signals: Sig[]) {
  const map: Record<string, { weak: Set<string>; strong: Set<string> }> = {};
  for (const s of signals) {
    const company = s.application?.company?.trim();
    if (!company) continue;
    if (!map[s.skill]) map[s.skill] = { weak: new Set(), strong: new Set() };
    if (s.performance === "weak") map[s.skill].weak.add(company);
    else if (s.performance === "strong") map[s.skill].strong.add(company);
  }
  const out: Record<string, { weakAt: string[]; strongAt: string[]; mixedAt: string[] }> = {};
  for (const [skill, v] of Object.entries(map)) {
    const weakOnly: string[] = [];
    const mixed: string[] = [];
    for (const c of v.weak) {
      if (v.strong.has(c)) mixed.push(c);
      else weakOnly.push(c);
    }
    const strongOnly = [...v.strong].filter((c) => !v.weak.has(c));
    out[skill] = { weakAt: weakOnly, strongAt: strongOnly, mixedAt: mixed };
  }
  return out;
}

describe("skill → company breakdown with mixed bucket", () => {
  it("a company weak AND strong for a skill becomes mixed, not both", () => {
    const r = group([
      { skill: "REST / APIs", performance: "weak", application: { company: "IXOPAY" } },
      { skill: "REST / APIs", performance: "strong", application: { company: "IXOPAY" } },
    ]);
    expect(r["REST / APIs"].mixedAt).toEqual(["IXOPAY"]);
    expect(r["REST / APIs"].weakAt).not.toContain("IXOPAY");
    expect(r["REST / APIs"].strongAt).not.toContain("IXOPAY");
  });

  it("weak-only and strong-only companies stay in their buckets", () => {
    const r = group([
      { skill: "React", performance: "weak", application: { company: "Google" } },
      { skill: "React", performance: "strong", application: { company: "Spotify" } },
    ]);
    expect(r["React"].weakAt).toEqual(["Google"]);
    expect(r["React"].strongAt).toEqual(["Spotify"]);
    expect(r["React"].mixedAt).toEqual([]);
  });

  it("handles a three-company mix correctly", () => {
    const r = group([
      { skill: "Testing", performance: "weak", application: { company: "A" } },   // weak only
      { skill: "Testing", performance: "strong", application: { company: "B" } }, // strong only
      { skill: "Testing", performance: "weak", application: { company: "C" } },   // C both -> mixed
      { skill: "Testing", performance: "strong", application: { company: "C" } },
    ]);
    expect(r["Testing"].weakAt).toEqual(["A"]);
    expect(r["Testing"].strongAt).toEqual(["B"]);
    expect(r["Testing"].mixedAt).toEqual(["C"]);
  });

  it("de-duplicates repeated signals from the same company", () => {
    const r = group([
      { skill: "React", performance: "weak", application: { company: "SAP" } },
      { skill: "React", performance: "weak", application: { company: "SAP" } },
    ]);
    expect(r["React"].weakAt).toEqual(["SAP"]);
  });

  it("ignores signals with no company", () => {
    const r = group([{ skill: "React", performance: "weak", application: null }]);
    expect(r["React"]).toBeUndefined();
  });

  it("ignores 'okay' performance", () => {
    const r = group([{ skill: "React", performance: "okay", application: { company: "Google" } }]);
    expect(r["React"].weakAt).toHaveLength(0);
    expect(r["React"].strongAt).toHaveLength(0);
    expect(r["React"].mixedAt).toHaveLength(0);
  });
});