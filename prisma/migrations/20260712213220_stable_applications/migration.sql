-- DropIndex
DROP INDEX "Application_userId_companyKey_roleKey_key";

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "manualChannel" TEXT,
ADD COLUMN     "manualDate" TIMESTAMP(3),
ADD COLUMN     "manualReason" TEXT,
ADD COLUMN     "manualStatus" TEXT,
ADD COLUMN     "mergedIntoId" TEXT;

-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "applicationId" TEXT;

-- CreateIndex
CREATE INDEX "Application_userId_companyKey_idx" ON "Application"("userId", "companyKey");

-- CreateIndex
CREATE INDEX "Email_applicationId_idx" ON "Email"("applicationId");

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
