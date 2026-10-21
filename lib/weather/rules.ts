/**
 * Règles météo des boucles : bonus et malus ajoutés au score, alertes, ligne météo et conseil tenue.
 * Fonctions pures (tests : tools/test-weather.ts). Tous les seuils réglables sont ici.
 */
import type { RouteSport } from "@/lib/routes/estimate";
import type { RideWeather } from "./open-meteo";

// ───────── Seuils ─────────
/** Nuit : on veut être rentré 15 min avant le coucher du soleil. */
export const NIGHT_MARGIN_MIN = 15;
/** Vent qui mérite d'être pris de face à l'aller (moyenne, km/h). */
export const STRONG_WIND_KMH: Record<RouteSport, number> = { RIDE: 15, RUN: 25 };
/** En dessous, la ligne météo dit « peu de vent ». */
export const LIGHT_WIND_KMH = 10;
export const GUST_ALERT_KMH = 50;
export const RAIN_ALERT_PCT = 60;
export const RAIN_DRY_PCT = 20;
export const MUD_RAIN_48H_MM = 10;
export const HEAT_FEELS_C = 25;
export const COLD_FEELS_C = 3;
export const UV_ALERT = 6;
/** Inverser la boucle seulement si le gain est net (part du vent de face à l'aller). */
const REVERSE_GAIN = 0.1;
/** Répartition du vent de face entre aller et retour au-delà de laquelle on le dit. */
const SPLIT_SAY = 0.3;

// ───────── Poids (le score global vaut ≈ 0 → 1) ─────────
const W_NIGHT_LIT = 0.2;
const W_NIGHT_FOREST = 0.25;
const W_NIGHT_UNLIT_PATH = 0.15;
const W_WIND_SPLIT = 0.1;
const W_GUST_FOREST = 0.4;
const W_MUD = 0.25;
const W_HEAT_SHADE = 0.15;
const W_HEAT_WATER = 0.05;

export type WeatherAlert = { tone: "warn" | "bad"; text: string };
/** Météo d'une boucle, enregistrée avec elle (SuggestedRoute.weather). */
export type RouteWeather = {
  startAt: number;
  line: string;
  alerts: WeatherAlert[];
  outfit: string;
  /** Sens inversé par rapport au tracé d'ORS pour prendre le vent de face à l'aller. */
  reversed: boolean;
};

const fmtTime = (ms: number) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(ms));
const deg = (c: number) => `${Math.round(c)} °C`;
const pct = (x: number) => `${Math.round(x * 100)} %`;

// ───────── Vent par tronçon ─────────
type Coord = [number, number, ...number[]];

/** Cap (°, 0 = nord, sens horaire) de a vers b, en projection locale. */
export function heading(a: Coord, b: Coord) {
  const k = Math.cos((a[0] * Math.PI) / 180);
  return ((Math.atan2((b[1] - a[1]) * k, b[0] - a[0]) * 180) / Math.PI + 360) % 360;
}

/**
 * Vent de face sur chaque moitié de la boucle : somme des composantes de face positives (km/h × m).
 * La composante nette d'une moitié ne dépend que du point à mi-parcours (pareil dans les deux sens) : seule
 * la part réellement prise de face distingue une boucle de son inverse.
 * `split` : +1 = tout le vent de face à l'aller, −1 = tout au retour. `head` : vent de face moyen sur la boucle (km/h).
 */
export function windSplit(coords: Coord[], windKmh: number, fromDeg: number) {
  const segs: { len: number; head: number }[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i], k = Math.cos((a[0] * Math.PI) / 180);
    const len = Math.hypot((b[0] - a[0]) * 110_540, (b[1] - a[1]) * 111_320 * k);
    if (!len) continue;
    // Le vent vient de `fromDeg` : rouler vers cette direction = vent de face.
    segs.push({ len, head: windKmh * Math.cos(((heading(a, b) - fromDeg) * Math.PI) / 180) });
    total += len;
  }
  let h1 = 0, h2 = 0, at = 0;
  for (const s of segs) {
    const pos = s.head > 0 ? s.head * s.len : 0;
    if (at + s.len / 2 <= total / 2) h1 += pos; else h2 += pos;
    at += s.len;
  }
  return { split: h1 + h2 ? (h1 - h2) / (h1 + h2) : 0, head: total ? (h1 + h2) / total : 0 };
}

