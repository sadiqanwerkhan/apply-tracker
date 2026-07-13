import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

// POST { primaryId, otherId } — fold `other` (and anything merged into it) into `primary`.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.primaryId || !body?.otherId || body.primaryId === body.otherId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const [primary, other] = await Promise.all([
    prisma.application.findUnique({ where: { id: String(body.primaryId) } }),
    prisma.application.findUnique({ where: { id: String(body.otherId) } }),
  ]);
  if (!primary || !other || primary.userId !== user.id || other.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    // anything merged into `other` now points at `primary`
    await prisma.application.updateMany({
      where: { userId: user.id, mergedIntoId: other.id },
      data: { mergedIntoId: primary.id },
    });
    // and `other` itself
    await prisma.application.update({
      where: { id: other.id },
      data: { mergedIntoId: primary.id },
    });
    // make sure primary is a root
    await prisma.application.update({
      where: { id: primary.id },
      data: { mergedIntoId: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Merge error:", err);
    return NextResponse.json({ error: "merge_failed" }, { status: 500 });
  }
}

// DELETE { applicationId } — split the whole group apart.
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.applicationId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const app = await prisma.application.findUnique({ where: { id: String(body.applicationId) } });
  if (!app || app.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rootId = app.mergedIntoId || app.id;
  try {
    await prisma.application.updateMany({
      where: { userId: user.id, mergedIntoId: rootId },
      data: { mergedIntoId: null },
    });
    await prisma.application.update({ where: { id: rootId }, data: { mergedIntoId: null } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unmerge error:", err);
    return NextResponse.json({ error: "unmerge_failed" }, { status: 500 });
  }
}