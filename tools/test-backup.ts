// Test du CSV de sauvegarde (pur, sans base) : npm test
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { toCsv, ACTIVITY_FIELDS, RESTORE_ORDER, SCHEMA_VERSION, type BackupFile } from "../lib/backup/strength-export";
import { revive } from "../lib/backup/revive";

const data = Object.fromEntries(RESTORE_ORDER.map(([k]) => [k, []])) as unknown as BackupFile["data"];
data.exercises = [{ id: "e1", slug: "dips" }];
data.activities = [{ id: "a1", title: "Haut, \"force\"", startedAt: "2026-10-26T23:30:00.000Z" }];
data.workoutExercises = [
  { id: "w1", activityId: "a1", position: 0, name: "Dips", sets: 2, reps: 8, loadKg: null, restS: 90, comment: "=risque", exerciseId: "e1",
    setsDetail: [{ reps: 9, loadKg: 10, done: true, restTakenS: 80 }, { reps: 7, done: false }, { reps: 8, loadKg: 10, done: true }] },
  { id: "w2", activityId: "a1", position: 1, name: "Gainage", sets: 2, reps: 30, loadKg: 5, restS: 60, comment: null, exerciseId: null, setsDetail: null },
];
const csv = toCsv({ schemaVersion: SCHEMA_VERSION, exportedAt: "", userId: "u", profile: { homeEquipment: [] }, counts: {} as BackupFile["counts"], data });
const lines = csv.replace("﻿", "").trim().split("\r\n");
assert.equal(lines[0], "date,seance,exercice_code,exercice,serie,reps,charge_kg,repos_s,commentaire");
assert.equal(lines.length, 1 + 2 + 2, "séries non faites exclues, séries prévues sans détail développées");
assert.equal(lines[1], `2026-10-27,"Haut, ""force""",dips,Dips,1,9,10,80,'=risque`); // 23 h 30 UTC = le 27 à Paris ; formule neutralisée
assert.equal(lines[2], `2026-10-27,"Haut, ""force""",dips,Dips,2,8,10,90,`);
assert.equal(lines[3], `2026-10-27,"Haut, ""force""",,Gainage,1,30,5,60,`);

// ── Échauffement : sauvegardé avec la séance, sauvegardes d'avant toujours lisibles ──
assert.ok(ACTIVITY_FIELDS.includes("warmup" as never), "Activity.warmup part dans la sauvegarde");
assert.ok(ACTIVITY_FIELDS.includes("hrSeries" as never) && !ACTIVITY_FIELDS.includes("trackPoints" as never), "les champs lourds restent exclus");
assert.equal(SCHEMA_VERSION, 1, "format additif : une sauvegarde d'avant garde la même version (le script de restauration refuse les autres)");

const warm = { v: 1, items: [{ name: "Corde à sauter", durationS: 182, targetS: 180 }, { name: "Gym / mobilité", durationS: 298, targetS: 300 }], endS: 480 };
const withWarm = revive("Activity", { id: "a1", title: "Haut", startedAt: "2026-10-31T08:00:00.000Z", warmup: warm, hrSeries: null });
assert.deepEqual(withWarm.warmup, warm, "l'échauffement revient tel quel");
assert.ok(withWarm.startedAt instanceof Date);
assert.equal(withWarm.hrSeries, Prisma.DbNull, "null d'un champ Json traduit pour Prisma");
assert.equal(revive("Activity", { id: "a2", warmup: null }).warmup, Prisma.DbNull, "séance sans échauffement (passé) : null");

const old = revive("Activity", { id: "a0", title: "Ancienne sauvegarde", startedAt: "2026-10-01T08:00:00.000Z" });
assert.equal("warmup" in old, false, "sauvegarde d'avant : le champ reste absent (null à la création, valeur en base intacte à la mise à jour)");
assert.deepEqual(Object.keys(revive("Activity", { id: "a3", champFutur: 1, warmup: warm })).sort(), ["id", "warmup"], "champ inconnu ignoré");
assert.equal(revive("User", { id: "u", warmupDefaults: [{ name: "Corde", min: 3 }] }).warmupDefaults !== undefined, true);

// L'échauffement n'entre pas dans le CSV (une ligne par série d'exercice) : le CSV d'une séance avec échauffement est identique.
data.activities = [{ ...data.activities[0], warmup: warm }];
assert.equal(toCsv({ schemaVersion: SCHEMA_VERSION, exportedAt: "", userId: "u", profile: { homeEquipment: [], warmupDefaults: null }, counts: {} as BackupFile["counts"], data }), csv, "CSV inchangé par l'échauffement");

// ── Tests de niveau Lafay : sauvegardés et restaurés, anciennes sauvegardes toujours lisibles ──
assert.deepEqual(RESTORE_ORDER[RESTORE_ORDER.length - 1], ["lafayTests", "LafayTest"], "restaurés en dernier (aucune dépendance)");
const test = revive("LafayTest", { id: "t1", userId: "u", takenAt: "2026-10-31T08:00:00.000Z", durationS: 900, repsA: 22, repsB: 9, repsC: 6, repsA1: 14, hrSeries: null, warmup: null, appliedAt: null, applied: null, createdAt: "2026-10-31T08:20:00.000Z" });
assert.ok(test.takenAt instanceof Date && test.createdAt instanceof Date);
assert.equal(test.repsB, 9);
assert.equal(test.applied, Prisma.DbNull);
// Sauvegarde d'avant les tests : pas de clé lafayTests ; la restauration lit « b.data[key] ?? [] » (tools/restore-backup.ts).
const oldData = { ...data } as Partial<BackupFile["data"]>;
delete oldData.lafayTests;
assert.deepEqual(oldData.lafayTests ?? [], []);
assert.equal(toCsv({ schemaVersion: SCHEMA_VERSION, exportedAt: "", userId: "u", profile: { homeEquipment: [] }, counts: {} as BackupFile["counts"], data: oldData as BackupFile["data"] }), csv, "CSV : les tests n'y entrent pas, ancien fichier lisible");
console.log("backup : ok");
