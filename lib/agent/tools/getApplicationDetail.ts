import { prisma } from "@/lib/prisma";
import { defineTool } from "../types";
import { getApplicationDetailInput } from "../schemas";

// From the application's emails, derive whether it was rejected and why. The app
// stores email-based outcomes on Email records (status "Rejected", with the
// reason in `summary`) — NOT only in the manual fields. Reading these is what
// lets the agent see email-based rejections instead of being "blind" to them.
function deriveFromEmails(
  emails: { status: string; stage: string; summary: string | null; subject: string; date: Date }[]
): { rejected: boolean; reason: string | null; rejectedOn: string | null } {
  // Most recent rejection email wins (emails come sorted newest-first below).
  const rejection = emails.find(
    (e) => e.status === "Rejected" || e.stage === "rejected"
  );
  if (!rejection) return { rejected: false, reason: null, rejectedOn: null };
  return {
    rejected: true,
    reason: rejection.summary || null,
    rejectedOn: rejection.date.toISOString().slice(0, 10),
  };
}

/**
 * "What stages was I in at X? Where/why was I rejected?" — full detail for one
 * application: its interview stages, plus outcome derived from BOTH the manual
 * fields AND the email timeline. Accepts an application id or a company name.
 */
export const getApplicationDetail = defineTool({
  name: "get_application_detail",
  description:
    "Get full detail for ONE application: every interview stage in order (name, type, result), and the outcome including any rejection reason — whether recorded manually OR found in the email timeline. Use this for 'what stages was I in at SAP?', 'how many rounds at Google?', or 'where/why was I rejected at X?'. Provide either applicationId (preferred, from find_applications) or a company name.",
  inputSchema: getApplicationDetailInput,
  async run(input, ctx) {
    let appId = input.applicationId;

    if (!appId && input.company?.trim()) {
      const match = await prisma.application.findFirst({
        where: { userId: ctx.userId, mergedIntoId: null, company: { contains: input.company.trim(), mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      appId = match?.id;
    }

    if (!appId) return { found: false, reason: "No matching application. Provide an applicationId or a valid company name." };

    const app = await prisma.application.findFirst({
      where: { id: appId, userId: ctx.userId },
      select: {
        company: true,
        role: true,
        manualStatus: true,
        manualReason: true,
        manualChannel: true,
        jobTitle: true,
        jobLocation: true,
        createdAt: true,
        stages: {
          orderBy: { order: "asc" },
          select: { name: true, type: true, result: true, scheduledAt: true },
        },
        emails: {
          orderBy: { date: "desc" },
          select: { status: true, stage: true, summary: true, subject: true, date: true },
        },
      },
    });

    if (!app) return { found: false, reason: "No application with that id for this user." };

    // Outcome comes from manual fields first, then the email timeline.
    const fromEmails = deriveFromEmails(app.emails);
    const isRejected = app.manualStatus === "Rejected" || fromEmails.rejected;
    const rejectionReason =
      app.manualStatus === "Rejected"
        ? app.manualReason || fromEmails.reason
        : fromEmails.reason;

    let status: string;
    if (isRejected) status = "Rejected";
    else if (app.manualStatus === "Advancing") status = "Advancing";
    else status = "In progress";

    return {
      found: true,
      company: app.company,
      role: app.role || null,
      status,
      rejected: isRejected,
      rejectionReason: isRejected ? rejectionReason : null,
      rejectedOn: isRejected ? fromEmails.rejectedOn : null,
      outcomeChannel: app.manualChannel || null,
      appliedOn: app.createdAt.toISOString().slice(0, 10),
      stageCount: app.stages.length,
      stages: app.stages.map((s, i) => ({
        order: i + 1,
        name: s.name,
        type: s.type,
        result: s.result || null,
        scheduledFor: s.scheduledAt ? s.scheduledAt.toISOString().slice(0, 10) : null,
      })),
      // A compact timeline of notable email events, so the agent can answer
      // "what happened / when" questions too.
      timeline: app.emails.slice(0, 12).map((e) => ({
        date: e.date.toISOString().slice(0, 10),
        stage: e.stage,
        status: e.status,
        note: e.summary || e.subject || null,
      })),
    };
  },
});