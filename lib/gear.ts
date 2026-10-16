import { Bike, CircleDot, Cog, Footprints, Gauge, Link2, Wrench, Zap, type LucideIcon } from "lucide-react";

/** Types de matériel. `part` : composant d'usure monté sur un vélo ou un home trainer ; `limitKm` : seuil critique proposé par défaut. */
export const GEAR_KINDS = {
  BIKE: { label: "Vélo", icon: Bike, part: false, limitKm: null, sports: ["RIDE"] },
  EBIKE: { label: "E-bike", icon: Zap, part: false, limitKm: null, sports: ["EBIKE"] },
  TRAINER: { label: "Home trainer", icon: Gauge, part: false, limitKm: null, sports: ["RIDE"] },
  SHOES: { label: "Chaussures", icon: Footprints, part: false, limitKm: 600, sports: ["RUN", "HIKE"] },
  CHAIN: { label: "Chaîne", icon: Link2, part: true, limitKm: 5000, sports: [] },
  CASSETTE: { label: "Cassette", icon: Cog, part: true, limitKm: 10000, sports: [] },
  TIRE: { label: "Pneu", icon: CircleDot, part: true, limitKm: 4000, sports: [] },
  OTHER: { label: "Autre", icon: Wrench, part: false, limitKm: null, sports: [] },
} satisfies Record<string, { label: string; icon: LucideIcon; part: boolean; limitKm: number | null; sports: string[] }>;
export type GearKindKey = keyof typeof GEAR_KINDS;

/** Sports auxquels on peut affecter du matériel (pas la musculation). */
export const GEAR_SPORTS = ["RIDE", "EBIKE", "RUN", "HIKE", "WALK"] as const;

/** Au-delà de 85 % du seuil : à surveiller ; à 100 % : à remplacer. */
export const WARN_AT = 0.85;
export type WearLevel = "ok" | "warn" | "critical";
export const wearLevel = (km: number, limitKm: number | null): WearLevel =>
  !limitKm ? "ok" : km >= limitKm ? "critical" : km >= limitKm * WARN_AT ? "warn" : "ok";

type GearLike = { id: string; kind: string; sports: string[]; isDefault: boolean; parentId: string | null; retiredAt: Date | string | null };

/** Matériel proposé dans la liste déroulante d'une sortie : actif, hors composants, compatible avec le sport. */
export const selectableGear = <T extends GearLike>(gear: T[], type: string) =>
  gear.filter((g) => !g.retiredAt && !g.parentId && g.sports.includes(type));

/** Matériel affecté d'office : en intérieur on privilégie le home trainer, dehors jamais le home trainer. */
export function defaultGear<T extends GearLike>(gear: T[], type: string, indoor = false): T | undefined {
  const ok = selectableGear(gear, type).filter((g) => g.isDefault);
  return indoor ? ok.find((g) => g.kind === "TRAINER") ?? ok.find((g) => g.kind !== "TRAINER") : ok.find((g) => g.kind !== "TRAINER");
}
