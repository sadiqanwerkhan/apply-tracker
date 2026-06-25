/*
  Warnings:

  - The primary key for the `Email` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `userId` to the `Email` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Email" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyKey" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "isAts" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "id"),
    CONSTRAINT "Email_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Email" ("company", "companyKey", "createdAt", "date", "id", "isAts", "role", "sender", "status", "subject") SELECT "company", "companyKey", "createdAt", "date", "id", "isAts", "role", "sender", "status", "subject" FROM "Email";
DROP TABLE "Email";
ALTER TABLE "new_Email" RENAME TO "Email";
CREATE INDEX "Email_userId_idx" ON "Email"("userId");
CREATE INDEX "Email_companyKey_idx" ON "Email"("companyKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
