/**
 * Analyse du vélo (home trainer et sorties extérieures) pour la page Analyse, quand le sport choisi est le vélo.
 * Rien n'est recalculé de zéro : meilleurs efforts = ActivityStream.curve (calculée à l'import, lib/power.ts), FTP et zones = lib/zones.ts + lib/data/zones.ts,
 * puissance normalisée = lib/load.ts, vélotaf = isCommute (lib/routes/estimate.ts). Les séries 1 Hz (JSONB) ne sont lues que pour les dernières sorties (STREAM_RIDES).
 * buildCyclingAnalysis est pure (tests : tools/test-cycling.ts).
 */
import { prisma } from "../prisma";
import { dayKey, shiftDay, weekKeys } from "../dates";
import { normalizedPower } from "../load";
import { bestCurve } from "../power";
import { isCommute } from "../routes/estimate";
import { bounds, HR_PCT, POWER_PCT, timeInZones, ZONES } from "../zones";
import { getZones } from "../data/zones";

/** Sorties dont on lit la série seconde par seconde (puissance normalisée, temps par zone) : les plus récentes de la période. */
export const STREAM_RIDES = 40;
/** Meilleurs efforts affichés : index dans DURATIONS (lib/power.ts) → 5 s, 1 min, 5 min, 20 min. */
const BESTS = [{ i: 0, label: "5 s" }, { i: 2, label: "1 min" }, { i: 3, label: "5 min" }, { i: 4, label: "20 min" }] as const;

type Curve = (number | null)[] | null;
export type RideRow = {
  id: string; startedAt: Date; type: string; title: string; source: string; dedupeKey: string | null; polyline: string | null;
  distanceM: number; movingTimeS: number; elevationGainM: number; avgPower: number | null; avgHr: number | null; load: number | null;
  curve: Curve; avgCad: number | null;
};
export type RideStream = { id: string; power: number[]; hr: number[] };
export type CyclingZones = { ftp: number | null; hrMax: number | null; ftpManual: boolean };

export type RidePoint = { id: string; day: string; indoor: boolean; avgPower: number; np: number | null; speedKmh: number | null; avgHr: number | null };
export type ZoneSlice = { id: 1 | 2 | 3 | 4 | 5 | 6; name: string; seconds: number; range: string };
export type CyclingAnalysis = {
  empty: boolean;
  summary: { rides: number; timeS: number; km: number; avgPower: number | null; elevationM: number | null };
  weekly: { weekStart: string; hours: number; km: number; load: number }[];
  hasLoad: boolean;
  rides: RidePoint[];                                        // sorties avec puissance, de la plus ancienne à la plus récente
  efficiency: { values: number[]; changePct: number | null } | null; // W/bpm par sortie
  bests: { label: string; watts: number; prev: number | null }[] | null;
  ftp: { estimated: number | null; used: number | null; manual: boolean };
  zones: { kind: "power" | "hr"; slices: ZoneSlice[]; rides: number; ref: number } | null;
  insights: string[];
  footer: { km: number; commutes: number; commuteKm: number };
};

const round = Math.round;
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const isIndoor = (r: RideRow) => r.source === "mywhoosh" || !r.polyline; // même règle que lib/import/save.ts : pas de trace = home trainer

function sliceRanges(upper: number[], unit: string): string[] {
  return upper.concat(Infinity).map((hi, z) => z === 0 ? `< ${upper[0]} ${unit}` : hi === Infinity ? `> ${upper[z - 1]} ${unit}` : `${upper[z - 1]}–${hi} ${unit}`);
}

