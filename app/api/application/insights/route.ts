import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { extractInsights } from "@/lib/extractInsights";
import { parse, applicationIdSchema } from "@/lib/validation";
import { checkLimit } from "@/lib/rateLimit";

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  // Read the body ONCE, validate it, and use p.data from here on.
  const raw = await req.json().catch(() => null);
  const p = parse(applicationIdSchema, raw);
  if (!p.ok) return NextResponse.json({ error: "invalid_input", detail: p.error }, { status: 400 });

  // Budget guard: this endpoint calls Claude.
  const limited = await checkLimit(user.id, "insights");
  if (limited) return NextResponse.json(limited, { status: 429 });

  const { applicationId } = p.data;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { stages: { orderBy: { order: "asc" }, include: { transcripts: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!app || app.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const insights = await extractInsights({
    company: app.company,
    role: app.role,
    stages: app.stages.map((s) => ({
      name: s.name,
      transcripts: s.transcripts.map((t) => ({ label: t.label, content: t.content })),
    })),
  });

  if (!insights) return NextResponse.json({ error: "no_insights" }, { status: 200 });

  await prisma.application.update({
    where: { id: applicationId },
    data: { insights, insightsAt: new Date() },
  });

  return NextResponse.json({ insights });
}