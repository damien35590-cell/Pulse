/**
 * Météo d'une sortie avec Open-Meteo (gratuit, sans clé, licence CC BY 4.0). Côté serveur uniquement.
 * Une requête par maille de 0,05° et par heure, gardée 30 min en base ; null au moindre souci : les boucles s'en passent.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const URL = "https://api.open-meteo.com/v1/forecast";
/** Maille du cache (degrés) : environ 5,5 × 3,7 km en Bretagne, la résolution utile des modèles. */
const GRID = 0.05;
const CACHE_MIN = 30;
const VERSION = "om1";
const FETCH_TIMEOUT_MS = 5000;
/** Fenêtre où l'on cherche l'heure la plus fraîche. */
const COOLEST_WITHIN_H = 12;
const HOURLY = ["temperature_2m", "apparent_temperature", "precipitation_probability", "precipitation", "wind_speed_10m", "wind_gusts_10m", "wind_direction_10m", "uv_index", "is_day", "cloud_cover"] as const;

type Hourly = Record<(typeof HOURLY)[number], (number | null)[]> & { time: number[] };
/** Réponse Open-Meteo (timeformat=unixtime : secondes UTC, jours alignés sur Europe/Paris). */
export type OpenMeteoRaw = { hourly: Hourly; daily: { time: number[]; sunrise: number[]; sunset: number[] } };

/** Météo agrégée sur la fenêtre [départ, départ + durée]. Heures en ms (epoch). */
export type RideWeather = {
  startAt: number;
  endAt: number;
  feelsMin: number;
  feelsMax: number;
  tempMin: number;
  rainProbMax: number;
  rainMm: number;
  windKmh: number;
  /** D'où vient le vent (°, 0 = nord, convention météo). */
  windFromDeg: number;
  gustMax: number;
  uvMax: number;
  cloudMean: number;
  isDay: boolean;
  sunrise: number | null;
  sunset: number | null;
  /** Pluie tombée sur les 48 h avant le départ (mm). */
  rain48hMm: number;
  /** Heure la plus fraîche (de jour si possible) des 12 h à venir. */
  coolest: { at: number; feels: number } | null;
};

const H = 36e5;
const round1 = (x: number) => Math.round(x * 10) / 10;
const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Agrégation pure (tests : tools/test-weather.ts). Null si la fenêtre n'est pas couverte par la prévision. */
export function aggregate(raw: OpenMeteoRaw, startAt: number, minutes: number, now = Date.now()): RideWeather | null {
  const h = raw.hourly, endAt = startAt + minutes * 6e4;
  const t = h.time.map((s) => s * 1000);
  const from = Math.floor(startAt / H) * H;
  const win = t.map((x, i) => i).filter((i) => t[i] >= from && t[i] <= endAt);
  if (!win.length) return null;
  const vals = (k: (typeof HOURLY)[number], idx = win) => idx.map((i) => num(h[k][i])).filter((v): v is number => v != null);
  const feels = vals("apparent_temperature"), temps = vals("temperature_2m");
  if (!feels.length) return null;

  // Vent moyen et direction moyenne : moyenne vectorielle (350° et 10° donnent 0°, pas 180°).
  let u = 0, v = 0, speed = 0, n = 0;
  for (const i of win) {
    const s = num(h.wind_speed_10m[i]), d = num(h.wind_direction_10m[i]);
    if (s == null || d == null) continue;
    u += s * Math.sin((d * Math.PI) / 180); v += s * Math.cos((d * Math.PI) / 180); speed += s; n++;
  }
  const dir = n ? ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360 : 0;

  // Jour du départ (heure de Paris) : le dernier jour dont minuit est passé.
  const day = raw.daily.time.reduce((k, d, i) => (d * 1000 <= startAt ? i : k), -1);
  const sunrise = day >= 0 ? raw.daily.sunrise[day] * 1000 : null, sunset = day >= 0 ? raw.daily.sunset[day] * 1000 : null;

  // Pluie des 48 h avant le départ (observée puis prévue) : chaque valeur horaire couvre l'heure écoulée.
  const past = t.map((x, i) => i).filter((i) => t[i] > from - 48 * H && t[i] <= from);
  const rain48 = vals("precipitation", past).reduce((a, b) => a + b, 0);

  const next = t.map((x, i) => i).filter((i) => t[i] >= Math.floor(now / H) * H && t[i] <= now + COOLEST_WITHIN_H * H && num(h.apparent_temperature[i]) != null);
  const pool = next.some((i) => h.is_day[i] === 1) ? next.filter((i) => h.is_day[i] === 1) : next;
  const c = pool.sort((a, b) => h.apparent_temperature[a]! - h.apparent_temperature[b]!)[0];

  const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    startAt, endAt,
    feelsMin: round1(Math.min(...feels)), feelsMax: round1(Math.max(...feels)),
    tempMin: round1(temps.length ? Math.min(...temps) : Math.min(...feels)),
    rainProbMax: max(vals("precipitation_probability")),
    rainMm: round1(vals("precipitation").reduce((a, b) => a + b, 0)),
    windKmh: round1(n ? speed / n : 0), windFromDeg: Math.round(dir),
    gustMax: round1(max(vals("wind_gusts_10m"))),
    uvMax: round1(max(vals("uv_index"))),
    cloudMean: Math.round(mean(vals("cloud_cover"))),
    isDay: h.is_day[win[0]] === 1,
    sunrise, sunset,
    rain48hMm: round1(rain48),
    coolest: c != null ? { at: t[c], feels: round1(h.apparent_temperature[c]!) } : null,
  };
}

