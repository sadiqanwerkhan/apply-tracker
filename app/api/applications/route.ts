import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggregateEmails } from "@/lib/aggregate";

export async function GET() {
  try {
    const emails = await prisma.email.findMany();
    const rows = aggregateEmails(
      emails.map((e) => ({
        companyKey: e.companyKey,
        company: e.company,
        role: e.role,
        sender: e.sender,
        isAts: e.isAts,
        status: e.status,
        date: e.date.getTime(),
        subject: e.subject,
      }))
    );
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("Load applications error:", err);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}