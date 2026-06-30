-- CreateEnum
CREATE TYPE "NotificationAction" AS ENUM ('report_added', 'prescription_added');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyOnActions" "NotificationAction"[] DEFAULT ARRAY[]::"NotificationAction"[];
