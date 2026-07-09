-- CreateEnum
CREATE TYPE "WorkflowDefinitionStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('in_progress', 'completed');

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "WorkflowDefinitionStatus" NOT NULL DEFAULT 'draft',
    "nodes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientV2" (
    "id" TEXT NOT NULL,
    "tcNo" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "workflowDefId" TEXT NOT NULL,
    "workflowVersion" INTEGER NOT NULL,
    "currentNodeId" TEXT NOT NULL,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'in_progress',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDocument" (
    "id" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowDefinition_branch_status_idx" ON "WorkflowDefinition"("branch", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PatientV2_tcNo_key" ON "PatientV2"("tcNo");

-- CreateIndex
CREATE INDEX "WorkflowInstance_patientId_idx" ON "WorkflowInstance"("patientId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_workflowDefId_idx" ON "WorkflowInstance"("workflowDefId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_status_idx" ON "WorkflowInstance"("status");

-- CreateIndex
CREATE INDEX "WorkflowDocument_workflowInstanceId_idx" ON "WorkflowDocument"("workflowInstanceId");

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientV2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_workflowDefId_fkey" FOREIGN KEY ("workflowDefId") REFERENCES "WorkflowDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDocument" ADD CONSTRAINT "WorkflowDocument_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
