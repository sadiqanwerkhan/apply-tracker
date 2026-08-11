import { keywordMatch } from "./skillKeywords";

// A single extracted skill signal (before it's written to the DB).
export type ExtractedSignal = {
  skill: string;
  performance: "strong" | "okay" | "weak";
  source: "keyword" | "ai";
};

// The analysis JSON shape (from lib/analyzeInterviews). We only need sections.
type AnalysisSection = { type: string; points: string[] };
type Analysis = { sections?: AnalysisSection[] };

// Which analysis sections map to which performance verdict.
// strengths -> strong, struggles/unsure -> weak. (Others are ignored for skills.)
const SECTION_PERFORMANCE: Record<string, "strong" | "weak"> = {
  strengths: "strong",
  struggles: "weak",
  unsure: "weak",
};

/**
 * PURE, testable core. Given a parsed analysis object, return skill signals
 * using the FREE keyword layer only. Any bullet where no keyword matched is
 * returned in `unmatched` so the caller can optionally ask the AI about it.
 *
 * This is the "cheap layer first" half — no AI, no cost, no DB. Fully unit-testable.
 */
export function extractSignalsByKeyword(
  analysis: Analysis
): { signals: ExtractedSignal[]; unmatched: { text: string; performance: "strong" | "weak" }[] } {
  const signals: ExtractedSignal[] = [];
  const unmatched: { text: string; performance: "strong" | "weak" }[] = [];
  const seen = new Set<string>(); // de-dupe skill+performance within one interview

  for (const section of analysis.sections || []) {
    const performance = SECTION_PERFORMANCE[section.type];
    if (!performance) continue; // patterns/actions don't produce skill verdicts
    for (const bullet of section.points || []) {
      const skills = keywordMatch(bullet);
      if (skills.length === 0) {
        unmatched.push({ text: bullet, performance });
        continue;
      }
      for (const skill of skills) {
        const key = `${skill}|${performance}`;
        if (seen.has(key)) continue;
        seen.add(key);
        signals.push({ skill, performance, source: "keyword" });
      }
    }
  }

  return { signals, unmatched };
}

/** Safely parse the stored analysis string into the shape we need. */
export function parseAnalysis(raw: string | null): Analysis | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p && Array.isArray(p.sections)) return p as Analysis;
  } catch {
    // old plain-text analysis — no structured sections to mine
  }
  return null;
}