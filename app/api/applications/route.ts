import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { buildRows } from "@/lib/rows";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  try {
    const rows = await buildRows(user.id);
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("Load applications error:", err);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}