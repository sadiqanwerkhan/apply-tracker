import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { runScanChunk, NoGoogleAccountError } from "@/lib/scanChunk";
import { buildRows } from "@/lib/rows";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const startISO = req.nextUrl.searchParams.get("start") || "";
  const endISO = req.nextUrl.searchParams.get("end") || "";
  if (!startISO || !endISO) {
    return NextResponse.json({ error: "missing_dates" }, { status: 400 });
  }

  try {
    const result = await runScanChunk(user.id, startISO, endISO);
    const rows = await buildRows(user.id);
    return NextResponse.json({ rows, ...result });
  } catch (err) {
    if (err instanceof NoGoogleAccountError) {
      return NextResponse.json({ error: "no_google_account" }, { status: 400 });
    }
    console.error("Scan error:", err);
    return NextResponse.json({ error: "scan_failed" }, { status: 500 });
  }
}