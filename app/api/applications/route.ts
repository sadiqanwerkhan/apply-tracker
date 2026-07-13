import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggregateApplications } from "@/lib/aggregate";
import { getCurrentUser } from "@/lib/currentUser";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  try {
    const apps = await prisma.application.findMany({
      where: { userId: user.id },
      include: { emails: true },
    });

    const rows = aggregateApplications(
      apps.map((a) => ({
        id: a.id,
        company: a.company,
        role: a.role,
        manualStatus: a.manualStatus,
        manualChannel: a.manualChannel,
        manualReason: a.manualReason,
        manualDate: a.manualDate ? a.manualDate.getTime() : null,
        mergedIntoId: a.mergedIntoId,
        emails: a.emails.map((e) => ({
          company: e.company, role: e.role, sender: e.sender, isAts: e.isAts,
          status: e.status, stage: e.stage, date: e.date.getTime(),
          subject: e.subject, summary: e.summary,
        })),
      }))
    );

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("Load applications error:", err);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}