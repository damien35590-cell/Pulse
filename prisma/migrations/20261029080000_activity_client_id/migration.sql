-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Activity_clientId_key" ON "Activity"("clientId");
