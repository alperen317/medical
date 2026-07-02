-- AlterTable
ALTER TABLE "AiReportRating" ADD COLUMN     "correctedResult" TEXT,
ADD COLUMN     "reasons" TEXT[],
ADD COLUMN     "systemPrompt" TEXT;
