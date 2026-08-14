import { prisma } from "@/lib/prisma";
import { defineTool } from "../types";
import { getApplicationDetailInput } from "../schemas";

/**
 * "What stages was I in at X? Where was I rejected?" — full detail for one
 * application: its stages (names, types, order, result) and outcome. Accepts
 * either an application id (from find_applications) or a company name.
 */
export const getApplicationDetail = defineTool({
  name: "get_application_detail",
  description:
    "Get full detail for ONE application: every interview stage in order (name, type, result), the outcome, and any recorded rejection reason. Use this to answer 'what stages was I in at SAP?', 'how many rounds did I do at Google?', or 'where/why was I rejected at X?'. Provide either applicationId (preferred, from find_applications) or a company name.",
  inputSchema: getApplicationDetailInput,
  async run(input, ctx) {
    let appId = input.applicationId;

    // Resolve by company if no id given.
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
      where: { id: appId, userId: ctx.userId }, // scope to user — never leak another user's data
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
      },
    });

    if (!app) return { found: false, reason: "No application with that id for this user." };

    return {
      found: true,
      company: app.company,
      role: app.role || null,
      status: app.manualStatus || "In progress",
      rejectionReason: app.manualStatus === "Rejected" ? app.manualReason || null : null,
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
    };
  },
});