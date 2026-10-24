/**
 * Données fictives réalistes pour le kit UI (page /ui-kit). Aucune requête : tout est généré de façon déterministe,
 * et les chiffres dérivés (zones, FC par km, D+) sont calculés depuis les courbes pour rester cohérents entre eux.
 */
import { HR_PCT, ZONES, bounds } from "@/lib/zones";
import { fmtClock, fmtPaceS } from "@/lib/format";
import type { ZoneSlice } from "@/components/activity/zone-bar";
import type { Split } from "@/components/activity/splits";
import type { Band } from "@/components/activity/trace-chart";
import type { LiftExercise } from "@/components/workout/set-logger";
import type { InsightLine } from "@/lib/activity/comparables";
import type { ActivitySummaryData } from "@/components/dashboard/activity-summary";
import type { RouteView } from "@/lib/data/routes";
import type { RideWeather } from "@/lib/weather/open-meteo";
import { encodePolyline } from "@/lib/polyline";
import { simplifyTrack } from "@/lib/map/track";
import { zoneRibbon } from "@/lib/art/zone-ribbon";
import { setGroups } from "@/lib/art/set-bars";

export const HR_MAX = 191;
const HR_BOUNDS = bounds(HR_MAX, HR_PCT); // [115, 134, 153, 172, 181]

/** Bandes de zones pour la courbe cardio (Z2 à Z5). */
export const hrBands: Band[] = [
  { from: HR_BOUNDS[0], to: HR_BOUNDS[1], className: "bg-z2", label: "Z2" },
  { from: HR_BOUNDS[1], to: HR_BOUNDS[2], className: "bg-z3", label: "Z3" },
  { from: HR_BOUNDS[2], to: HR_BOUNDS[3], className: "bg-z4", label: "Z4" },
  { from: HR_BOUNDS[3], to: HR_BOUNDS[4], className: "bg-z5", label: "Z5" },
];

/** Une course synthétique : allure par km + FC « cible » par km → courbe FC toutes les 5 s. */
function simulateRun(paceS: number[], hrBase: number[], seed: number) {
  const STEP = 5, ends: number[] = [];
  paceS.reduce((t, p) => { ends.push(t + p); return t + p; }, 0);
  const total = ends[ends.length - 1], hr: number[] = [];
  for (let t = 0; t < total; t += STEP) {
    const k = ends.findIndex((e) => t < e), start = k ? ends[k - 1] : 0, f = (t - start) / paceS[k];
    let v = hrBase[k] + (hrBase[Math.min(k + 1, hrBase.length - 1)] - hrBase[k]) * f;
    if (t < 150) v = 112 + (v - 112) * (1 - Math.exp(-t / 45)); // échauffement : la FC monte
    if (t > total - 60) v += ((t - (total - 60)) / 60) * 5; // relance finale
    v += 1.4 * Math.sin(t / 17 + seed) + 0.9 * Math.sin(t / 6.1 + seed * 2) + 0.6 * Math.sin(t / 2.3);
    hr.push(Math.round(v));
  }
  // Dérivés : FC moyenne par km, temps par zone, moyenne et max.
  const splits: Split[] = paceS.map((p, i) => {
    const from = (i ? ends[i - 1] : 0) / STEP, to = ends[i] / STEP, part = hr.slice(Math.floor(from), Math.ceil(to));
    return { km: i + 1, paceS: p, hr: Math.round(part.reduce((s, v) => s + v, 0) / part.length) };
  });
  const sec = new Array(ZONES.length).fill(0);
  for (const v of hr) { let z = 0; while (z < HR_BOUNDS.length && v > HR_BOUNDS[z]) z++; sec[z] += STEP; }
  const zones: ZoneSlice[] = ZONES.slice(0, 5).map((z, i) => ({
    id: z.id, name: z.name, seconds: sec[i] + (i === 4 ? sec[5] : 0),
    range: i === 0 ? `< ${HR_BOUNDS[0]}` : i === 4 ? `> ${HR_BOUNDS[3]}` : `${HR_BOUNDS[i - 1]}–${HR_BOUNDS[i]}`,
  }));
  return { hr, splits, zones, totalS: total, avgHr: Math.round(hr.reduce((s, v) => s + v, 0) / hr.length), maxHr: Math.max(...hr) };
}

