-- CreateTable
CREATE TABLE "AppMerge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyKey" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppMerge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppMerge_userId_groupId_idx" ON "AppMerge"("userId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "AppMerge_userId_companyKey_roleKey_key" ON "AppMerge"("userId", "companyKey", "roleKey");
