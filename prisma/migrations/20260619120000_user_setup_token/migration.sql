ALTER TABLE "User" ADD COLUMN "setupToken" TEXT;
ALTER TABLE "User" ADD COLUMN "setupTokenExpiry" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_setupToken_key" ON "User"("setupToken");
