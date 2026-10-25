-- isRace fusionné dans sessionType (source unique). Les compétitions déjà marquées passent en 'race' sans écraser un choix existant
-- (sessionType NULL = automatique, il n'y a pas de valeur par défaut en base).
UPDATE "Activity" SET "sessionType" = 'race' WHERE "isRace" = true AND "sessionType" IS NULL;

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "isRace";
