-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'update',
ADD COLUMN     "summary" TEXT;
