-- AlterTable
ALTER TABLE "WorkflowInstance" ADD COLUMN     "promotedPatientId" TEXT;

-- CreateIndex
CREATE INDEX "WorkflowInstance_promotedPatientId_idx" ON "WorkflowInstance"("promotedPatientId");

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_promotedPatientId_fkey" FOREIGN KEY ("promotedPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
