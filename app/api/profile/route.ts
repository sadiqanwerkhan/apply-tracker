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

  // Date of birth ("YYYY-MM-DD"), validated. Age is COMPUTED from it and stored
  // too, so old readers still work — but the birth date is the source of truth.
  let dateOfBirth: string | null = null;
  let age: number | null = null;
  const dob = str(body.dateOfBirth);
  if (dob && /^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    const d = new Date(dob + "T00:00:00Z");
    if (!isNaN(d.getTime())) {
      const now = new Date();
      let a = now.getUTCFullYear() - d.getUTCFullYear();
      const m = now.getUTCMonth() - d.getUTCMonth();
      if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) a--;
      if (a >= 14 && a <= 100) { dateOfBirth = dob; age = a; }
    }
  }

  const data = {
    firstName: str(body.firstName),
    lastName: str(body.lastName),
    contactEmail: str(body.contactEmail),
    dateOfBirth,
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