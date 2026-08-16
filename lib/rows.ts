import { prisma } from "@/lib/prisma";
import { aggregateApplications } from "@/lib/aggregate";
import { Row } from "@/lib/types";

/** Build the dashboard rows for a user from their stable Application records. */
export async function buildRows(userId: string): Promise<Row[]> {
  const apps = await prisma.application.findMany({
    where: { userId },
    include: {
      emails: true,
      // Everything needed to describe the next upcoming, unfilled interview.
      stages: { select: { name: true, type: true, scheduledAt: true, transcripts: { select: { id: true } } } },
    },
  });

  // For each application, find the soonest scheduled round that is still in the
  // future AND has no transcript yet, and keep its name + category. That round —
  // hand-entered on the detail page — is the authoritative "next interview" the
  // dashboard shows (the email timeline is noisier: an invite and its confirmation
  // can look like two different stages).
  const now = Date.now();
  const hasStagesByApp = new Set(apps.filter((a) => a.stages.length > 0).map((a) => a.id));
  const nextInterviewByApp = new Map<string, { at: number; name: string; type: string }>();
  for (const a of apps) {
    let best: { at: number; name: string; type: string } | null = null;
    for (const st of a.stages) {
      if (!st.scheduledAt) continue;          // no date set
      if (st.transcripts.length > 0) continue; // already have the details
      const t = st.scheduledAt.getTime();
      if (t < now) continue;                   // already passed
      if (best === null || t < best.at) best = { at: t, name: st.name, type: st.type };
    }
    if (best) nextInterviewByApp.set(a.id, best);
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

  // Staple the upcoming-interview details onto each row by its stable id.
  return rows.map((r) => {
    const ni = nextInterviewByApp.get(r.id);
    return {
      ...r,
      hasStages: hasStagesByApp.has(r.id),
      nextInterviewAt: ni ? ni.at : null,
      nextInterviewName: ni ? ni.name : null,
      nextInterviewType: ni ? ni.type : null,
    };
  });
}