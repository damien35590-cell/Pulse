/**
 * Coach du jour : une seule recommandation pour aujourd'hui, à partir de la forme, du programme course,
 * de l'alternance Lafay (haut / bas du corps), de la météo et de tes classiques. Fonctions pures (tests : tools/test-coach.ts).
 */
import type { RideWeather } from "@/lib/weather/open-meteo";

export type Half = "upper" | "lower";
export type CoachSlot = { at: number; feels: number; rainPct: number; windKmh: number; night: boolean };
export type CoachInput = {
  now: number;
  tz: string;
  /** Forme du jour (TSB), et son libellé (lib/fitness.ts). */
  form: { value: number; label: string };
  /** Séances d'entraînement déjà faites aujourd'hui (activités douces exclues). */
  todayDone: { type: string; title: string }[];
  lastRunAt: number | null;
  lastLiftAt: number | null;
  /** Moitié travaillée à la dernière séance de muscu (déduite des muscles). */
  lastLiftHalf: Half | null;
  /** Prochaine séance du programme course (date au format AAAA-MM-JJ, heure de Paris). */
  runNext: { title: string; summary: string; minutes: number; date: string; isKey: boolean } | null;
  /** Meilleur créneau météo pour la séance course, si le domicile est connu. */
  slot: CoachSlot | null;
  /** Un de tes classiques qui tient dans le temps de la séance. */
  classic: { title: string; minutes: number } | null;
};

export type CoachAction = { label: string; href: string };
export type CoachPlan = {
  kind: "run" | "lift" | "rest" | "done";
  /** « Séance clé », « Muscu », « Repos »… */
  tag: string;
  title: string;
  lines: string[];
  primary?: CoachAction;
  secondary?: CoachAction;
  /** « Demain : séance bas du corps + abdos » */
  next?: string;
  tone: "go" | "easy" | "rest";
};

/** Réglages. */
export const LIFT_EVERY_DAYS = 2; // Lafay : 2 à 3 séances par semaine, en alternance
export const EASY_RUN_AFTER_DAYS = 3; // sans programme : footing proposé après 3 jours sans courir
export const EASY_RUN_MIN = 40;
export const REST_FORM = -30; // fatigue « risque élevé » (lib/fitness.ts)
export const TIRED_FORM = -20;
/**
 * Créneaux où tu peux courir (minutes depuis minuit, heure de Paris) : en semaine, avant le travail, le midi et le soir ;
 * le week-end, toute la journée. La sortie doit tenir entièrement dans un créneau.
 */
const H = (h: number, m = 0) => h * 60 + m;
export const FREE_TIME = {
  weekday: [[H(6), H(8)], [H(12, 30), H(13, 30)], [H(18), H(23)]], // 8 h – 9 h : trajet en vélo électrique vers le travail
  weekend: [[H(6), H(23)]],
} as const;

/** Jour ISO (1 = lundi) et minute de la journée, à l'heure de `tz`. */
function local(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { dow: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1, min: Number(get("hour")) * 60 + Number(get("minute")) };
}
/** La sortie [départ, départ + durée] tient-elle dans un de tes créneaux libres ? */
export function fitsFreeTime(startMs: number, minutes: number, tz: string) {
  const { dow, min } = local(startMs, tz);
  return (dow >= 6 ? FREE_TIME.weekend : FREE_TIME.weekday).some(([from, to]) => min >= from && min + minutes <= to);
}