export const strongWind = (w: RideWeather, sport: RouteSport) => w.windKmh >= STRONG_WIND_KMH[sport];

/** Faut-il parcourir la boucle dans l'autre sens pour avoir le vent de face à l'aller ? */
export function shouldReverse(coords: Coord[], w: RideWeather, sport: RouteSport) {
  if (!strongWind(w, sport)) return false;
  const fwd = windSplit(coords, w.windKmh, w.windFromDeg).split;
  const rev = windSplit([...coords].reverse(), w.windKmh, w.windFromDeg).split;
  return rev > fwd + REVERSE_GAIN;
}

// ───────── Nuit ─────────
export function nightInfo(w: RideWeather, estMinutes: number, now = Date.now()) {
  if (w.sunset == null || w.sunrise == null) return null;
  const limit = w.sunset - NIGHT_MARGIN_MIN * 6e4, arrival = w.startAt + estMinutes * 6e4;
  const before = w.startAt < w.sunrise, after = w.startAt >= w.sunset;
  const night = before || after || arrival > limit;
  if (!night) return { night, tip: null as string | null };
  let tip: string;
  if (before) tip = `Départ avant le lever du soleil (${fmtTime(w.sunrise)})`;
  else if (after) tip = `Départ après le coucher du soleil (${fmtTime(w.sunset)})`;
  else {
    const latest = limit - estMinutes * 6e4, maxMin = Math.floor((limit - w.startAt) / 6e4);
    tip = latest >= now + 5 * 6e4 ? `Pars avant ${fmtTime(latest)} pour rentrer de jour`
      : maxMin >= 15 ? `${maxMin} min de jour au plus : raccourcis la boucle`
      : "Il fera nuit : éclairage indispensable";
  }
  return { night, before, after, tip };
}

// ───────── Conseil tenue ─────────
const RUN_LAYERS: [number, string][] = [
  [0, "Collant long, deux couches, gants et bonnet"],
  [5, "Collant long, manches longues chaudes, gants fins"],
  [10, "Collant ou corsaire, manches longues"],
  [15, "Short ou corsaire, manches longues fines"],
  [22, "Short et t-shirt"],
];
const RIDE_LAYERS: [number, string][] = [
  [3, "Collant long, veste thermique, gants d'hiver, couvre-chaussures"],
  [8, "Collant long, manches longues et coupe-vent, gants longs"],
  [13, "Jambières, manchettes, coupe-vent, gants fins"],
  [18, "Cuissard court, maillot et gilet coupe-vent"],
  [24, "Cuissard et maillot courts"],
];

export function outfit(w: RideWeather, sport: RouteSport, night: boolean) {
  const layers = sport === "RUN" ? RUN_LAYERS : RIDE_LAYERS;
  const base = layers.find(([max]) => w.feelsMin <= max)?.[1] ?? (sport === "RUN" ? "Tenue légère, casquette, de quoi boire" : "Tenue légère, deux bidons");
  const parts = [base];
  if (w.feelsMax - w.feelsMin >= 6) parts.push("une couche à retirer en route");
  if (w.rainProbMax >= RAIN_ALERT_PCT) parts.push("veste imperméable");
  else if (w.rainProbMax >= 30) parts.push("veste de pluie légère dans la poche");
  if (night) parts.push(sport === "RUN" ? "frontale et gilet réfléchissant" : "éclairage avant et arrière, gilet réfléchissant");
  if (w.uvMax >= UV_ALERT) parts.push("crème solaire et lunettes");
  return parts.join(" · ");
}

// ───────── Note et textes d'une boucle ─────────
export type RouteFeatures = {
  /** Après inversion éventuelle. */
  coords: Coord[];
  estMinutes: number;
  /** Parts du tracé (0 → 1). `lit` : null si l'éclairage n'a pas été cherché ou n'a pas répondu. */
  forest: number;
  unpaved: number;
  lit: number | null;
  waterPoints: number;
  reversed: boolean;
};