export function buildCyclingAnalysis(input: { rides: RideRow[]; prevRides: RideRow[]; commutes: RideRow[]; streams: RideStream[]; zones: CyclingZones; weeks: number; tz: string; now?: Date }): CyclingAnalysis {
  const { rides, prevRides, commutes, streams, zones, weeks, tz, now = new Date() } = input;
  const first = shiftDay(weekKeys(now, tz)[0], -7 * (weeks - 1));
  const sorted = [...rides].sort((a, b) => +a.startedAt - +b.startedAt);
  const km = (r: RideRow) => r.distanceM / 1000;

  // 1. Résumé : puissance moyenne pondérée par la durée, dénivelé seulement s'il vient d'une sortie extérieure
  const powered = sorted.filter((r) => (r.avgPower ?? 0) > 0), pTime = powered.reduce((s, r) => s + r.movingTimeS, 0);
  const climb = sorted.filter((r) => !isIndoor(r)).reduce((s, r) => s + r.elevationGainM, 0);
  const summary = {
    rides: sorted.length, timeS: sorted.reduce((s, r) => s + r.movingTimeS, 0), km: sorted.reduce((s, r) => s + km(r), 0),
    avgPower: pTime ? round(powered.reduce((s, r) => s + r.avgPower! * r.movingTimeS, 0) / pTime) : null,
    elevationM: climb > 0 ? round(climb) : null,
  };

  // 2. Volume par semaine (semaines vides à 0 : axe continu)
  const weekly = Array.from({ length: weeks }, (_, i) => ({ weekStart: shiftDay(first, 7 * i), hours: 0, km: 0, load: 0 }));
  for (const r of sorted) {
    const w = weekly[Math.floor((Date.parse(dayKey(r.startedAt, tz)) - Date.parse(first)) / (7 * 864e5))];
    if (w) { w.hours += r.movingTimeS / 3600; w.km += km(r); w.load += r.load ?? 0; }
  }

  // 3. Puissance, puissance normalisée, vitesse, FC par sortie ; efficacité = W/bpm
  const byId = new Map(streams.map((s) => [s.id, s]));
  const points: RidePoint[] = powered.map((r) => {
    const p = byId.get(r.id)?.power ?? [], np = p.some((v) => v > 0) ? normalizedPower(p) : null;
    return { id: r.id, day: dayKey(r.startedAt, tz), indoor: isIndoor(r), avgPower: r.avgPower!, np: np ? round(np) : null,
      speedKmh: r.distanceM >= 1000 && r.movingTimeS > 0 ? (r.distanceM / 1000) / (r.movingTimeS / 3600) : null, avgHr: (r.avgHr ?? 0) > 0 ? r.avgHr : null };
  });
  const eff = points.filter((p) => p.avgHr && p.avgHr > 60).map((p) => p.avgPower / p.avgHr!);
  const half = Math.floor(eff.length / 2);
  const efficiency = eff.length >= 2 ? { values: eff, changePct: eff.length >= 4 ? ((mean(eff.slice(half)) - mean(eff.slice(0, half))) / mean(eff.slice(0, half))) * 100 : null } : null;

  // 4. Meilleurs efforts de la période contre la précédente, FTP = 95 % du meilleur 20 min
  const cur = bestCurve(sorted.map((r) => r.curve)), prev = bestCurve(prevRides.map((r) => r.curve));
  const bestList = BESTS.filter((b) => cur[b.i]).map((b) => ({ label: b.label, watts: cur[b.i]!, prev: prev[b.i] }));
  const ftpEst = cur[4] ? round(cur[4]! * 0.95) : null, ftpUsed = zones.ftp ?? ftpEst;

  // 5. Temps par zone : puissance si on a la FTP et des séries de puissance, sinon FC
  const pw = streams.filter((s) => s.power.length), hrS = streams.filter((s) => s.hr.length);
  let zonesOut: CyclingAnalysis["zones"] = null;
  const build = (kind: "power" | "hr", upper: number[], secs: number[], n: number, ref: number) => {
    const ranges = sliceRanges(upper, kind === "power" ? "W" : "bpm");
    return { kind, rides: n, ref, slices: ZONES.map((z, i) => ({ id: z.id as ZoneSlice["id"], name: z.name, seconds: secs[i], range: ranges[i] })) };
  };
  if (ftpUsed && pw.length) {
    const ub = bounds(ftpUsed, POWER_PCT), secs = new Array<number>(6).fill(0);
    for (const s of pw) timeInZones(s.power, ub).forEach((v, i) => (secs[i] += v));
    zonesOut = build("power", ub, secs, pw.length, ftpUsed);
  } else if (zones.hrMax && hrS.length) {
    const ub = bounds(zones.hrMax, HR_PCT), secs = new Array<number>(6).fill(0);
    for (const s of hrS) timeInZones(s.hr, ub, true).forEach((v, i) => (secs[i] += v));
    zonesOut = build("hr", ub, secs, hrS.length, zones.hrMax);
  }
  if (zonesOut && zonesOut.slices.every((s) => s.seconds === 0)) zonesOut = null;

  // 6. À retenir
  const insights: string[] = [];
  const gain = bestList.filter((b) => b.prev && b.watts > b.prev).sort((a, b) => b.watts / b.prev! - a.watts / a.prev!)[0];
  if (gain) insights.push(`Record sur ${gain.label} : ${gain.watts} W, soit +${gain.watts - gain.prev!} W par rapport à la période précédente.`);
  else if (bestList.length) { const b = bestList[bestList.length - 1]; insights.push(`Ton meilleur effort sur ${b.label} est de ${b.watts} W${b.label === "20 min" && ftpEst ? `, soit une FTP estimée à ${ftpEst} W` : ""}.`); }
  if (efficiency?.changePct != null) {
    const c = efficiency.changePct;
    insights.push(Math.abs(c) < 2 ? "À fréquence cardiaque égale, ta puissance est stable." : `À fréquence cardiaque égale, ta puissance a ${c > 0 ? "progressé" : "baissé"} de ${Math.abs(round(c))} %.`);
  }
  const cad = sorted.filter((r) => (r.avgCad ?? 0) > 0), cadTime = cad.reduce((s, r) => s + r.movingTimeS, 0);
  if (cadTime) insights.push(`Cadence moyenne : ${round(cad.reduce((s, r) => s + r.avgCad! * r.movingTimeS, 0) / cadTime)} tr/min.`);

  return {
    empty: sorted.length === 0, summary, weekly, hasLoad: weekly.some((w) => w.load > 0),
    rides: points, efficiency, bests: bestList.length ? bestList : null, ftp: { estimated: ftpEst, used: ftpUsed, manual: zones.ftpManual },
    zones: zonesOut, insights: insights.slice(0, 3),
    footer: { km: summary.km, commutes: commutes.length, commuteKm: commutes.reduce((s, r) => s + km(r), 0) },
  };
}

