-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "aiSummaryAt" TIMESTAMP(3),
ADD COLUMN     "aiSummaryById" TEXT,
ADD COLUMN     "aiSummaryData" JSONB;
