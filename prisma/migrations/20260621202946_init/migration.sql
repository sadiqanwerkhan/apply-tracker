-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyKey" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "isAts" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Email_companyKey_idx" ON "Email"("companyKey");

-- CreateIndex
CREATE INDEX "Email_date_idx" ON "Email"("date");
