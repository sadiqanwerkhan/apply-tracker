import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { analyzeInterviews } from "@/lib/analyzeInterviews";
import { parse, analyzeSchema } from "@/lib/validation";
import { checkLimit } from "@/lib/rateLimit";
import { persistSkillSignals } from "@/lib/skills/persistSkillSignals";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const p = parse(analyzeSchema, raw);
  if (!p.ok) return NextResponse.json({ error: "invalid_input", detail: p.error }, { status: 400 });

  // Budget guard: this endpoint calls Claude.
  const limited = await checkLimit(user.id, "analyze");
  if (limited) return NextResponse.json(limited, { status: 429 });

  const app = await prisma.application.findUnique({
    where: { id: p.data.applicationId },
    include: { stages: { orderBy: { order: "asc" }, include: { transcripts: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!app || app.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // outcome from THIS application's own emails (including anything merged into it)
  const memberIds = [
    app.id,
    ...(await prisma.application.findMany({
      where: { userId: user.id, mergedIntoId: app.id },
      select: { id: true },
    })).map((a) => a.id),
  ];
  const emails = await prisma.email.findMany({
    where: { applicationId: { in: memberIds } },
    select: { status: true },
  });
  const manual = app.manualStatus;
  const outcome: "rejected" | "positive" | "unknown" =
    manual === "Rejected" || emails.some((e) => e.status === "Rejected") ? "rejected"
    : manual === "Advancing" || emails.some((e) => e.status === "Advancing") ? "positive"
    : "unknown";

  const analysis = await analyzeInterviews({
    company: app.company,
    role: app.role,
    outcome,
    stages: app.stages.map((s) => ({
      name: s.name,
      transcripts: s.transcripts.map((t) => ({ label: t.label, content: t.content })),
    })),
  });

  if (!analysis) {
    return NextResponse.json({ error: "no_analysis" }, { status: 400 });
  }

  await prisma.application.update({
    where: { id: app.id },
    data: { analysis, analysisAt: new Date() },
  });

  // Extract skill signals from the analysis and save them (free keyword layer).
  // Wrapped so a failure here can NEVER break the analysis the user asked for.
  try {
    await persistSkillSignals(app.id, user.id, analysis);
  } catch (err) {
    console.error("persistSkillSignals failed (non-fatal):", err);
  }

  return NextResponse.json({ analysis });
}