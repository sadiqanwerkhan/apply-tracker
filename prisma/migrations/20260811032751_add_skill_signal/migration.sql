-- CreateTable
CREATE TABLE "SkillSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "performance" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkillSignal_userId_idx" ON "SkillSignal"("userId");

-- CreateIndex
CREATE INDEX "SkillSignal_userId_skill_idx" ON "SkillSignal"("userId", "skill");

-- CreateIndex
CREATE INDEX "SkillSignal_applicationId_idx" ON "SkillSignal"("applicationId");

-- AddForeignKey
ALTER TABLE "SkillSignal" ADD CONSTRAINT "SkillSignal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