/** Profil d'altitude tous les 50 m + D+ calculé. */
function simulateElevation(km: number, seed: number) {
  const n = Math.round(km * 20), ele: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = i / 20;
    ele.push(42 + 7 * Math.sin(x * 1.3 + seed) + 4 * Math.sin(x * 3.1 + seed * 2) + 1.5 * Math.sin(x * 9.7));
  }
  const gain = ele.reduce((s, v, i) => (i && v > ele[i - 1] ? s + v - ele[i - 1] : s), 0);
  return { ele, gain: Math.round(gain) };
}

type RunSpec = {
  id: string; title: string; when: string; paceS: number[]; hrBase: number[]; seed: number;
  /** Bout de parcours après le dernier km plein : distance (km) et temps (s). */
  tail: [number, number]; cadence: number; kcal: number; rpe: number; insight?: string; badge?: string;
  /** Phrase de comparaison du fil (lib/activity/comparables.ts : insightLine). */
  compare?: InsightLine;
};

function buildRun(r: RunSpec) {
  const sim = simulateRun(r.paceS, r.hrBase, r.seed), distanceKm = r.paceS.length + r.tail[0], movingS = sim.totalS + r.tail[1];
  const elev = simulateElevation(distanceKm, r.seed * 0.4);
  return {
    id: r.id, title: r.title, when: r.when, badge: r.badge, insight: r.insight, compare: r.compare,
    distanceKm, movingS, pace: fmtPaceS(movingS / distanceKm),
    avgHr: sim.avgHr, maxHr: sim.maxHr, gain: elev.gain, cadence: r.cadence, kcal: r.kcal, rpe: r.rpe,
    hr: sim.hr, ele: elev.ele, splits: sim.splits, zones: sim.zones,
  };
}

const TEMPO_PACE = [302, 289, 286, 283, 281, 284, 282, 280, 277, 268];

/** Courses complètes (détail) : tempo du vendredi, footing du mardi. */
export const runs = [
  buildRun({
    id: "tempo-10k", title: "Tempo 10 km", when: "ven. 16 oct. · 18:42", seed: 1, tail: [0.02, 6],
    paceS: TEMPO_PACE, hrBase: [141, 152, 157, 160, 162, 164, 166, 168, 171, 177],
    cadence: 176, kcal: 712, rpe: 7, badge: "Record",
    compare: { text: "9 s/km plus rapide que tes séances de seuil / VMA similaires", tone: "good" },
    insight: `Dernier kilomètre en ${fmtPaceS(TEMPO_PACE[9])} : ton finish le plus rapide depuis mars, sans exploser (Z5 seulement à la fin).`,
  }),
  buildRun({
    id: "footing", title: "Footing endurance", when: "mar. 13 oct. · 07:15", seed: 3, tail: [0.21, 64],
    paceS: [318, 312, 310, 309, 311, 310, 308, 306], hrBase: [122, 127, 129, 130, 131, 132, 132, 134],
    cadence: 168, kcal: 548, rpe: 3,
    compare: { text: "Dans ta moyenne habituelle", tone: "neutral" },
  }),
];
export const tempo = runs[0];

