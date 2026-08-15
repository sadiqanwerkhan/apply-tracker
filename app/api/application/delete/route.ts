import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

// Delete a single application the user considers garbage. Scoped to the user, so
// nobody can delete another user's data. Stages and skill signals cascade-delete
// with it; the application's emails are UNLINKED (set null), not destroyed — so
// the raw email records survive and a future re-scan can re-create the app if it
// truly matches. This matches the intended workflow: the user prunes noise, and
// if a model re-adds it, they can prune again.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  // Verify ownership before deleting.
  const app = await prisma.application.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.application.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}