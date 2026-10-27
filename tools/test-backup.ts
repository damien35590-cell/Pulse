// Test du CSV de sauvegarde (pur, sans base) : npm test
import assert from "node:assert/strict";
import { toCsv, RESTORE_ORDER, SCHEMA_VERSION, type BackupFile } from "../lib/backup/strength-export";

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
console.log("backup : ok");