/** Séance de muscu passée (détail) : Pull A du jeudi. */
const PULL_A: { name: string; bodyweight?: boolean; delta?: string; sets: { kg: number; reps: number }[] }[] = [
  { name: "Tractions pronation", bodyweight: true, delta: "+1 rep", sets: [{ kg: 0, reps: 8 }, { kg: 0, reps: 7 }, { kg: 0, reps: 7 }, { kg: 0, reps: 6 }] },
  { name: "Rowing barre", delta: "+2,5 kg", sets: [{ kg: 52.5, reps: 8 }, { kg: 52.5, reps: 8 }, { kg: 52.5, reps: 8 }, { kg: 52.5, reps: 7 }] },
  { name: "Rowing haltère unilatéral", sets: [{ kg: 24, reps: 10 }, { kg: 24, reps: 10 }, { kg: 24, reps: 10 }, { kg: 24, reps: 9 }] },
  { name: "Curl haltères incliné", sets: [{ kg: 12, reps: 10 }, { kg: 12, reps: 10 }, { kg: 12, reps: 9 }] },
  { name: "Oiseau haltères", sets: [{ kg: 8, reps: 12 }, { kg: 8, reps: 12 }, { kg: 8, reps: 12 }] },
  { name: "Relevés de jambes (chaise romaine)", bodyweight: true, sets: [{ kg: 0, reps: 12 }, { kg: 0, reps: 12 }, { kg: 0, reps: 10 }, { kg: 0, reps: 10 }] },
];
// Volume = charge × reps ; haltère unilatéral et curl comptés pour les deux bras.
const unit2 = new Set(["Rowing haltère unilatéral", "Curl haltères incliné", "Oiseau haltères"]);
export const liftSession = {
  id: "pull-a", title: "Pull A", when: "jeu. 15 oct. · 19:05", durationMin: 48,
  exercises: PULL_A,
  sets: PULL_A.reduce((n, e) => n + e.sets.length, 0),
  volumeKg: PULL_A.reduce((v, e) => v + e.sets.reduce((w, x) => w + x.kg * x.reps * (unit2.has(e.name) ? 2 : 1), 0), 0),
};

/**
 * Traces GPS fictives (Rennes) : une boucle pour le tempo, un aller simple le long du canal pour le footing.
 * 400 points chacune, avec un léger zigzag de GPS ; simplifiées à ~200 points comme dans le vrai fil.
 */
const loopTrack: [number, number][] = Array.from({ length: 400 }, (_, i) => {
  const a = (i / 399) * 2 * Math.PI, r = 0.0135 * (1 + 0.22 * Math.sin(3 * a) + 0.08 * Math.sin(7 * a + 1));
  return [48.1147 + r * Math.sin(a) + 0.00008 * Math.sin(i * 1.7), -1.6794 + 1.5 * r * (1 - Math.cos(a)) + 0.00008 * Math.cos(i * 2.3)];
});
const lineTrack: [number, number][] = Array.from({ length: 400 }, (_, i) => {
  const t = i / 399;
  return [48.1012 + 0.034 * t + 0.0045 * Math.sin(9 * t), -1.7231 + 0.058 * t + 0.006 * Math.sin(13 * t + 1)];
});
export const tracks: Record<string, [number, number][]> = { "tempo-10k": simplifyTrack(loopTrack), footing: simplifyTrack(lineTrack) };
/** Profil d'altitude d'une course (un point tous les 50 m), pour ElevationChart. */
export const profileOf = (r: (typeof runs)[number]) => r.ele.map((ele, i) => ({ km: Math.min(r.distanceKm, i / 20), ele }));

const km2 = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const runPreview = (r: (typeof runs)[number]): ActivitySummaryData => ({
  id: r.id, type: "RUN", title: r.title, when: r.when, badge: r.badge, zones: r.zones, insight: r.compare, route: tracks[r.id],
  metrics: [
    { label: "Distance", value: km2(r.distanceKm), unit: "km" },
    { label: "Temps", value: fmtClock(r.movingS) },
    { label: "Allure", value: r.pace, unit: "/km" },
  ],
});

