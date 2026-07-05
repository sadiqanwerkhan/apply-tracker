import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

async function ownTranscript(userId: string, transcriptId: string) {
  const t = await prisma.transcript.findUnique({
    where: { id: transcriptId },
    include: { stage: { include: { application: true } } },
  });
  if (!t || t.stage.application.userId !== userId) return null;
  return t;
}

// create a transcript under a stage
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !body.stageId || !body.content) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const stage = await prisma.stage.findUnique({ where: { id: String(body.stageId) }, include: { application: true } });
  if (!stage || stage.application.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.transcript.create({
    data: { stageId: stage.id, content: String(body.content), label: body.label ? String(body.label) : null },
  });
  return NextResponse.json({ ok: true });
}

// edit a transcript
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !body.id) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const t = await ownTranscript(user.id, String(body.id));
  if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data: { content?: string; label?: string | null } = {};
  if (typeof body.content === "string") data.content = body.content;
  if (typeof body.label === "string") data.label = body.label || null;
  await prisma.transcript.update({ where: { id: t.id }, data });
  return NextResponse.json({ ok: true });
}

// delete a transcript
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !body.id) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const t = await ownTranscript(user.id, String(body.id));
  if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.transcript.delete({ where: { id: t.id } });
  return NextResponse.json({ ok: true });
}