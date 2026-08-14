import { prisma } from "@/lib/prisma";
import { defineTool } from "../types";
import { findApplicationsInput } from "../schemas";

// Derive a plain-English status from an application's data (mirrors the app's
// own logic at a high level, without needing the full email pipeline).
function statusOf(a: { manualStatus: string | null; analysis: string | null }): string {
  if (a.manualStatus === "Rejected") return "Rejected";
  if (a.manualStatus === "Advancing") return "Advancing";
  return "In progress";
}

/**
 * "Did I apply/interview at X?" — find the user's applications, optionally
 * filtered by company name (partial, case-insensitive). Returns a compact list
 * the model can reason over.
 */
export const findApplications = defineTool({
  name: "find_applications",
  description:
    "Find the user's job applications, optionally filtered by company name. Use this to answer questions like 'did I apply to SAP?', 'which companies did I interview at?', or 'show my applications at Google'. Returns company, role, status, when applied, and how many interview stages each has.",
  inputSchema: findApplicationsInput,
  async run(input, ctx) {
    const where: Record<string, unknown> = { userId: ctx.userId, mergedIntoId: null };
    if (input.company && input.company.trim()) {
      where.company = { contains: input.company.trim(), mode: "insensitive" };
    }

    const apps = await prisma.application.findMany({
      where,
      select: {
        id: true,
        company: true,
        role: true,
        manualStatus: true,
        analysis: true,
        createdAt: true,
        _count: { select: { stages: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      count: apps.length,
      applications: apps.map((a) => ({
        id: a.id,
        company: a.company,
        role: a.role || null,
        status: statusOf(a),
        appliedOn: a.createdAt.toISOString().slice(0, 10),
        interviewStages: a._count.stages,
      })),
    };
  },
});