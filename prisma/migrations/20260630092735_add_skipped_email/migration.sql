-- CreateTable
CREATE TABLE "SkippedEmail" (
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkippedEmail_pkey" PRIMARY KEY ("userId","messageId")
);

-- CreateIndex
CREATE INDEX "SkippedEmail_userId_idx" ON "SkippedEmail"("userId");
