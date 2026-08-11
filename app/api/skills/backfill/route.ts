import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { persistSkillSignals } from "@/lib/skills/persistSkillSignals";

export const maxDuration = 60;

// One-time (re-runnable) backfill: extract skill signals from ALL of this
// user's already-analyzed applications, so the skills dashboard has data
// without needing to re-run every analysis by hand. Free (keyword layer only).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  // Backfill is FREE (keyword layer only) by default so re-running it costs
  // nothing. Pass ?ai=1 to also run the AI fallback across all interviews
  // (costs one Haiku call per interview that has unmatched bullets).
  const useAi = new URL(req.url).searchParams.get("ai") === "1";

  const apps = await prisma.application.findMany({
    where: { userId: user.id, analysis: { not: null } },
    select: { id: true, analysis: true },
  });

  let processed = 0;
  let totalSignals = 0;

  for (const app of apps) {
    if (!app.analysis) continue;
    try {
      const result = await persistSkillSignals(app.id, user.id, app.analysis, useAi);
      if (result) {
        processed++;
        totalSignals += result.saved;
      }
    } catch (err) {
      console.error(`backfill failed for application ${app.id}:`, err);
    }
  }

  return NextResponse.json({ applicationsProcessed: processed, signalsSaved: totalSignals });
}