import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

// Bulk-delete applications the user selected as garbage. Scoped to the user, so
// only their own applications can be removed. Stages and skill signals cascade;
// emails are unlinked (not destroyed), matching the single-delete behavior — a
// safe prune that a future scan could re-populate.
const MAX_IDS = 200; // sane cap per request

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "no_ids" }, { status: 400 });
  }
  const cleanIds = ids.filter((x): x is string => typeof x === "string").slice(0, MAX_IDS);
  if (cleanIds.length === 0) return NextResponse.json({ error: "no_valid_ids" }, { status: 400 });

  // deleteMany with a userId guard ensures we NEVER delete another user's rows,
  // even if a foreign id is passed in.
  const result = await prisma.application.deleteMany({
    where: { id: { in: cleanIds }, userId: user.id },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}