function windText(w: RideWeather, split: number, head: number) {
  if (w.windKmh < LIGHT_WIND_KMH) return "Peu de vent";
  if (split >= SPLIT_SAY) return "Vent de face à l'aller, retour poussé";
  if (split <= -SPLIT_SAY) return "Vent dans le dos à l'aller, de face au retour";
  return head < w.windKmh * 0.25 ? "Vent surtout de côté" : "Vent de face réparti sur la boucle";
}

const rainText = (w: RideWeather) =>
  w.rainProbMax < RAIN_DRY_PCT && w.rainMm < 0.2 ? "sec"
    : w.rainProbMax >= RAIN_ALERT_PCT ? `pluie probable (${w.rainProbMax} %)`
    : `averses possibles (${w.rainProbMax} %)`;

/** Bonus ou malus (≈ −0,5 → +0,3) à ajouter au score global, et la météo affichée sur la carte et dans le détail. */
export function weatherAdjust(w: RideWeather, sport: RouteSport, f: RouteFeatures, now = Date.now()): { bonus: number; weather: RouteWeather } {
  let bonus = 0;
  const alerts: WeatherAlert[] = [];
  const { split, head } = windSplit(f.coords, w.windKmh, w.windFromDeg);
  const n = nightInfo(w, f.estMinutes, now);

  if (n?.night) {
    const lit = f.lit ?? 0;
    bonus += W_NIGHT_LIT * lit - W_NIGHT_FOREST * f.forest - W_NIGHT_UNLIT_PATH * f.unpaved * (1 - lit);
    const what = n.before || n.after ? "Sortie de nuit" : `Nuit avant le retour (coucher ${fmtTime(w.sunset!)})`;
    alerts.push({ tone: "warn", text: [what, n.tip, f.lit != null && `${pct(f.lit)} éclairé`].filter(Boolean).join(" · ") });
  }
  if (strongWind(w, sport)) bonus += W_WIND_SPLIT * split;
  if (w.gustMax >= GUST_ALERT_KMH) {
    bonus -= W_GUST_FOREST * f.forest;
    alerts.push({ tone: "bad", text: `Rafales à ${Math.round(w.gustMax)} km/h${f.forest >= 0.05 ? ` : ${pct(f.forest)} en forêt, gare aux branches` : " : prudence"}` });
  }
  if (w.rainProbMax >= RAIN_ALERT_PCT) alerts.push({ tone: "warn", text: `Pluie probable (${w.rainProbMax} %${w.rainMm >= 0.5 ? `, ${w.rainMm.toLocaleString("fr-FR")} mm` : ""})` });
  if (w.rain48hMm >= MUD_RAIN_48H_MM) {
    bonus -= W_MUD * f.unpaved;
    if (f.unpaved >= 0.1) alerts.push({ tone: "warn", text: `${pct(f.unpaved)} non revêtu : chemins sans doute boueux (${Math.round(w.rain48hMm)} mm en 48 h)` });
  }
  if (w.feelsMax >= HEAT_FEELS_C) {
    bonus += W_HEAT_SHADE * f.forest + W_HEAT_WATER * Math.min(1, f.waterPoints);
    const c = w.coolest, cooler = c && c.feels <= w.feelsMax - 2 && Math.abs(c.at - w.startAt) >= 36e5;
    alerts.push({ tone: "warn", text: `Ressenti jusqu'à ${deg(w.feelsMax)}${cooler ? ` · plus frais vers ${fmtTime(c.at)} (${deg(c.feels)})` : ""}${f.waterPoints ? ` · ${f.waterPoints} point${f.waterPoints > 1 ? "s" : ""} d'eau` : ""}` });
  }
  if (w.feelsMin <= COLD_FEELS_C) alerts.push({ tone: "warn", text: `Ressenti ${deg(w.feelsMin)} : verglas possible, prends des gants` });

  const night = !!n?.night;
  const nightText = n == null ? null : !night ? "retour avant la nuit" : n.before || n.after ? "de nuit" : "nuit avant le retour";
  return {
    bonus,
    weather: {
      startAt: w.startAt,
      line: [windText(w, split, head), rainText(w), nightText].filter(Boolean).join(" · "),
      alerts,
      outfit: outfit(w, sport, night),
      reversed: f.reversed,
    },
  };
}
