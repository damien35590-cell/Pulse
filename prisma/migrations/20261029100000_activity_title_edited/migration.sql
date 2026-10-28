-- Titre saisi par l'utilisateur (renommage, saisie manuelle) : il prime sur le nom de la séance du programme. Activités existantes : false.
-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "titleEdited" BOOLEAN NOT NULL DEFAULT false;
