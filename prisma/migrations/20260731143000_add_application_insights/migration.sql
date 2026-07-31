-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "insights" JSONB,
ADD COLUMN     "insightsAt" TIMESTAMP(3);
