-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "srpe" INTEGER;

-- Charge ressentie des activités déjà notées : RPE × minutes de déplacement.
UPDATE "Activity" SET "srpe" = ROUND("rpe" * "movingTimeS" / 60.0) WHERE "rpe" IS NOT NULL;
