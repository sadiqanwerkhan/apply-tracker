import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { createMcpToken } from "@/lib/agent/mcpToken";

// GET — list this user's tokens (metadata only; never the raw token or hash).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const tokens = await prisma.mcpToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true },
  });
  return NextResponse.json({ tokens });
}

// POST — create a new token. Returns the RAW token ONCE (never retrievable again).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.slice(0, 60) : undefined;
  const raw = await createMcpToken(user.id, label);
  return NextResponse.json({ token: raw });
}

// DELETE — revoke a token by id (scoped to the user).
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  await prisma.mcpToken.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}