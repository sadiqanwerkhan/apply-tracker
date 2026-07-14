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
      const message = String(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any)?.message || error || "unknown error"
      ).slice(0, 480);
      console.error("SCAN FAILED:", message);
      await prisma.scanJob.update({
        where: { id: jobId },
        data: { status: "failed", error: message },
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