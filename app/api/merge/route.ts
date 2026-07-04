import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { normalizeCompanyKey, normalizeRoleKey } from "@/lib/aggregate";

// Link "other" application into "primary" application (primary's name is kept).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.primaryCompany || !body.otherCompany) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const pKey = { companyKey: normalizeCompanyKey(String(body.primaryCompany)), roleKey: normalizeRoleKey(String(body.primaryRole || "")) };
  const oKey = { companyKey: normalizeCompanyKey(String(body.otherCompany)), roleKey: normalizeRoleKey(String(body.otherRole || "")) };

  if (pKey.companyKey === oKey.companyKey && pKey.roleKey === oKey.roleKey) {
    return NextResponse.json({ error: "cannot_merge_self" }, { status: 400 });
  }

  try {
    // ensure primary is in a group (as primary)
    const pExisting = await prisma.appMerge.findUnique({
      where: { userId_companyKey_roleKey: { userId: user.id, companyKey: pKey.companyKey, roleKey: pKey.roleKey } },
    });
    let groupId: string;
    if (pExisting) {
      groupId = pExisting.groupId;
    } else {
      groupId = randomUUID();
      await prisma.appMerge.create({
        data: { userId: user.id, groupId, companyKey: pKey.companyKey, roleKey: pKey.roleKey, company: String(body.primaryCompany), role: String(body.primaryRole || ""), isPrimary: true },
      });
    }

    // gather other's existing group members (if any) to move them all
    const oExisting = await prisma.appMerge.findUnique({
      where: { userId_companyKey_roleKey: { userId: user.id, companyKey: oKey.companyKey, roleKey: oKey.roleKey } },
    });
    if (oExisting) {
      await prisma.appMerge.updateMany({
        where: { userId: user.id, groupId: oExisting.groupId },
        data: { groupId, isPrimary: false },
      });
    } else {
      await prisma.appMerge.create({
        data: { userId: user.id, groupId, companyKey: oKey.companyKey, roleKey: oKey.roleKey, company: String(body.otherCompany), role: String(body.otherRole || ""), isPrimary: false },
      });
    }

    // make sure exactly the primary is flagged primary in this group
    await prisma.appMerge.updateMany({ where: { userId: user.id, groupId }, data: { isPrimary: false } });
    await prisma.appMerge.updateMany({
      where: { userId: user.id, groupId, companyKey: pKey.companyKey, roleKey: pKey.roleKey },
      data: { isPrimary: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Merge error:", err);
    return NextResponse.json({ error: "merge_failed" }, { status: 500 });
  }
}

// Un-merge: remove an application's whole merge group (splits everyone back apart).
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.company) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const companyKey = normalizeCompanyKey(String(body.company));
  const roleKey = normalizeRoleKey(String(body.role || ""));

  try {
    const row = await prisma.appMerge.findUnique({
      where: { userId_companyKey_roleKey: { userId: user.id, companyKey, roleKey } },
    });
    if (row) {
      await prisma.appMerge.deleteMany({ where: { userId: user.id, groupId: row.groupId } });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unmerge error:", err);
    return NextResponse.json({ error: "unmerge_failed" }, { status: 500 });
  }
}