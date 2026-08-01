import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { generatePrep } from "@/lib/generatePrep";

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { applicationId, stageId } = await req.json().catch(() => ({}));
  if (!applicationId || !stageId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { stages: { orderBy: { order: "asc" }, include: { transcripts: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!app || app.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const target = app.stages.find((s) => s.id === stageId);
  if (!target) return NextResponse.json({ error: "stage_not_found" }, { status: 404 });

  // prior transcripts = every stage that comes BEFORE the target stage (by order)
  const prior = app.stages
    .filter((s) => s.order < target.order)
    .flatMap((s) => s.transcripts.map((t) => ({ stageName: s.name, label: t.label, content: t.content })));

  const prep = await generatePrep({
    company: app.company,
    role: app.role,
    stageName: target.name,
    stageType: target.type,
    jobDescription: app.jobDescription,
    priorTranscripts: prior,
  });

  if (!prep) return NextResponse.json({ error: "no_prep" }, { status: 200 });

  return NextResponse.json({ prep });
}