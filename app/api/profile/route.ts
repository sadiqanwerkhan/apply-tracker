import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

// GET — load the current user's profile (plus their login email for auto-fill).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ loginEmail: user.email ?? "", profile });
}

// PUT — create or update the profile (upsert). Only the fields in Piece 1.
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
  // age: accept a positive integer within a sane range, else null.
  let age: number | null = null;
  if (typeof body.age === "number" && Number.isFinite(body.age)) age = Math.trunc(body.age);
  else if (typeof body.age === "string" && body.age.trim()) {
    const n = parseInt(body.age, 10);
    if (Number.isFinite(n)) age = n;
  }
  if (age !== null && (age < 14 || age > 100)) age = null;

  const data = {
    firstName: str(body.firstName),
    lastName: str(body.lastName),
    contactEmail: str(body.contactEmail),
    age,
    phone: str(body.phone),
    location: str(body.location),
  };

  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true, profile });
}