-- Nettoyage des données de test (base de PRODUCTION, éditeur SQL Neon). Déjà appliqué sur la branche dev (9 activités supprimées).
-- Cibles : (1) activités source = 'manual' de type RUN ou RIDE ; (2) séances de muscu du 2026-10-17 (jour de Paris).
-- Rien d'autre n'est touché : la course Google Fit du 2026-10-20 (source 'google-fit') n'est pas concernée.
-- Clés étrangères (prisma/schema.prisma) : WorkoutExercise, ActivityPhoto, ActivityStream → ON DELETE CASCADE (supprimés avec l'activité) ;
-- RaceEvent.activityId, AthleteMetric.activityId, PlannedSession.completedActivityId → ON DELETE SET NULL (remis à NULL).
-- PersonalRecord.activityId n'a PAS de clé étrangère : voir le bloc A3 avant de supprimer.

-- ===================================================================================================
-- BLOC A : VÉRIFICATION (lecture seule). Attendu : A1 = 6 lignes (4 RUN = 42 km, 2 RIDE = 100 km), A2 = 3 lignes.
-- ===================================================================================================

-- A1. Courses et sorties vélo saisies à la main
SELECT "id", "startedAt", "type", "title", round(("distanceM" / 1000)::numeric, 1) AS km, "movingTimeS"
FROM "Activity"
WHERE "source" = 'manual' AND "type" IN ('RUN', 'RIDE')
ORDER BY "startedAt";

-- A2. Séances de muscu du 2026-10-17 (jour de Paris), avec leur nombre d'exercices
SELECT a."id", a."startedAt", a."type", a."source", a."title", count(e."id") AS exercices
FROM "Activity" a
LEFT JOIN "WorkoutExercise" e ON e."activityId" = a."id"
WHERE a."type" = 'WORKOUT'
  AND (a."startedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::date = DATE '2026-10-17'
GROUP BY a."id"
ORDER BY a."startedAt";

-- A3. Records qui pointent vers ces activités (sans clé étrangère : ils resteraient orphelins). Attendu : 0 ligne.
SELECT r."id", r."kind", r."type", r."value", r."activityId"
FROM "PersonalRecord" r
WHERE r."activityId" IN (
  SELECT "id" FROM "Activity"
  WHERE ("source" = 'manual' AND "type" IN ('RUN', 'RIDE'))
     OR ("type" = 'WORKOUT' AND ("startedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::date = DATE '2026-10-17')
);

-- ===================================================================================================
-- BLOC B : SUPPRESSION. À lancer seulement si le bloc A affiche exactement les lignes attendues.
-- Annule tout (ROLLBACK) si le nombre de lignes supprimées n'est pas 9.
-- ===================================================================================================
BEGIN;

-- Enfants d'abord (explicite, même si les cascades les supprimeraient)
DELETE FROM "WorkoutExercise" WHERE "activityId" IN (
  SELECT "id" FROM "Activity"
  WHERE ("source" = 'manual' AND "type" IN ('RUN', 'RIDE'))
     OR ("type" = 'WORKOUT' AND ("startedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::date = DATE '2026-10-17')
);
DELETE FROM "ActivityPhoto" WHERE "activityId" IN (
  SELECT "id" FROM "Activity"
  WHERE ("source" = 'manual' AND "type" IN ('RUN', 'RIDE'))
     OR ("type" = 'WORKOUT' AND ("startedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::date = DATE '2026-10-17')
);
DELETE FROM "ActivityStream" WHERE "activityId" IN (
  SELECT "id" FROM "Activity"
  WHERE ("source" = 'manual' AND "type" IN ('RUN', 'RIDE'))
     OR ("type" = 'WORKOUT' AND ("startedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::date = DATE '2026-10-17')
);

-- Les activités (RaceEvent, AthleteMetric, PlannedSession sont remis à NULL par leur clé étrangère)
DELETE FROM "Activity"
WHERE ("source" = 'manual' AND "type" IN ('RUN', 'RIDE'))
   OR ("type" = 'WORKOUT' AND ("startedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::date = DATE '2026-10-17');
-- Attendu : DELETE 9. Sinon, taper ROLLBACK; à la place de COMMIT;

COMMIT;
