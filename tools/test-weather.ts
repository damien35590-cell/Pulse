// Lancer avec : npx tsx tools/test-weather.ts
import assert from "node:assert/strict";
import { aggregate, parseStart, type OpenMeteoRaw, type RideWeather } from "../lib/weather/open-meteo";
import { nightInfo, outfit, shouldReverse, weatherAdjust, windSplit, type RouteFeatures } from "../lib/weather/rules";

const H = 36e5;
const t0 = Date.parse("2026-10-21T00:00:00+02:00"); // minuit à Paris
const hours = Array.from({ length: 5 * 24 }, (_, i) => t0 - 2 * 864e5 + i * H); // 2 jours passés + 3 jours de prévision

/** Prévision fictive : ressenti = 10 + heure / 2 l'après-midi, 1 mm/h la veille, vent de 350° et 10° en alternance. */
function raw(over: Partial<Record<string, (t: number, i: number) => number>> = {}): OpenMeteoRaw {
  const col = (k: string, f: (t: number, i: number) => number) => hours.map((t, i) => (over[k] ?? f)(t, i));
  const hourOf = (t: number) => new Date(t).getUTCHours() + 2;
  return {
    hourly: {
      time: hours.map((t) => t / 1000),
      temperature_2m: col("temperature_2m", (t) => 12 + hourOf(t) / 4),
      apparent_temperature: col("apparent_temperature", (t) => 10 + hourOf(t) / 2),
      precipitation_probability: col("precipitation_probability", (t) => (hourOf(t) === 15 ? 70 : 10)),
      precipitation: col("precipitation", (t) => (t >= t0 - 864e5 && t < t0 ? 1 : 0)),
      wind_speed_10m: col("wind_speed_10m", () => 20),
      wind_gusts_10m: col("wind_gusts_10m", (t) => (hourOf(t) === 16 ? 55 : 30)),
      wind_direction_10m: col("wind_direction_10m", (_t, i) => (i % 2 ? 350 : 10)),
      uv_index: col("uv_index", () => 2),
      is_day: col("is_day", (t) => (hourOf(t) >= 8 && hourOf(t) < 19 ? 1 : 0)),
      cloud_cover: col("cloud_cover", () => 50),
    },
    daily: {
      time: [0, 1, 2, 3, 4].map((d) => (t0 + (d - 2) * 864e5) / 1000),
      sunrise: [0, 1, 2, 3, 4].map((d) => (t0 + (d - 2) * 864e5 + 8 * H) / 1000),
      sunset: [0, 1, 2, 3, 4].map((d) => (t0 + (d - 2) * 864e5 + 18.75 * H) / 1000),
    },
  };
}

// ── Agrégation sur la fenêtre de la sortie ──
const start = t0 + 14.5 * H; // 14:30
const w = aggregate(raw(), start, 90, t0 + 9 * H)!;
assert.equal(w.feelsMin, 17); // 14:00 → 10 + 7
assert.equal(w.feelsMax, 18); // 16:00 → 10 + 8
assert.equal(w.rainProbMax, 70);
assert.equal(w.gustMax, 55);
assert.equal(w.windKmh, 20);
assert.ok(w.windFromDeg <= 5 || w.windFromDeg >= 355, "moyenne vectorielle : 350° et 10° donnent ≈ 0°, pas 180°");
assert.equal(w.rain48hMm, 24); // 24 h à 1 mm la veille
assert.equal(w.sunset, t0 + 18.75 * H);
assert.equal(w.coolest?.at, t0 + 9 * H, "heure la plus fraîche de jour dans les 12 h");
assert.equal(aggregate(raw(), t0 + 10 * 864e5, 60), null, "hors prévision");
assert.equal(aggregate(raw(), t0 + 3 * 864e5 - 30 * 60e3, 60)?.isDay, false); // la veille du dernier jour à 23:30

// ── Heure de départ ──
const now = Date.parse("2026-10-21T10:00:00Z");
assert.equal(parseStart(undefined, now), undefined);
assert.equal(parseStart("2026-10-21T09:50:00Z", now), "2026-10-21T10:00:00.000Z", "léger retard : ramené à maintenant");
assert.equal(parseStart("2026-10-21T08:00:00Z", now), false);
assert.equal(parseStart("2026-10-24T10:00:00Z", now), false);
assert.equal(parseStart("n'importe quoi", now), false);

// ── Vent par tronçon ──
// Triangle densifié : 3 km plein nord, retour en diagonale vers le sud-est, puis 1 km vers l'ouest.
const dense = (pts: [number, number][], n = 30) =>
  pts.slice(1).flatMap(([la, lo], k) => Array.from({ length: n }, (_, i) => [pts[k][0] + ((la - pts[k][0]) * (i + 1)) / n, pts[k][1] + ((lo - pts[k][1]) * (i + 1)) / n] as [number, number]));
