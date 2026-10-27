/**
 * Ruban d'une séance PRÉVUE (vignette de la page Programme) : les étapes résolues, classées par zone d'allure
 * (mêmes bornes en % de la VMA que le ruban d'allure : Z1 < 60, Z2 60–75, Z3 75–85, Z4 85–92, Z5 92–100, Z6 > 100),
 * les étapes voisines de même zone fusionnées. Fonction pure (tests : tools/test-plan-ribbon.ts).
 */
import type { ResolvedRunStep } from "@/types/training";
import { PACE_PCT } from "./pace";
import type { RibbonSegment, RibbonZone } from "./zone-ribbon";

/** Étape « jusqu'au bouton tour » : durée de repli pour lui donner un poids. */
const LAP_S = 300;

const zoneOfPct = (pct: number): RibbonZone => (PACE_PCT.findIndex((u) => pct < u) + 1 || 6) as RibbonZone;

/** Allure médiane (s/km) d'une étape, sinon null. */
const midPace = (s: ResolvedRunStep) => (s.paceSPerKm ? (s.paceSPerKm.min + s.paceSPerKm.max) / 2 : null);

export function planRibbon(steps: ResolvedRunStep[], vmaKmh: number): RibbonSegment[] {
  const raw = steps.map((s) => {
    const pace = midPace(s);
    const z: RibbonZone = pace && vmaKmh > 0 ? zoneOfPct((3600 / pace / vmaKmh) * 100) : s.role === "recovery" || s.role === "rest" ? 1 : 2;
    const sec = s.duration.type === "time" ? s.duration.s : s.duration.type === "distance" ? (s.duration.m / 1000) * (pace ?? 3600 / (vmaKmh * 0.7)) : LAP_S;
    return { z, sec };
  }).filter((x) => x.sec > 0);
  const total = raw.reduce((t, x) => t + x.sec, 0);
  if (!total) return [];
  const out: RibbonSegment[] = [];
  for (const x of raw) {
    const last = out[out.length - 1];
    if (last && last.z === x.z) last.f += x.sec / total;
    else out.push({ z: x.z, f: x.sec / total });
  }
  return out;
}
