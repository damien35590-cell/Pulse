import { fmtKm, fmtDuration, fmtNum, fmtPace, fmtWhen } from "@/lib/format";
import { previewTrack } from "@/lib/map/track";
import { isSoftActivity } from "@/lib/sports";
import { insightLine, type InsightLine } from "@/lib/activity/comparables";
import { parseRibbon } from "@/lib/art/zone-ribbon";
import { ZONES } from "@/lib/zones";
import type { ZoneSlice } from "@/components/activity/zone-bar";
import { cardArt } from "@/lib/art/card";
import type { SetExercise } from "@/lib/art/set-bars";
import type { ActivityInsight } from "@/lib/data/activity-insight";
import type { ActivitySummaryData } from "@/components/dashboard/activity-summary";

export type SummaryActivity = {
  id: string; type: string; title: string; story: string | null; startedAt: Date; distanceM: number; movingTimeS: number; elevationGainM: number; polyline: string | null;
  avgHr?: number | null; avgPower?: number | null; exercises?: ({ sets: number; reps: number; loadKg: number | null } & Partial<SetExercise>)[];
  /** Art (lib/art/card.ts) : tous facultatifs, sans eux la carte reste celle d'avant. */
  source?: string | null; zoneRibbon?: unknown; zoneRibbonSource?: string | null; isInterval?: boolean | null; sessionType?: string | null; plannedSession?: { kind: string; title: string } | null;
};
export type Cell = { l: string; v: string; u?: string };

/** Exactement 3 chiffres par carte (règle 2 du design system), les plus utiles selon le sport. */
export function cells(a: SummaryActivity): Cell[] {
  const pace = fmtPace(a.distanceM, a.movingTimeS, a.type);
  const dist: Cell = { l: "Distance", v: fmtKm(a.distanceM), u: "km" }, dur: Cell = { l: "Durée", v: fmtDuration(a.movingTimeS) };
  const dplus = a.elevationGainM > 0 ? { l: "D+", v: fmtNum(a.elevationGainM, 0), u: "m" } : null;
  const hr = a.avgHr ? { l: "FC moy.", v: String(Math.round(a.avgHr)), u: "bpm" } : null;
  const pw = a.avgPower ? { l: "Puissance", v: String(Math.round(a.avgPower)), u: "W" } : null;
  const sp = pace ? { l: pace.label, v: pace.value, u: pace.unit } : null;
  let list: (Cell | null)[];
  if (a.type === "WORKOUT") {
    const ex = a.exercises ?? [], sets = ex.reduce((s, e) => s + e.sets, 0), vol = ex.reduce((s, e) => s + e.sets * e.reps * (e.loadKg ?? 0), 0);
    list = [dur, ex.length ? { l: "Exercices", v: String(ex.length) } : null, sets ? { l: "Séries", v: String(sets) } : null, vol > 0 ? { l: "Volume", v: vol >= 1000 ? fmtNum(vol / 1000, 1) : String(Math.round(vol)), u: vol >= 1000 ? "t" : "kg" } : null, hr];
  } else if (a.type === "RIDE") list = [dist, dplus ?? dur, sp, dur, pw, hr];
  else if (a.type === "HIKE") list = [dist, dplus, dur, hr];
  else if (a.type === "RUN") list = [dist, dur, sp, dplus, hr];
  else list = [dist, dur, dplus, hr];
  return list.filter((c): c is Cell => c !== null).slice(0, 3);
}

/** Une carte d'endurance a toujours sa phrase : à défaut de comparaison, la place de la sortie dans la semaine (vraie même pour la 1re). */
function fallbackLine(type: string, rank?: number): InsightLine | undefined {
  return (type === "RUN" || type === "RIDE" || type === "HIKE") && rank ? { text: rank === 1 ? "1ʳᵉ sortie de la semaine" : `${rank}ᵉ sortie de la semaine`, tone: "neutral" } : undefined;
}

/** Sans trace GPS, une sortie avec FC garde un visuel : temps par zone tiré du ruban (fractions du temps) quand il vient de la FC. */
function ribbonZones(a: SummaryActivity): ZoneSlice[] | undefined {
  if (!["RUN", "RIDE", "HIKE"].includes(a.type) || a.zoneRibbonSource !== "hr") return undefined;
  const ribbon = parseRibbon(a.zoneRibbon);
  if (!ribbon) return undefined;
  const seconds = new Map<number, number>();
  for (const s of ribbon) seconds.set(s.z, (seconds.get(s.z) ?? 0) + s.f * a.movingTimeS);
  return ZONES.map((z) => ({ id: z.id, name: z.name, seconds: seconds.get(z.id) ?? 0 }));
}

/**
 * Données d'une carte du fil (accueil, liste) : 3 chiffres, la phrase de comparaison de la fiche (lib/activity/comparables.ts),
 * vignette du tracé simplifiée ici, côté serveur (~200 points). Activités douces : pas de tracé.
 */
export function summaryData(a: SummaryActivity, insight: ActivityInsight | undefined, tz: string, extra?: Partial<ActivitySummaryData>): ActivitySummaryData {
  const route = isSoftActivity(a) ? undefined : previewTrack(a.polyline);
  // Art : ruban, profil d'effort ou séries de muscu selon les données (jamais pour une activité douce).
  const art = isSoftActivity(a) ? {} : cardArt({
    type: a.type, source: a.source, hasRoute: !!route && route.length > 1, zoneRibbon: a.zoneRibbon, zoneRibbonSource: a.zoneRibbonSource, isInterval: a.isInterval, sessionType: a.sessionType, plannedSession: a.plannedSession,
    exercises: a.exercises?.flatMap((e) => (e.name ? [{ name: e.name, sets: e.sets, reps: e.reps, setsDetail: e.setsDetail }] : [])),
  });
  return {
    id: a.id, type: a.type, title: a.title, competition: a.sessionType === "race" || undefined, when: fmtWhen(a.startedAt, tz),
    metrics: cells(a).map((c) => ({ label: c.l, value: c.v, unit: c.u })),
    insight: a.type === "WORKOUT" ? insight?.strength : insightLine(insight ?? { pace: null, chips: [] }, a.story) ?? fallbackLine(a.type, insight?.weekRank),
    zones: !route && !art.ribbon && !art.effort ? ribbonZones(a) : undefined,
    route, ...art,
    ...extra,
  };
}
