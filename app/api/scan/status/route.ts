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

  const base = {
    status: job.status,
    processed: job.processed,
    remaining: job.remaining,
    truncated: job.truncated,
    error: job.error,
  };

  // buildRows() reads the user's ENTIRE application history and aggregates it in
  // memory — far too heavy to run on every 2-second poll. Only compute it when
  // the scan has finished, or when the client explicitly asks for a refresh
  // (?rows=1, which the hook sends occasionally so the list still fills in live).
  const wantsRows = req.nextUrl.searchParams.get("rows") === "1";
  const isDone = job.status === "complete" || job.status === "failed";

  if (wantsRows || isDone) {
    const rows = await buildRows(user.id);
    return NextResponse.json({ ...base, rows });
  }

  return NextResponse.json(base);
}