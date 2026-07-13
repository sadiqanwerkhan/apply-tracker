import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { analyzeInterviews } from "@/lib/analyzeInterviews";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.applicationId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const app = await prisma.application.findUnique({
    where: { id: String(body.applicationId) },
    include: { stages: { orderBy: { order: "asc" }, include: { transcripts: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!app || app.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // find this application's overall outcome from the Email statuses (rejected/advancing/pending)
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

  return NextResponse.json({ analysis });
}