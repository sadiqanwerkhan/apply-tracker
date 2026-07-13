import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { inngest } from "@/lib/inngest";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const startDate = String(body?.start || "");
  const endDate = String(body?.end || "");
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "missing_dates" }, { status: 400 });
  }

  // Don't queue a second scan if one is already in flight.
  const active = await prisma.scanJob.findFirst({
    where: { userId: user.id, status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" },
  });
  if (active) return NextResponse.json({ jobId: active.id, alreadyRunning: true });

  const job = await prisma.scanJob.create({
    data: { userId: user.id, startDate, endDate, status: "queued" },
  });

  await inngest.send({
    name: "scan/requested",
    data: { jobId: job.id, userId: user.id, startDate, endDate },
  });

  return NextResponse.json({ jobId: job.id });
}