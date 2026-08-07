-- CreateTable
CREATE TABLE "ClassificationCache" (
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassificationCache_pkey" PRIMARY KEY ("userId","hash")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassificationCache_userId_idx" ON "ClassificationCache"("userId");

-- CreateIndex
CREATE INDEX "RateLimit_userId_idx" ON "RateLimit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_userId_action_window_key" ON "RateLimit"("userId", "action", "window");

-- Enforce "at most one queued/running scan per user" in the DATABASE, not just
-- in app code — so two fast clicks (a race the findFirst check can't stop) can't
-- create two running jobs.
--
-- Prisma's schema DSL can't express a partial index, so this lives as raw SQL.
-- Paste it into the migration Prisma generates for the two new models (append it
-- to that migration's migration.sql), OR run it once with `prisma db execute`.
--
-- If you have leftover active jobs from before this index, clear them first or
-- the CREATE will fail:
--   UPDATE "ScanJob" SET status = 'failed', error = 'superseded'
--   WHERE status IN ('queued','running');

CREATE UNIQUE INDEX IF NOT EXISTS "one_active_scan_per_user"
  ON "ScanJob" ("userId")
  WHERE status IN ('queued', 'running');
