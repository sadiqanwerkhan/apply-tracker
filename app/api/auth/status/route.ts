import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const tokens = cookieStore.get("gmail_tokens");
  return NextResponse.json({ connected: !!tokens });
}