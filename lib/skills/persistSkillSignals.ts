import { prisma } from "@/lib/prisma";
import { extractSignalsByKeyword, parseAnalysis } from "./extractSkills";

/**
 * Extract skill signals from a freshly-computed analysis and save them for this
 * application. Called right after an analysis is stored.
 *
 * Design notes:
 *  - Uses the FREE keyword layer only for now (no AI cost). The `unmatched`
 *    bullets are collected but not yet sent to AI — that's a later enhancement,
 *    and this function is where it will plug in.
 *  - Re-analyzing an application REPLACES its signals (delete-then-insert), so a
 *    user who improves and re-runs analysis doesn't keep stale weak signals.
 *  - Fully guarded by the caller: this must never break the analyze response.
 *
 * Returns a small summary (handy for logging / future UI), or null if the
 * analysis had no minable structure.
 */
export async function persistSkillSignals(
  applicationId: string,
  userId: string,
  rawAnalysis: string
): Promise<{ saved: number; unmatched: number } | null> {
  const analysis = parseAnalysis(rawAnalysis);
  if (!analysis) return null; // old plain-text analysis — nothing structured to mine

  const { signals, unmatched } = extractSignalsByKeyword(analysis);

  // Replace this application's signals atomically.
  await prisma.$transaction([
    prisma.skillSignal.deleteMany({ where: { applicationId } }),
    ...(signals.length > 0
      ? [
          prisma.skillSignal.createMany({
            data: signals.map((s) => ({
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

  return { saved: signals.length, unmatched: unmatched.length };
}