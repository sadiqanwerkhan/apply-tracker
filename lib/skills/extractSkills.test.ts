import { describe, it, expect } from "vitest";
import { extractSignalsByKeyword, parseAnalysis } from "./extractSkills";

describe("extractSignalsByKeyword — the free keyword layer", () => {
  it("tags a skill as weak when it appears in a struggles bullet", () => {
    const analysis = {
      sections: [
        { type: "struggles", points: ["Couldn't explain React hooks re-render behavior"] },
      ],
    };
    const { signals } = extractSignalsByKeyword(analysis);
    expect(signals).toContainEqual({ skill: "React", performance: "weak", source: "keyword" });
  });

  it("tags a skill as strong when it appears in a strengths bullet", () => {
    const analysis = {
      sections: [
        { type: "strengths", points: ["Strong grasp of TypeScript generics"] },
      ],
    };
    const { signals } = extractSignalsByKeyword(analysis);
    expect(signals).toContainEqual({ skill: "TypeScript", performance: "strong", source: "keyword" });
  });

  it("treats 'unsure' bullets as weak too", () => {
    const analysis = {
      sections: [{ type: "unsure", points: ["Unclear on how Kubernetes pods are scheduled"] }],
    };
    const { signals } = extractSignalsByKeyword(analysis);
    expect(signals).toContainEqual({ skill: "Kubernetes", performance: "weak", source: "keyword" });
  });

  it("can pull multiple skills from one bullet", () => {
    const analysis = {
      sections: [{ type: "struggles", points: ["Mixed up React state management with Redux patterns"] }],
    };
    const { signals } = extractSignalsByKeyword(analysis);
    const names = signals.map((s) => s.skill);
    expect(names).toContain("React");
    expect(names).toContain("State Management");
  });

  it("de-dupes the same skill+performance within one interview", () => {
    const analysis = {
      sections: [
        { type: "struggles", points: ["Weak on React hooks", "React re-rendering confused them"] },
      ],
    };
    const { signals } = extractSignalsByKeyword(analysis);
    const reactWeak = signals.filter((s) => s.skill === "React" && s.performance === "weak");
    expect(reactWeak).toHaveLength(1);
  });

  it("collects bullets with NO keyword match into `unmatched` (for the AI fallback)", () => {
    const analysis = {
      sections: [
        { type: "struggles", points: ["Struggled to reason about the component lifecycle when data changed"] },
      ],
    };
    const { signals, unmatched } = extractSignalsByKeyword(analysis);
    expect(signals).toHaveLength(0); // no literal keyword present
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].performance).toBe("weak");
  });

  it("ignores non-skill sections like patterns and actions", () => {
    const analysis = {
      sections: [
        { type: "patterns", points: ["Tends to rush answers"] },
        { type: "actions", points: ["Practice explaining out loud"] },
      ],
    };
    const { signals, unmatched } = extractSignalsByKeyword(analysis);
    expect(signals).toHaveLength(0);
    expect(unmatched).toHaveLength(0);
  });

  it("handles empty/missing sections without crashing", () => {
    expect(extractSignalsByKeyword({}).signals).toHaveLength(0);
    expect(extractSignalsByKeyword({ sections: [] }).signals).toHaveLength(0);
  });
});

describe("parseAnalysis", () => {
  it("parses a valid analysis JSON string", () => {
    const raw = JSON.stringify({ sections: [{ type: "struggles", points: ["weak on SQL joins"] }] });
    expect(parseAnalysis(raw)).not.toBeNull();
  });
  it("returns null for old plain-text analyses", () => {
    expect(parseAnalysis("You did okay overall.")).toBeNull();
  });
  it("returns null for null input", () => {
    expect(parseAnalysis(null)).toBeNull();
  });
});