/**
 * Analyse de la randonnée pour la page Analyse : volume par mois, rythme en montée, records, phrases « à retenir ».
 * buildHikingAnalysis est pure (tests : tools/test-hiking.ts). L'altitude maximale se calcule en SQL sur Activity.trackPoints (jsonb) :
 * aucune trace n'est chargée en mémoire.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { dayKey, shiftDay, weekKeys } from "../dates";
import { climbCompare } from "../insights/landmarks";

export type HikeRow = { id: string; title: string; startedAt: Date; distanceM: number; movingTimeS: number; elevationGainM: number; avgHr: number | null; maxEleM: number | null };
export type HikePoint = { id: string; day: string; climbRate: number | null; speedKmh: number | null; avgHr: number | null };
export type HikeRecord = { id: string; day: string; title: string; value: number };
export type HikingAnalysis = {
  empty: boolean;
  last: { id: string; title: string; day: string } | null;   // dernière rando connue, même hors période (état vide)
  summary: { hikes: number; km: number; dPlus: number; timeS: number };
  monthly: { month: string; label: string; km: number; dPlus: number; hours: number }[];
  hikes: HikePoint[];                                         // de la plus ancienne à la plus récente
  climbRate: number | null;                                   // m de D+ par heure, sur les randos avec dénivelé
  records: { longest: HikeRecord | null; biggestClimb: HikeRecord | null; maxAltitude: HikeRecord | null };
  insights: string[];
};

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const fr = (n: number, d = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });

export function buildHikingAnalysis(input: { hikes: HikeRow[]; last: { id: string; title: string; startedAt: Date } | null; weeks: number; tz: string; now?: Date }): HikingAnalysis {
  const { hikes, last, weeks, tz, now = new Date() } = input;
  const mon = weekKeys(now, tz)[0], first = shiftDay(mon, -7 * (weeks - 1));
  const sorted = hikes.filter((h) => dayKey(h.startedAt, tz) >= first).sort((a, b) => +a.startedAt - +b.startedAt);
  const km = (h: HikeRow) => h.distanceM / 1000, hours = (h: HikeRow) => h.movingTimeS / 3600;
  const summary = { hikes: sorted.length, km: sorted.reduce((s, h) => s + km(h), 0), dPlus: Math.round(sorted.reduce((s, h) => s + h.elevationGainM, 0)), timeS: sorted.reduce((s, h) => s + h.movingTimeS, 0) };

  // Volume par mois civil, du mois de début de période au mois courant (les mois vides restent à 0)
  const monthly: HikingAnalysis["monthly"] = [];
  const [y0, m0] = first.split("-").map(Number), [y1, m1] = dayKey(now, tz).split("-").map(Number);
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? (y++, (m = 1)) : m++) monthly.push({ month: `${y}-${String(m).padStart(2, "0")}`, label: MONTHS[m - 1], km: 0, dPlus: 0, hours: 0 });
  for (const h of sorted) { const mo = monthly.find((x) => x.month === dayKey(h.startedAt, tz).slice(0, 7)); if (mo) { mo.km += km(h); mo.dPlus += h.elevationGainM; mo.hours += hours(h); } }

  const points: HikePoint[] = sorted.map((h) => ({
    id: h.id, day: dayKey(h.startedAt, tz),
    climbRate: h.elevationGainM >= 50 && h.movingTimeS > 0 ? h.elevationGainM / hours(h) : null,
    speedKmh: h.distanceM >= 1000 && h.movingTimeS > 0 ? km(h) / hours(h) : null,
    avgHr: (h.avgHr ?? 0) > 0 ? h.avgHr : null,
  }));
  const climbers = sorted.filter((h) => h.elevationGainM >= 50 && h.movingTimeS > 0), climbH = climbers.reduce((s, h) => s + hours(h), 0);
  const climbRate = climbH > 0 ? climbers.reduce((s, h) => s + h.elevationGainM, 0) / climbH : null;

  const top = (f: (h: HikeRow) => number | null): HikeRecord | null => {
    let best: HikeRow | null = null, bv = 0;
    for (const h of sorted) { const v = f(h) ?? 0; if (v > bv) { best = h; bv = v; } }
    return best ? { id: best.id, day: dayKey(best.startedAt, tz), title: best.title, value: bv } : null;
  };
  const records = { longest: top(km), biggestClimb: top((h) => h.elevationGainM), maxAltitude: top((h) => h.maxEleM) };

  const insights: string[] = [];
  if (climbRate != null) {
    const rates = points.map((p) => p.climbRate).filter((v): v is number => v != null), half = Math.floor(rates.length / 2);
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const change = rates.length >= 4 ? ((avg(rates.slice(half)) - avg(rates.slice(0, half))) / avg(rates.slice(0, half))) * 100 : null;
    insights.push(`Tu grimpes à ${Math.round(climbRate)} m de D+ par heure en moyenne${change != null && Math.abs(change) >= 5 ? `, ${change > 0 ? "en hausse" : "en baisse"} de ${Math.round(Math.abs(change))} % entre les premières et les dernières randos` : ""}.`);
  }
  const rep = summary.dPlus >= 190 ? climbCompare(summary.dPlus, mon) : null;
  if (rep) insights.push(`${fr(summary.dPlus, 0)} m de dénivelé positif sur la période, soit ${rep.text}.`);
  const best = [...monthly].sort((a, b) => b.km - a.km)[0];
  if (best && best.km > 0 && monthly.filter((m) => m.km > 0).length >= 2) insights.push(`Ton meilleur mois : ${MONTHS_LONG[Number(best.month.slice(5)) - 1]}, avec ${fr(best.km)} km.`);

  return {
    empty: sorted.length === 0, last: last ? { id: last.id, title: last.title, day: dayKey(last.startedAt, tz) } : null,
    summary, monthly, hikes: points, climbRate, records, insights: insights.slice(0, 3),
  };
}

export async function getHikingAnalysis(userId: string, tz: string, weeks: number, now = new Date()): Promise<HikingAnalysis> {
  const first = shiftDay(weekKeys(now, tz)[0], -7 * (weeks - 1));
  const [found, last] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, type: "HIKE", startedAt: { gte: new Date(Date.parse(first) - 864e5), lte: now } },
      select: { id: true, title: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true, avgHr: true },
    }),
    prisma.activity.findFirst({ where: { userId, type: "HIKE", startedAt: { lte: now } }, orderBy: { startedAt: "desc" }, select: { id: true, title: true, startedAt: true } }),
  ]);
  // Altitude max par rando, calculée en base ; si la requête échoue, le record d'altitude disparaît simplement
  const maxEle = new Map<string, number>();
  if (found.length) {
    try {
      const rows = await prisma.$queryRaw<{ id: string; maxEle: number | null }[]>(Prisma.sql`
        SELECT a.id, MAX((p->>'ele')::float8) AS "maxEle"
        FROM "Activity" a, jsonb_array_elements(CASE WHEN jsonb_typeof(a."trackPoints") = 'array' THEN a."trackPoints" ELSE '[]'::jsonb END) p
        WHERE a.id IN (${Prisma.join(found.map((h) => h.id))})
        GROUP BY a.id`);
      for (const r of rows) if (r.maxEle != null && Number.isFinite(r.maxEle)) maxEle.set(r.id, r.maxEle);
    } catch { /* pas d'altitude */ }
  }
  return buildHikingAnalysis({ hikes: found.map((h) => ({ ...h, maxEleM: maxEle.get(h.id) ?? null })), last, weeks, tz, now });
}
