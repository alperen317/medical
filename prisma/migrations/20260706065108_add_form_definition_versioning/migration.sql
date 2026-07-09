/*
  Warnings:

  - Added the required column `rootId` to the `FormDefinition` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FormDefinition" ADD COLUMN     "isLatest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rootId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- Backfill: mevcut satırlar kendi versiyon ailelerinin ilk (ve tek) üyesi olur
UPDATE "FormDefinition" SET "rootId" = "id" WHERE "rootId" IS NULL;

ALTER TABLE "FormDefinition" ALTER COLUMN "rootId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "FormDefinition_rootId_idx" ON "FormDefinition"("rootId");
