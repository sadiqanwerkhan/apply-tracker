import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

// Ensure an Application has at least one stage, then return it.
// The application ALREADY exists (created at scan time) — we never create one here.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.applicationId) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const app = await prisma.application.findUnique({
    where: { id: String(body.applicationId) },
    include: { stages: true },
  });
  if (!app || app.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (app.stages.length === 0) {
    const seed: string[] =
      Array.isArray(body.seedStages) && body.seedStages.length
        ? body.seedStages.map((s: unknown) => String(s)).filter(Boolean)
        : ["Recruiter Call"];
    await prisma.stage.createMany({
      data: seed.map((name, i) => ({ applicationId: app.id, name, order: i })),
    });
  }

  return NextResponse.json({ id: app.id });
}