// ─── Art : ruban de zones, profil d'effort, séries (components/art), tous dérivés de séries fictives ───
/** 10 × 400 m : échauffement, 10 × (90 s vite, 75 s trot), retour au calme ; la FC suit la consigne avec du retard, comme un vrai capteur. */
function intervalHr() {
  const plan: [number, number][] = [[600, 125]];
  for (let i = 0; i < 10; i++) plan.push([90, 178], [75, 132]);
  plan.push([480, 118]);
  const hr: number[] = [];
  let cur = 110;
  for (const [sec, target] of plan) for (let k = 0; k < sec; k++) { cur += (target - cur) * 0.12; hr.push(Math.round(cur)); }
  return hr;
}
export const artDemo = {
  /** Le tempo de 10 km, sa FC → ruban sous la carte. */
  ribbon: zoneRibbon({ hr: runs[0].hr }, { hrMax: HR_MAX })!.segments,
  /** Fractionné : profil d'effort à la place de la carte, étiquette de la séance prévue. */
  effort: { segments: zoneRibbon({ hr: intervalHr() }, { hrMax: HR_MAX })!.segments, label: "10×400" },
  /** Séance Lafay : B2 (6 séries, cible 10 non atteinte partout), A3, E4 au chrono (secondes), G. */
  sets: setGroups([
    { name: "B2 - dips", sets: 6, reps: 10, setsDetail: [10, 10, 9, 9, 8, 8].map((reps) => ({ reps, done: true })) },
    { name: "A3 - pompes", sets: 5, reps: 12, setsDetail: [12, 12, 12, 11, 10].map((reps) => ({ reps, done: true })) },
    { name: "E4 - flexions latérales", sets: 4, reps: 45, setsDetail: [45, 45, 40, 35].map((reps) => ({ reps, done: true })) },
    { name: "G - crunch", sets: 4, reps: 20, setsDetail: [20, 20, 18, 15].map((reps) => ({ reps, done: true })) },
  ]),
};

export const recent: ActivitySummaryData[] = [
  { ...runPreview(runs[0]), ribbon: artDemo.ribbon },
  {
    id: liftSession.id, type: "WORKOUT", title: `${liftSession.title} · prise de masse`, when: liftSession.when,
    metrics: [
      { label: "Durée", value: String(liftSession.durationMin), unit: "min" },
      { label: "Séries", value: String(liftSession.sets) },
      { label: "Volume", value: (liftSession.volumeKg / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }), unit: "t" },
    ],
    tags: ["Dos", "Biceps", "Arrière d'épaule"],
    insight: { text: "2ᵉ séance de la semaine", tone: "neutral" },
    sets: artDemo.sets,
  },
  runPreview(runs[1]),
  {
    id: "vma-10x400", type: "RUN", title: "VMA courte · 10 × 400 m", when: "mar. 13 oct. · 18:30",
    metrics: [{ label: "Distance", value: "8,40", unit: "km" }, { label: "Temps", value: "45:30" }, { label: "Allure", value: "5:25", unit: "/km" }],
    insight: { text: "Dans ta moyenne habituelle", tone: "neutral" },
    effort: artDemo.effort,
  },
];

// ─── Tableau de bord ───
export const today = {
  program: "Prise de masse · semaine 3",
  title: "Push B",
  exercises: ["Développé couché", "Dips", "Développé militaire", "Élévations latérales", "Pompes déclinées"],
  sets: 17,
  estMin: 55,
};

export const week = {
  range: "12 – 18 oct.",
  run: { done: 2, target: 3 },
  lift: { done: 2, target: 3 }, // Push A (lundi) + Pull A (jeudi)
  km: runs[0].distanceKm + runs[1].distanceKm,
  goalKm: 25,
  // Minutes par jour (course / muscu) ; planned = séance prévue au programme.
  days: [
    { label: "L", run: 0, lift: 52, planned: true },
    { label: "M", run: Math.round(runs[1].movingS / 60), lift: 0, planned: true },
    { label: "M", run: 0, lift: 0, planned: false },
    { label: "J", run: 0, lift: 48, planned: true },
    { label: "V", run: Math.round(runs[0].movingS / 60), lift: 0, planned: true },
    { label: "S", run: 0, lift: 0, planned: true },
    { label: "D", run: 0, lift: 0, planned: true, today: true },
  ],
};

export const fitness = { ctl: 38, ctlDelta: 4, atl: 50, tsb: -12, trend: [30, 31, 31, 32, 32, 33, 34, 34, 35, 35, 36, 37, 37, 38] };

export const goal = { title: "10 km", target: "44:59", predicted: "46:20", progress: 0.62, weeksLeft: 6 };

export const nextRace = { name: "Marathon de Paris", days: 154, distance: "42,2 km" };

