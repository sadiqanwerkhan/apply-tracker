import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

async function ownStage(userId: string, stageId: string) {
  const stage = await prisma.stage.findUnique({ where: { id: stageId }, include: { application: true } });
  if (!stage || stage.application.userId !== userId) return null;
  return stage;
}

// create a stage
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !body.applicationId || !body.name) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const app = await prisma.application.findUnique({ where: { id: String(body.applicationId) } });
  if (!app || app.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const last = await prisma.stage.findFirst({ where: { applicationId: app.id }, orderBy: { order: "desc" } });
  await prisma.stage.create({ data: { applicationId: app.id, name: String(body.name), type: typeof body.type === "string" ? body.type : "other", order: last ? last.order + 1 : 0 } });
  return NextResponse.json({ ok: true });
}

// rename, change type, or reorder a stage
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !body.id) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const stage = await ownStage(user.id, String(body.id));
  if (!stage) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Reordering is its own operation.
  if (body.move === "up" || body.move === "down") {
    const neighbor = await prisma.stage.findFirst({
      where: {
        applicationId: stage.applicationId,
        order: body.move === "up" ? { lt: stage.order } : { gt: stage.order },
      },
      orderBy: { order: body.move === "up" ? "desc" : "asc" },
    });
    if (neighbor) {
      await prisma.$transaction([
        prisma.stage.update({ where: { id: stage.id }, data: { order: neighbor.order } }),
        prisma.stage.update({ where: { id: neighbor.id }, data: { order: stage.order } }),
      ]);
    }
    return NextResponse.json({ ok: true });
  }

  // Otherwise update name and/or type together in one write.
  const data: { name?: string; type?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.type === "string" && body.type.trim()) data.type = body.type.trim();
  if (Object.keys(data).length > 0) {
    await prisma.stage.update({ where: { id: stage.id }, data });
  }
  return NextResponse.json({ ok: true });
}

// delete a stage (cascade-deletes its transcripts)
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !body.id) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const stage = await ownStage(user.id, String(body.id));
  if (!stage) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.stage.delete({ where: { id: stage.id } });
  return NextResponse.json({ ok: true });
}