const tri: [number, number][] = [[48, -1.5], ...dense([[48, -1.5], [48.027, -1.5], [48, -1.4866], [48, -1.5]])];
const north = windSplit(tri, 20, 0);
assert.ok(north.split > 0.95, "le vent du nord est pris de face à l'aller");
const rev = windSplit([...tri].reverse(), 20, 0);
assert.ok(rev.split < north.split - 0.1, "à l'envers, une partie du vent de face passe au retour");
assert.ok(windSplit(tri, 20, 180).split < -0.5, "vent du sud : de face au retour");
const strong = { ...w, windKmh: 20, windFromDeg: 0 };
assert.equal(shouldReverse(tri, strong, "RIDE"), false);
assert.equal(shouldReverse([...tri].reverse(), strong, "RIDE"), true);
assert.equal(shouldReverse([...tri].reverse(), strong, "RUN"), false, "20 km/h ne compte pas en course (seuil 25)");

// ── Nuit ──
const day = { ...w, sunset: t0 + 18.75 * H, sunrise: t0 + 8 * H };
assert.equal(nightInfo({ ...day, startAt: t0 + 16 * H }, 60, t0 + 9 * H)?.night, false);
const late = nightInfo({ ...day, startAt: t0 + 17.75 * H }, 60, t0 + 9 * H)!;
assert.equal(late.night, true);
assert.match(late.tip!, /^Pars avant 17:30/); // 18:45 − 15 min − 60 min
assert.match(nightInfo({ ...day, startAt: t0 + 17.75 * H }, 60, t0 + 17.75 * H)!.tip!, /^45 min de jour au plus/);
assert.match(nightInfo({ ...day, startAt: t0 + 7 * H }, 60, t0 + 6 * H)!.tip!, /lever du soleil/);

// ── Bonus, malus et textes ──
const calm: RideWeather = { ...w, startAt: t0 + 10 * H, feelsMin: 14, feelsMax: 16, rainProbMax: 5, rainMm: 0, windKmh: 5, gustMax: 20, uvMax: 2, rain48hMm: 0, sunset: day.sunset, sunrise: day.sunrise };
const f = (x: Partial<RouteFeatures> = {}): RouteFeatures => ({ coords: tri, estMinutes: 60, forest: 0.5, unpaved: 0.4, lit: 0.2, waterPoints: 0, reversed: false, ...x });
const ok = weatherAdjust(calm, "RUN", f(), t0 + 9 * H);
assert.equal(ok.bonus, 0);
assert.deepEqual(ok.weather.alerts, []);
assert.equal(ok.weather.line, "Peu de vent · sec · retour avant la nuit");

const dusk = { ...calm, startAt: t0 + 17.75 * H };
const forest = weatherAdjust(dusk, "RUN", f({ forest: 0.8, lit: 0 }), t0 + 9 * H), town = weatherAdjust(dusk, "RUN", f({ forest: 0, lit: 0.9 }), t0 + 9 * H);
assert.ok(town.bonus > 0 && forest.bonus < 0, "de nuit, l'éclairage aide et la forêt pénalise");
assert.match(forest.weather.alerts[0].text, /^Nuit avant le retour \(coucher 18:45\) · Pars avant 17:30/);
assert.match(forest.weather.outfit, /frontale/);

const windy = { ...calm, windKmh: 20, windFromDeg: 0, gustMax: 60 };
const head = weatherAdjust(windy, "RIDE", f({ forest: 0 }));
assert.ok(head.bonus > 0.09, "vent de face à l'aller : bonus");
assert.match(head.weather.line, /^Vent de face à l'aller, retour poussé/);
assert.ok(weatherAdjust(windy, "RIDE", f({ forest: 0.6 })).bonus < head.bonus - 0.2, "rafales : forêt fortement pénalisée");
assert.equal(head.weather.alerts[0].tone, "bad");

const muddy = weatherAdjust({ ...calm, rain48hMm: 15, rainProbMax: 80 }, "RUN", f({ unpaved: 0.4 }));
assert.ok(muddy.bonus < 0);
assert.ok(muddy.weather.alerts.some((a) => /chemins sans doute boueux \(15 mm en 48 h\)/.test(a.text)));
assert.ok(muddy.weather.alerts.some((a) => /^Pluie probable \(80 %/.test(a.text)));
assert.match(muddy.weather.line, /pluie probable \(80 %\)/);

const hot = { ...calm, feelsMin: 27, feelsMax: 31, uvMax: 7, coolest: { at: t0 + 19 * H, feels: 24 } };
const shade = weatherAdjust(hot, "RUN", f({ forest: 0.7, waterPoints: 2 })), sun = weatherAdjust(hot, "RUN", f({ forest: 0, waterPoints: 0 }));
assert.ok(shade.bonus > sun.bonus, "chaleur : l'ombre et l'eau comptent");
assert.match(shade.weather.alerts[0].text, /plus frais vers 19:00 \(24 °C\) · 2 points d'eau/);
assert.match(shade.weather.outfit, /crème solaire/);

const cold = weatherAdjust({ ...calm, feelsMin: 1, feelsMax: 3 }, "RIDE", f());
assert.ok(cold.weather.alerts.some((a) => /verglas possible/.test(a.text)));
assert.match(outfit({ ...calm, feelsMin: 1, feelsMax: 3 }, "RIDE", false), /gants d'hiver/);

console.log("✓ météo : agrégation, départ, vent, nuit, pluie, chaleur, froid");
