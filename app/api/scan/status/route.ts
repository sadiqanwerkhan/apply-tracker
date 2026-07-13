import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { buildRows } from "@/lib/rows";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const jobId = req.nextUrl.searchParams.get("jobId") || "";
  if (!jobId) return NextResponse.json({ error: "missing_job" }, { status: 400 });

  const job = await prisma.scanJob.findUnique({ where: { id: jobId } });
  if (!job || job.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Send fresh rows so the dashboard fills in live as the scan progresses.
  const rows = await buildRows(user.id);

  return NextResponse.json({
    status: job.status,
    processed: job.processed,
    remaining: job.remaining,
    truncated: job.truncated,
    error: job.error,
    rows,
  });
}