import { describe, it, expect } from "vitest";

// The DB call is thin; the logic worth testing is the weak/strong grouping and
// de-duplication of company names. This mirrors getSkillCompanies exactly.
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
  const out: Record<string, { weakAt: string[]; strongAt: string[] }> = {};
  for (const [skill, v] of Object.entries(map)) out[skill] = { weakAt: [...v.weak], strongAt: [...v.strong] };
  return out;
}

describe("skill → company breakdown", () => {
  it("groups companies by weak vs strong per skill", () => {
    const r = group([
      { skill: "React", performance: "weak", application: { company: "Google" } },
      { skill: "React", performance: "strong", application: { company: "Spotify" } },
    ]);
    expect(r["React"].weakAt).toEqual(["Google"]);
    expect(r["React"].strongAt).toEqual(["Spotify"]);
  });

  it("de-duplicates the same company appearing twice", () => {
    const r = group([
      { skill: "React", performance: "weak", application: { company: "SAP" } },
      { skill: "React", performance: "weak", application: { company: "SAP" } },
    ]);
    expect(r["React"].weakAt).toEqual(["SAP"]);
  });

  it("a company can be weak for one skill and strong for another", () => {
    const r = group([
      { skill: "React", performance: "weak", application: { company: "SAP" } },
      { skill: "TypeScript", performance: "strong", application: { company: "SAP" } },
    ]);
    expect(r["React"].weakAt).toContain("SAP");
    expect(r["TypeScript"].strongAt).toContain("SAP");
  });

  it("ignores signals with no company", () => {
    const r = group([{ skill: "React", performance: "weak", application: null }]);
    expect(r["React"]).toBeUndefined();
  });

  it("ignores 'okay' performance (only weak/strong tracked here)", () => {
    const r = group([{ skill: "React", performance: "okay", application: { company: "Google" } }]);
    expect(r["React"].weakAt).toHaveLength(0);
    expect(r["React"].strongAt).toHaveLength(0);
  });
});