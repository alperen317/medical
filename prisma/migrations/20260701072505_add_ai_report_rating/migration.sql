-- CreateTable
CREATE TABLE "AiReportRating" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'patient_summary',
    "patientId" TEXT,
    "prompt" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "model" TEXT,
    "ratedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReportRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiReportRating_patientId_idx" ON "AiReportRating"("patientId");

-- CreateIndex
CREATE INDEX "AiReportRating_source_idx" ON "AiReportRating"("source");

-- AddForeignKey
ALTER TABLE "AiReportRating" ADD CONSTRAINT "AiReportRating_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReportRating" ADD CONSTRAINT "AiReportRating_ratedById_fkey" FOREIGN KEY ("ratedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
