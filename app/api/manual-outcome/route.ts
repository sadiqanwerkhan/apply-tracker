import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.applicationId || !body?.status || !body?.channel) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const app = await prisma.application.findUnique({ where: { id: String(body.applicationId) } });
  if (!app || app.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await prisma.application.update({
      where: { id: app.id },
      data: {
        manualStatus: body.status === "Advancing" ? "Advancing" : "Rejected",
        manualChannel: String(body.channel),
        manualReason: body.reason ? String(body.reason) : null,
        manualDate: body.date ? new Date(body.date) : new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Manual outcome save error:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.applicationId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const app = await prisma.application.findUnique({ where: { id: String(body.applicationId) } });
  if (!app || app.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await prisma.application.update({
      where: { id: app.id },
      data: { manualStatus: null, manualChannel: null, manualReason: null, manualDate: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Manual outcome delete error:", err);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}