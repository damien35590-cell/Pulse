-- AlterTable
ALTER TABLE "PlannedSession" ADD COLUMN     "rejectedActivityIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
