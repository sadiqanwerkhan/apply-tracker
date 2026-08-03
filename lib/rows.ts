import { prisma } from "@/lib/prisma";
import { aggregateApplications } from "@/lib/aggregate";
import { Row } from "@/lib/types";

/** Build the dashboard rows for a user from their stable Application records. */
export async function buildRows(userId: string): Promise<Row[]> {
  const apps = await prisma.application.findMany({
    where: { userId },
    include: {
      emails: true,
      // Only the fields we need to decide "is there an upcoming, unfilled interview?"
      stages: { select: { scheduledAt: true, transcripts: { select: { id: true } } } },
    },
  });

  // For each application, find the soonest scheduled round that is still in the
  // future AND has no transcript yet. That timestamp drives the dashboard's
  // "interview soon" dot: it stops mattering once the round passes or a
  // transcript is added (both remove it from this calculation).
  const now = Date.now();
  const nextInterviewByApp = new Map<string, number>();
  for (const a of apps) {
    let soonest: number | null = null;
    for (const st of a.stages) {
      if (!st.scheduledAt) continue;          // no date set
      if (st.transcripts.length > 0) continue; // already have the details
      const t = st.scheduledAt.getTime();
      if (t < now) continue;                   // already passed
      if (soonest === null || t < soonest) soonest = t;
    }
    if (soonest !== null) nextInterviewByApp.set(a.id, soonest);
  }

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

  // Staple the upcoming-interview timestamp onto each row by its stable id.
  return rows.map((r) => ({ ...r, nextInterviewAt: nextInterviewByApp.get(r.id) ?? null }));
}