const snap = (x: number) => Math.round(Math.round(x / GRID) * GRID * 1000) / 1000;

async function fetchRaw(lat: number, lng: number): Promise<OpenMeteoRaw | null> {
  const q = new URLSearchParams({
    latitude: String(lat), longitude: String(lng), models: "best_match", timezone: "Europe/Paris", timeformat: "unixtime",
    hourly: HOURLY.join(","), daily: "sunrise,sunset", past_days: "2", forecast_days: "3",
  });
  const r = await fetch(`${URL}?${q}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  if (!Array.isArray(j?.hourly?.time) || !Array.isArray(j?.daily?.time)) return null;
  return { hourly: j.hourly, daily: { time: j.daily.time, sunrise: j.daily.sunrise, sunset: j.daily.sunset } };
}

/** Prévision brute de la maille, depuis le cache si elle a moins de 30 min. */
async function loadRaw(lat: number, lng: number): Promise<OpenMeteoRaw | null> {
  const la = snap(lat), lo = snap(lng), hour = new Date().toISOString().slice(0, 13);
  const key = `${VERSION}:${la}:${lo}:${hour}`;
  const since = new Date(Date.now() - CACHE_MIN * 6e4);
  const row = await prisma.weatherCache.findUnique({ where: { key } }).catch(() => null);
  if (row && row.fetchedAt >= since) return row.data as unknown as OpenMeteoRaw;

  const raw = await fetchRaw(la, lo);
  if (!raw) return null;
  // Le cache est un bonus : une erreur d'écriture ne doit rien bloquer.
  await prisma.$transaction([
    prisma.weatherCache.deleteMany({ where: { OR: [{ key }, { fetchedAt: { lt: new Date(Date.now() - 864e5) } }] } }),
    prisma.weatherCache.create({ data: { key, data: raw as unknown as Prisma.InputJsonValue } }),
  ]).catch(() => undefined);
  return raw;
}

/** Départ facultatif (maintenant par défaut), au plus 48 h plus tard ; false si invalide. */
export function parseStart(v: unknown, now = Date.now()): string | undefined | false {
  if (v == null || v === "") return undefined;
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  if (!Number.isFinite(t) || t < now - 30 * 6e4 || t > now + 48 * H) return false;
  return new Date(Math.max(t, now)).toISOString();
}

/** Météo de la sortie (départ ISO, durée en min). Null si Open-Meteo ne répond pas ou si la date sort de la prévision. */
export async function getRideWeather(lat: number, lng: number, startISO: string, minutes: number): Promise<RideWeather | null> {
  try {
    const start = Date.parse(startISO);
    if (!Number.isFinite(start)) return null;
    const raw = await loadRaw(lat, lng);
    return raw && aggregate(raw, start, minutes);
  } catch {
    return null;
  }
}

/** Prévision brute (cache 30 min), pour évaluer plusieurs heures de départ sans rappeler Open-Meteo. */
export async function getForecast(lat: number, lng: number): Promise<OpenMeteoRaw | null> {
  try { return await loadRaw(lat, lng); } catch { return null; }
}
