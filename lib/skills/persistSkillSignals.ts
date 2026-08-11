import { prisma } from "@/lib/prisma";
import { extractSignalsByKeyword, parseAnalysis, ExtractedSignal } from "./extractSkills";
import { aiSkillFallback } from "./aiSkillFallback";

/**
 * Extract skill signals from a freshly-computed analysis and save them for this
 * application. Called right after an analysis is stored.
 *
 * Two-layer extraction (cheap first, AI for the tail):
 *  1. FREE keyword layer — matches known tech terms in the analysis bullets.
 *  2. AI fallback — for the bullets where NO keyword matched, Haiku maps them to
 *     a known skill by meaning. Only runs when `useAi` is true and there ARE
 *     unmatched bullets, so most analyses cost nothing extra.
 *
 * Re-analyzing REPLACES an application's signals (delete-then-insert). Fully
 * guarded by the caller: must never break the analyze response.
 */
export async function persistSkillSignals(
  applicationId: string,
  userId: string,
  rawAnalysis: string,
  useAi: boolean = true
): Promise<{ saved: number; keyword: number; ai: number } | null> {
  const analysis = parseAnalysis(rawAnalysis);
  if (!analysis) return null;

  const { signals: keywordSignals, unmatched } = extractSignalsByKeyword(analysis);

  // AI fallback only for the bullets the free layer missed.
  let aiSignals: ExtractedSignal[] = [];
  if (useAi && unmatched.length > 0) {
    aiSignals = await aiSkillFallback(unmatched);
  }

  // Merge, de-duping skill+performance across both layers (keyword wins the source tag).
  const merged: ExtractedSignal[] = [];
  const seen = new Set<string>();
  for (const s of [...keywordSignals, ...aiSignals]) {
    const key = `${s.skill}|${s.performance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(s);
  }

  await prisma.$transaction([
    prisma.skillSignal.deleteMany({ where: { applicationId } }),
    ...(merged.length > 0
      ? [
          prisma.skillSignal.createMany({
            data: merged.map((s) => ({
              userId,
              applicationId,
              skill: s.skill,
              performance: s.performance,
              source: s.source,
            })),
          }),
        ]
      : []),
  ]);

  return {
    saved: merged.length,
    keyword: keywordSignals.length,
    ai: aiSignals.length,
  };
}