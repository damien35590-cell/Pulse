-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "zoneRibbonAt" TIMESTAMP(3),
ADD COLUMN     "zoneRibbonRef" DOUBLE PRECISION,
ADD COLUMN     "zoneRibbonSource" TEXT;

-- AlterTable
ALTER TABLE "UserZones" ADD COLUMN     "hrMaxEstimate" INTEGER;
