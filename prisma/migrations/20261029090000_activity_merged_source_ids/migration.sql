-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "mergedSourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
