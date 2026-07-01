import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggregateEmails } from "@/lib/aggregate";
import { getCurrentUser } from "@/lib/currentUser";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  try {
    const emails = await prisma.email.findMany({ where: { userId: user.id } });
    const rows = aggregateEmails(
      emails.map((e) => ({
        companyKey: e.companyKey,
        company: e.company,
        role: e.role,
        sender: e.sender,
        isAts: e.isAts,
        status: e.status,
        stage: e.stage,
        date: e.date.getTime(),
        subject: e.subject,
        summary: e.summary,
      }))
    );
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("Load applications error:", err);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}