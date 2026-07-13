import { prisma } from "@/lib/prisma";
import { aggregateApplications } from "@/lib/aggregate";
import { Row } from "@/lib/types";

/** Build the dashboard rows for a user from their stable Application records. */
export async function buildRows(userId: string): Promise<Row[]> {
  const apps = await prisma.application.findMany({
    where: { userId },
    include: { emails: true },
  });

  return aggregateApplications(
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
}