export async function getCyclingAnalysis(userId: string, tz: string, weeks: number, now = new Date()): Promise<CyclingAnalysis> {
  const first = shiftDay(weekKeys(now, tz)[0], -7 * (weeks - 1)), prevFirst = shiftDay(first, -7 * weeks);
  const [found, z] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, type: { in: ["RIDE", "EBIKE"] }, startedAt: { gte: new Date(Date.parse(prevFirst) - 864e5) } },
      select: { id: true, startedAt: true, type: true, title: true, source: true, dedupeKey: true, polyline: true, distanceM: true, movingTimeS: true, elevationGainM: true, avgPower: true, avgHr: true, load: true, stream: { select: { curve: true, avgCad: true } } },
    }),
    getZones(userId),
  ]);
  const all: RideRow[] = found.map((a) => ({ ...a, curve: (a.stream?.curve ?? null) as Curve, avgCad: a.stream?.avgCad ?? null }));
  const inCur = (a: RideRow) => dayKey(a.startedAt, tz) >= first;
  const training = all.filter((a) => a.type === "RIDE" && !isCommute(a)); // vélotaf et activités douces : hors de tous les calculs
  const rides = training.filter(inCur).sort((a, b) => +b.startedAt - +a.startedAt);
  // Séries seconde par seconde : seulement les plus récentes sorties de la période (la période précédente n'a besoin que des courbes en cache)
  const ids = rides.filter((r) => r.curve || (r.avgPower ?? 0) > 0 || (r.avgHr ?? 0) > 0).slice(0, STREAM_RIDES).map((r) => r.id);
  const raw = ids.length ? await prisma.activityStream.findMany({ where: { activityId: { in: ids } }, select: { activityId: true, data: true } }) : [];
  const streams: RideStream[] = raw.map((s) => { const d = s.data as { power?: number[]; hr?: number[] } | null; return { id: s.activityId, power: d?.power ?? [], hr: d?.hr ?? [] }; });
  return buildCyclingAnalysis({
    rides, prevRides: training.filter((a) => !inCur(a)), commutes: all.filter((a) => inCur(a) && isCommute(a)),
    streams, zones: { ftp: z.ftp, hrMax: z.hrMax, ftpManual: z.ftpManual }, weeks, tz, now,
  });
}