// ─── Séance de musculation en cours ───
export const workout: { title: string; program: string; startedMinAgo: number; exercises: LiftExercise[] } = {
  title: "Push B",
  program: "Prise de masse · S3",
  startedMinAgo: 14,
  exercises: [
    {
      name: "Développé couché haltères", sets: 4, reps: 8, kg: 24, step: 2, restS: 120,
      prev: [{ reps: 8, kg: 22 }, { reps: 8, kg: 22 }, { reps: 8, kg: 22 }, { reps: 7, kg: 22 }],
      done: [{ reps: 8, kg: 24 }, { reps: 8, kg: 24 }],
    },
    {
      name: "Dips à la chaise romaine", sets: 4, reps: 10, kg: 0, step: 2.5, restS: 90, bodyweight: true,
      prev: [{ reps: 10, kg: 0 }, { reps: 10, kg: 0 }, { reps: 9, kg: 0 }, { reps: 8, kg: 0 }], done: [],
    },
    {
      name: "Développé militaire haltères", sets: 3, reps: 10, kg: 14, step: 2, restS: 90,
      prev: [{ reps: 10, kg: 14 }, { reps: 9, kg: 14 }, { reps: 8, kg: 14 }], done: [],
    },
    {
      name: "Élévations latérales", sets: 3, reps: 12, kg: 8, step: 1, restS: 60,
      prev: [{ reps: 12, kg: 8 }, { reps: 12, kg: 8 }, { reps: 11, kg: 8 }], done: [],
    },
    {
      name: "Pompes déclinées", sets: 3, reps: 15, kg: 0, step: 2.5, restS: 60, bodyweight: true,
      prev: [{ reps: 15, kg: 0 }, { reps: 14, kg: 0 }, { reps: 12, kg: 0 }], done: [],
    },
  ],
};

/** Boucle proposée (Itinéraires) : un tour d'environ 9 km tracé en ellipse déformée. */
const loopPts: [number, number][] = Array.from({ length: 48 }, (_, i) => {
  const a = (i / 47) * 2 * Math.PI, wob = 1 + 0.18 * Math.sin(3 * a);
  return [48.1535 + 0.012 * wob * Math.sin(a), -1.8265 + 0.02 * wob * (1 - Math.cos(a))];
});
export const routeSuggestion: RouteView = {
  id: "demo-route", sport: "RUN", variant: null, label: "La nature", minutes: 60, estMinutes: 58, distanceM: 9400, ascentM: 86,
  why: "64 % en forêt ou au bord de l'eau · 2 calvaires · 1 point de vue", polyline: encodePolyline(loopPts),
  elevation: loopPts.map((_, i) => Math.round(60 + 25 * Math.sin((i / 47) * Math.PI * 2))), pois: [], saved: false, createdAt: "2026-10-18T08:00:00.000Z",
  weather: {
    startAt: Date.parse("2026-10-18T15:30:00Z"), reversed: true,
    line: "Vent de face à l'aller, retour poussé · averses possibles (40 %) · nuit avant le retour",
    alerts: [{ tone: "warn", text: "Nuit avant le retour (coucher 18:52) · Pars avant 17:37 pour rentrer de jour · 38 % éclairé" }, { tone: "warn", text: "42 % non revêtu : chemins sans doute boueux (14 mm en 48 h)" }],
    outfit: "Manches longues fines, gants fins dans la poche · veste de pluie légère dans la poche · frontale et gilet réfléchissant",
  },
};

/** Météo du bandeau d'Itinéraires (fenêtre de la sortie). */
export const rideWeather: RideWeather = {
  startAt: Date.parse("2026-10-18T15:30:00Z"), endAt: Date.parse("2026-10-18T16:28:00Z"),
  feelsMin: 9.2, feelsMax: 11.4, tempMin: 11.8, rainProbMax: 40, rainMm: 0.4, windKmh: 21, windFromDeg: 250, gustMax: 44,
  uvMax: 1.2, cloudMean: 55, isDay: true, sunrise: Date.parse("2026-10-18T06:24:00Z"), sunset: Date.parse("2026-10-18T16:52:00Z"),
  rain48hMm: 14, coolest: null,
};
