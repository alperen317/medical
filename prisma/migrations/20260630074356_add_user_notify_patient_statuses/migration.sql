-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyPatientStatuses" "PatientStatus"[] DEFAULT ARRAY[]::"PatientStatus"[];