const UPPER = new Set(["CHEST", "BACK", "LATS", "TRAPS", "SHOULDERS", "BICEPS", "TRICEPS", "FOREARMS"]);
const LOWER = new Set(["QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "ADDUCTORS", "ABS", "OBLIQUES", "LOWER_BACK"]);

/** Haut ou bas du corps, d'après les muscles principaux de la séance (null si mélangé ou inconnu). */
export function liftHalf(muscles: string[]): Half | null {
  const up = muscles.filter((m) => UPPER.has(m)).length, low = muscles.filter((m) => LOWER.has(m)).length;
  if (!up && !low) return null;
  if (up >= low * 1.5) return "upper";
  if (low >= up * 1.5) return "lower";
  return null;
}

export const HALF_SESSION: Record<Half, { title: string; detail: string }> = {
  upper: { title: "Haut du corps", detail: "Dips, pompes, tractions · 6 séries, 30 s de repos" },
  lower: { title: "Bas du corps + abdos", detail: "Squats sautés, crunchs, relevés de genoux · 6 séries, 30 s de repos" },
};
const nextHalf = (h: Half | null): Half => (h === "upper" ? "lower" : "upper");

const dayKey = (ms: number, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
export const hhmm = (ms: number, tz: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(ms)).replace(":", " h ").replace(/ h 00$/, " h");

/**
 * Meilleur départ dans les prochaines heures (toutes les 30 min, dans tes créneaux libres, de jour autant que possible) :
 * le moins de pluie, puis un ressenti proche de 12 °C, puis le moins de vent.
 */
export function bestSlot(weatherAt: (startMs: number) => RideWeather | null, now: number, minutes: number, tz: string): CoachSlot | null {
  const first = Math.ceil((now + 10 * 6e4) / 18e5) * 18e5;
  let best: { s: CoachSlot; score: number } | null = null;
  for (let t = first; t <= now + 14 * 36e5; t += 18e5) {
    const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date(t)));
    if (!fitsFreeTime(t, minutes, tz)) continue;
    if (dayKey(t, tz) !== dayKey(now, tz) && best) break; // aujourd'hui d'abord ; demain seulement si rien ce soir
    const w = weatherAt(t);
    if (!w) continue;
    const night = w.sunset != null && t + minutes * 6e4 > w.sunset;
    const s: CoachSlot = { at: t, feels: Math.round((w.feelsMin + w.feelsMax) / 2), rainPct: w.rainProbMax, windKmh: Math.round(w.windKmh), night };
    const score = w.rainProbMax * 2 + Math.abs(s.feels - 12) * 1.5 + w.windKmh * 0.5 + (night ? 40 : 0) + (t - first) / 36e5; // à égalité, le plus tôt
    if (!best || score < best.score) best = { s, score };
  }
  return best?.s ?? null;
}

/** « 18 h · 9 °C ressentis · sec · vent 12 km/h » */
export function slotText(s: CoachSlot, tz: string, now: number) {
  const day = dayKey(s.at, tz) === dayKey(now, tz) ? "" : "demain ";
  const rain = s.rainPct >= 60 ? "pluie probable" : s.rainPct >= 30 ? `averses possibles (${s.rainPct} %)` : "sec";
  return [`${day}${hhmm(s.at, tz)}`, `${s.feels} °C ressentis`, rain, `vent ${s.windKmh} km/h`, s.night && "finit de nuit : frontale"].filter(Boolean).join(" · ");
}

const routeHref = (minutes: number) => `/itineraires?sport=RUN&minutes=${Math.max(15, Math.round(minutes / 5) * 5)}`;
const LIFT_HREF = "/record/session";

/** La recommandation du jour. */
export function coachToday(i: CoachInput): CoachPlan {
  const today = dayKey(i.now, i.tz);
  const sinceRun = i.lastRunAt == null ? Infinity : daysBetween(dayKey(i.lastRunAt, i.tz), today);
  const sinceLift = i.lastLiftAt == null ? Infinity : daysBetween(dayKey(i.lastLiftAt, i.tz), today);
  const half = nextHalf(i.lastLiftHalf);
  const runDue = !!i.runNext && i.runNext.date <= today;
  const runTomorrow = !!i.runNext && daysBetween(today, i.runNext.date) === 1;
  const liftDue = sinceLift >= LIFT_EVERY_DAYS;
  const lift = HALF_SESSION[half];
  const runLine = (r: NonNullable<CoachInput["runNext"]>) => `${r.title} · ${r.minutes} min`;

  // Déjà fait aujourd'hui : on félicite et on annonce la suite.
  if (i.todayDone.length) {
    const did = i.todayDone.map((d) => d.title).join(" + ");
    const next = runTomorrow ? `Demain : ${runLine(i.runNext!)}` : i.todayDone.some((d) => d.type === "WORKOUT") ? undefined : liftDue ? `Demain : muscu ${lift.title.toLowerCase()}` : undefined;
    return { kind: "done", tag: "Fait", title: "Séance du jour faite", lines: [did, "Mange, hydrate-toi, dors bien : c'est là que tu progresses."], next, tone: "easy" };
  }

  // Grosse fatigue : repos, même si une séance est prévue.
  if (i.form.value <= REST_FORM) {
    return {
      kind: "rest", tag: "Repos", title: "Repos aujourd'hui",
      lines: [`Fatigue très élevée (forme ${Math.round(i.form.value)}). Marche, mobilité, sommeil.`, runDue ? `${i.runNext!.title} peut attendre demain.` : "La forme reviendra plus vite que tu ne crois."],
      next: runDue ? `Demain : ${runLine(i.runNext!)}` : undefined, tone: "rest",
    };
  }

  // Séance course prévue (ou en retard) : elle passe en premier.
  if (runDue) {
    const r = i.runNext!, tired = i.form.value <= TIRED_FORM;
    const late = daysBetween(r.date, today);
    const lines = [r.summary || runLine(r)];
    if (i.slot) lines.push(`Meilleur créneau : ${slotText(i.slot, i.tz, i.now)}`);
    if (i.classic) lines.push(`${i.classic.title} tient pile (${i.classic.minutes} min)`);
    if (tired && r.isKey) lines.push("Fatigue marquée : vise le bas des allures, ou décale à demain.");
    if (late > 0) lines.push(`Prévue ${late === 1 ? "hier" : `il y a ${late} jours`} : fais-la aujourd'hui, le programme suit.`);
    return {
      kind: "run", tag: r.isKey ? "Séance clé" : "Course", title: r.title, lines,
      primary: { label: `Trouver une boucle de ${r.minutes} min`, href: routeHref(r.minutes) },
      secondary: { label: "Voir le programme", href: "/plan" },
      next: liftDue ? `Demain : muscu ${lift.title.toLowerCase()}` : undefined, tone: tired ? "easy" : "go",
    };
  }

  // Muscu : alternance haut / bas, tous les 2 jours au moins.
  if (liftDue) {
    return {
      kind: "lift", tag: "Muscu", title: `Séance ${lift.title.toLowerCase()}`,
      lines: [lift.detail, i.lastLiftAt == null ? "Première séance : choisis tes variantes et tes répétitions de départ." : `Dernière séance il y a ${sinceLift} jours${i.lastLiftHalf ? ` (${HALF_SESSION[i.lastLiftHalf].title.toLowerCase()})` : ""}.`],
      primary: { label: "Démarrer la séance", href: LIFT_HREF },
      next: runTomorrow ? `Demain : ${runLine(i.runNext!)}` : undefined, tone: "go",
    };
  }

  // Sans séance prévue : un footing facile si ça fait longtemps.
  if (!i.runNext && sinceRun >= EASY_RUN_AFTER_DAYS) {
    const lines = [`${sinceRun === Infinity ? "Pas de course récente" : `${sinceRun} jours sans courir`} : footing facile, en aisance respiratoire.`];
    if (i.slot) lines.push(`Meilleur créneau : ${slotText(i.slot, i.tz, i.now)}`);
    if (i.classic) lines.push(`${i.classic.title} tient pile (${i.classic.minutes} min)`);
    return {
      kind: "run", tag: "Footing", title: `Footing facile · ${EASY_RUN_MIN} min`, lines,
      primary: { label: `Trouver une boucle de ${EASY_RUN_MIN} min`, href: routeHref(EASY_RUN_MIN) }, tone: "easy",
    };
  }

  // Rien de dû : repos actif, et ce qui vient.
  const next = runTomorrow ? `Demain : ${runLine(i.runNext!)}` : i.runNext ? `Prochaine course : ${i.runNext.title}` : `Demain : muscu ${lift.title.toLowerCase()}`;
  return { kind: "rest", tag: "Récup", title: "Récupération", lines: ["Rien de prévu aujourd'hui. Une marche ou un peu de mobilité, et tu arriveras frais."], next, tone: "rest" };
}
