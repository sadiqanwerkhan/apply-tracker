import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { normalizeCompanyKey, normalizeRoleKey } from "@/lib/aggregate";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.company || !body.status || !body.channel) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const status = body.status === "Advancing" ? "Advancing" : "Rejected";
  const company = String(body.company);
  const role = String(body.role || "");
  const channel = String(body.channel);
  const reason = body.reason ? String(body.reason) : null;
  const date = body.date ? new Date(body.date) : new Date();

  const companyKey = normalizeCompanyKey(company);
  const roleKey = normalizeRoleKey(role);

  try {
    await prisma.manualOutcome.upsert({
      where: { userId_companyKey_roleKey: { userId: user.id, companyKey, roleKey } },
      update: { status, channel, reason, date, company, role },
      create: { userId: user.id, companyKey, roleKey, company, role, status, channel, reason, date },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Manual outcome save error:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.company) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const companyKey = normalizeCompanyKey(String(body.company));
  const roleKey = normalizeRoleKey(String(body.role || ""));

  try {
    await prisma.manualOutcome.deleteMany({ where: { userId: user.id, companyKey, roleKey } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Manual outcome delete error:", err);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}