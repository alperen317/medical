-- AlterTable
ALTER TABLE "WorkflowInstance" ADD COLUMN     "history" JSONB NOT NULL DEFAULT '[]';
