/*
  Warnings:

  - You are about to drop the column `analysis` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `analysisAt` on the `Application` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Application" DROP COLUMN "analysis",
DROP COLUMN "analysisAt",
ADD COLUMN     "jobDescription" TEXT,
ADD COLUMN     "jobLocation" TEXT,
ADD COLUMN     "jobTitle" TEXT;
