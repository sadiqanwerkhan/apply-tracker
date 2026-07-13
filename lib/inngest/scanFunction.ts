import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { runScanChunk, NoGoogleAccountError } from "@/lib/scanChunk";
import { NonRetriableError } from "inngest";

const MAX_CHUNKS = 60; // safety ceiling: 60 x 24 = 1440 emails

export const scanInbox = inngest.createFunction(
  {
    id: "scan-inbox",
    // ONE scan per user at a time. A second request while one is running is queued,
    // not run concurrently. This is our duplicate-scan guard, enforced by the platform.
    concurrency: { key: "event.data.userId", limit: 1 },
    retries: 3,
  },
  { event: "scan/requested" },
  async ({ event, step }) => {
    const { jobId, userId, startDate, endDate } = event.data as {
      jobId: string; userId: string; startDate: string; endDate: string;
    };

    await step.run("mark-running", async () => {
      await prisma.scanJob.update({
        where: { id: jobId },
        data: { status: "running" },
      });
    });

    let totalProcessed = 0;

    try {
      for (let i = 0; i < MAX_CHUNKS; i++) {
        // Each chunk is its own step => its own Vercel invocation, its own retry budget.
        // If this step fails, ONLY this step is retried; earlier chunks are not redone.
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
    } catch (err) {
      // Record the failure so the UI can show it, then decide whether to retry.
      await step.run("mark-failed", async () => {
        await prisma.scanJob.update({
          where: { id: jobId },
          data: {
            status: "failed",
            error: err instanceof NoGoogleAccountError
              ? "Gmail is not connected. Please sign in again."
              : "Scan failed. Please try again.",
          },
        });
      });

      // A missing Google account will never succeed on retry — don't waste attempts.
      if (err instanceof NoGoogleAccountError) {
        throw new NonRetriableError("no_google_account");
      }
      throw err;
    }
  }
);