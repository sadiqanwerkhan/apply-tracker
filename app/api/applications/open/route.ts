import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { normalizeCompanyKey, normalizeRoleKey } from "@/lib/aggregate";

// Get-or-create the Application record for a (company + role), seeding its
// editable stages the first time. Returns the record id so the client can
// navigate to /application/[id].
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.company) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const company = String(body.company);
  const role = String(body.role || "");
  const companyKey = normalizeCompanyKey(company);
  const roleKey = normalizeRoleKey(role);

  const seedStages: string[] =
    Array.isArray(body.seedStages) && body.seedStages.length
      ? body.seedStages.map((s: unknown) => String(s)).filter(Boolean)
      : ["Recruiter Call"];

  try {
    const existing = await prisma.application.findUnique({
      where: { userId_companyKey_roleKey: { userId: user.id, companyKey, roleKey } },
    });
    if (existing) return NextResponse.json({ id: existing.id });

    const created = await prisma.application.create({
      data: {
        userId: user.id,
        companyKey,
        roleKey,
        company,
        role,
        stages: { create: seedStages.map((name, i) => ({ name, order: i })) },
      },
    });
    return NextResponse.json({ id: created.id });
  } catch (err) {
    console.error("Open application error:", err);
    return NextResponse.json({ error: "open_failed" }, { status: 500 });
  }
}