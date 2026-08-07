import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { inngest } from "@/lib/inngest";
import { parse, scanSchema } from "@/lib/validation";
import { checkLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  // Validate the body before doing anything.
  const raw = await req.json().catch(() => null);
  const p = parse(scanSchema, raw);
  if (!p.ok) return NextResponse.json({ error: "invalid_input", detail: p.error }, { status: 400 });
  const { start: startDate, end: endDate } = p.data;

  // Budget guard: a scan spends Gmail quota and AI tokens.
  const limited = await checkLimit(user.id, "scan");
  if (limited) return NextResponse.json(limited, { status: 429 });

  // Don't queue a second scan if one is already in flight.
  const active = await prisma.scanJob.findFirst({
    where: { userId: user.id, status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" },
  });
  if (active) return NextResponse.json({ jobId: active.id, alreadyRunning: true });

  // The DB also enforces one-active-scan-per-user via a partial unique index, so
  // a race that slips past the check above fails here instead of double-running.
  let job;
  try {
    job = await prisma.scanJob.create({
      data: { userId: user.id, startDate, endDate, status: "queued" },
    });
  } catch {
    const existing = await prisma.scanJob.findFirst({
      where: { userId: user.id, status: { in: ["queued", "running"] } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return NextResponse.json({ jobId: existing.id, alreadyRunning: true });
    return NextResponse.json({ error: "could_not_start" }, { status: 500 });
  }

  await inngest.send({
    name: "scan/requested",
    data: { jobId: job.id, userId: user.id, startDate, endDate },
  });

  return NextResponse.json({ jobId: job.id });
}