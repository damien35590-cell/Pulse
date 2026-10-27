/**
 * Restaure une sauvegarde de muscu (pulse-muscu-AAAA-MM-JJ.json, voir lib/backup) : upsert par identifiant, dans l'ordre des dépendances.
 * Par défaut c'est un essai à blanc (dry-run) : rien n'est écrit. Ajoute --apply pour écrire.
 *
 *   node --env-file=.env.local --import tsx tools/restore-backup.ts chemin/vers/pulse-muscu-2026-10-27.json
 *   node --env-file=.env.local --import tsx tools/restore-backup.ts chemin/vers/sauvegarde.json --apply
 *   ... --user <id>   restaure pour un autre utilisateur que celui du fichier (base neuve : l'utilisateur doit exister)
 *
 * Base : celle de .env.local, donc la branche Neon de dev. Pour la prod, voir CLAUDE.md (vercel env pull, --dry-run d'abord, supprimer le fichier ensuite).
 * Ne supprime jamais rien : les lignes absentes du fichier restent telles quelles ; celles du fichier écrasent les lignes de même identifiant.
 */
import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { RESTORE_ORDER, SCHEMA_VERSION, type BackupFile } from "../lib/backup/strength-export";

type Row = Record<string, unknown>;
type Delegate = { findMany(a: unknown): Promise<{ id: string }[]>; upsert(a: unknown): Promise<unknown>; update(a: unknown): Promise<unknown> };

/** Clés étrangères facultatives : si la cible n'existe pas dans la base, le lien est mis à null plutôt que de faire échouer la restauration. */
const OPTIONAL_REFS: Record<string, [field: string, model: string][]> = {
  TrainingGoal: [["raceEventId", "RaceEvent"]],
  PlannedSession: [["raceEventId", "RaceEvent"], ["completedActivityId", "Activity"]],
  AthleteMetric: [["activityId", "Activity"]],
  Activity: [["templateId", "WorkoutTemplate"]],
  WorkoutExercise: [["slotId", "ProgramExerciseSlot"], ["exerciseId", "Exercise"]],
  Program: [["goalId", "TrainingGoal"]],
};

const fields = (model: string) => new Map(Prisma.dmmf.datamodel.models.find((m) => m.name === model)!.fields.filter((f) => f.kind !== "object").map((f) => [f.name, f]));
const delegate = (model: string) => (prisma as unknown as Record<string, Delegate>)[model[0].toLowerCase() + model.slice(1)];

/** Dates relues depuis le JSON, null des champs Json traduits pour Prisma. */
function revive(model: string, row: Row): Row {
  const f = fields(model), out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    const t = f.get(k)?.type;
    if (!t) continue; // champ inconnu de ce schéma (fichier d'un schéma plus récent)
    out[k] = t === "DateTime" && typeof v === "string" ? new Date(v) : t === "Json" && v === null ? Prisma.DbNull : v;
  }
  return out;
}

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file || file.startsWith("--")) { console.error("Usage : restore-backup.ts <fichier.json> [--apply] [--user <id>]"); process.exit(1); }
  const apply = flags.includes("--apply");
  const asUser = flags.includes("--user") ? flags[flags.indexOf("--user") + 1] : undefined;

  const b = JSON.parse(readFileSync(file, "utf8")) as BackupFile;
  if (b.schemaVersion !== SCHEMA_VERSION) throw new Error(`Version de sauvegarde ${b.schemaVersion} non prise en charge (attendue : ${SCHEMA_VERSION}).`);
  const uid = asUser ?? b.userId;
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true, email: true } });
  if (!user) throw new Error(`Utilisateur ${uid} introuvable dans cette base : crée-le (connexion) ou passe --user <id>.`);
  const dbHost = (() => { try { return new URL(process.env.DIRECT_URL ?? "").host; } catch { return "?"; } })();
  console.log(`${apply ? "RESTAURATION" : "DRY-RUN (rien n'est écrit, ajoute --apply)"} · fichier du ${b.exportedAt} · utilisateur ${user.email ?? user.id} · base ${dbHost}`);

  const missing = new Map<string, Set<string>>(); // modèle → ids absents de la base
  const exists = async (model: string, ids: string[]) => {
    const have = new Set((await delegate(model).findMany({ where: { id: { in: ids } }, select: { id: true } })).map((r) => r.id));
    return have;
  };

  const restored = new Set<string>(); // ids déjà écrits ou présents dans le fichier, par "Modèle:id"
  for (const [key, model] of RESTORE_ORDER) for (const r of b.data[key] ?? []) restored.add(`${model}:${r.id}`);

  for (const [key, model] of RESTORE_ORDER) {
    const rowsIn = b.data[key] ?? [];
    const ids = rowsIn.map((r) => String(r.id));
    const have = await exists(model, ids);
    let created = 0, updated = 0, unlinked = 0;
    const deferred: { id: string; data: Row }[] = []; // Exercise.harderVariantId pointe vers une autre ligne de la même table

    for (const raw of rowsIn) {
      const row = revive(model, raw);
      if ("userId" in row && model !== "Exercise") row.userId = uid;
      for (const [field, target] of OPTIONAL_REFS[model] ?? []) {
        const v = row[field];
        if (typeof v !== "string") continue;
        if (restored.has(`${target}:${v}`)) continue;
        const set = missing.get(target) ?? (missing.set(target, new Set()), missing.get(target)!);
        if (!set.has(v) && !(await exists(target, [v])).has(v)) set.add(v);
        if (set.has(v)) { row[field] = null; unlinked++; }
      }
      if (model === "Exercise" && row.harderVariantId) { deferred.push({ id: String(row.id), data: { harderVariantId: row.harderVariantId } }); row.harderVariantId = null; }
      have.has(String(row.id)) ? updated++ : created++;
      if (apply) await delegate(model).upsert({ where: { id: row.id }, create: row, update: row });
    }
    if (apply) for (const d of deferred) await delegate(model).update({ where: { id: d.id }, data: d.data });
    console.log(`${model.padEnd(24)} ${String(rowsIn.length).padStart(5)} ligne(s) : ${created} à créer, ${updated} à mettre à jour${unlinked ? `, ${unlinked} lien(s) vers des lignes absentes mis à null` : ""}`);
  }

  if (apply && b.profile?.homeEquipment) await prisma.user.update({ where: { id: uid }, data: { homeEquipment: b.profile.homeEquipment } });
  console.log(apply ? "Terminé." : "Dry-run terminé : relance avec --apply pour écrire.");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
