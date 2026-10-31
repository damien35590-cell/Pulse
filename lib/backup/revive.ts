/**
 * Relecture d'une ligne de sauvegarde pour Prisma (utilisée par tools/restore-backup.ts) : dates revenues du JSON, null des champs Json traduits.
 * Pure, sans base (tests : tools/test-backup.ts). Un champ absent du fichier (sauvegarde d'avant son ajout, ex. Activity.warmup) reste absent :
 * à la création la colonne vaut null, à la mise à jour la valeur en base n'est pas touchée.
 */
import { Prisma } from "@prisma/client";

type Row = Record<string, unknown>;

export const modelFields = (model: string) => new Map(Prisma.dmmf.datamodel.models.find((m) => m.name === model)!.fields.filter((f) => f.kind !== "object").map((f) => [f.name, f]));

export function revive(model: string, row: Row): Row {
  const f = modelFields(model), out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    const t = f.get(k)?.type;
    if (!t) continue; // champ inconnu de ce schéma (fichier d'un schéma plus récent)
    out[k] = t === "DateTime" && typeof v === "string" ? new Date(v) : t === "Json" && v === null ? Prisma.DbNull : v;
  }
  return out;
}
