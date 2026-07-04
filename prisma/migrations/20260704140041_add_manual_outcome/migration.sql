-- CreateTable
CREATE TABLE "ManualOutcome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyKey" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "reason" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualOutcome_userId_idx" ON "ManualOutcome"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualOutcome_userId_companyKey_roleKey_key" ON "ManualOutcome"("userId", "companyKey", "roleKey");
