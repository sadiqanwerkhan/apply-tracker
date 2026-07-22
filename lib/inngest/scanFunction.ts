import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { runScanChunk } from "@/lib/scanChunk";

const MAX_CHUNKS = 60;

export const scanInbox = inngest.createFunction(
  {
    id: "scan-inbox",
    concurrency: { key: "event.data.userId", limit: 1 },
    retries: 3,
    onFailure: async ({ event, error }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jobId = (event as any)?.data?.event?.data?.jobId;
      if (!jobId) return;
      const raw = String(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any)?.message || error || "unknown error"
      );
      console.error("SCAN FAILED:", raw);

      // A dead/expired Google token is not a normal failure — the user must
      // re-consent. Tag it with a machine-readable code the UI can detect,
      // so it can show a "Reconnect Gmail" button instead of a generic error.
      const isAuth =
        raw.includes("invalid_grant") ||
        raw.includes("no_google_account") ||
        raw.includes("invalid_request") ||
        raw.toLowerCase().includes("token has been expired or revoked");

      await prisma.scanJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          error: isAuth ? "reconnect_required" : raw.slice(0, 480),
        },
      });
    },
  },
  { event: "scan/requested" },
  async ({ event, step }) => {
    const { jobId, userId, startDate, endDate } = event.data as {
      jobId: string; userId: string; startDate: string; endDate: string;
    };

    await step.run("mark-running", async () => {
      await prisma.scanJob.update({ where: { id: jobId }, data: { status: "running" } });
    });

    let totalProcessed = 0;

    for (let i = 0; i < MAX_CHUNKS; i++) {
      const result = await step.run(`chunk-${i}`, async () => {
        return runScanChunk(userId, startDate, endDate);
      });

      totalProcessed += result.processed;

      await step.run(`progress-${i}`, async () => {
        await prisma.scanJob.update({
          where: { id: jobId },
          data: {
            processed: totalProcessed,
            remaining: result.remaining,
            truncated: result.truncated,
          },
        });
      });

      if (result.done) break;
    }

    await step.run("mark-complete", async () => {
      await prisma.scanJob.update({
        where: { id: jobId },
        data: { status: "complete", remaining: 0 },
      });
    });

    return { processed: totalProcessed };
  }
);