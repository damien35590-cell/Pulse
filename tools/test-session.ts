// Lancer avec : npx tsx tools/test-session.ts
import assert from "node:assert/strict";
import {
  flatShare, fmtDuration, fmtKm, parseSession, resample, reverseSpans, sessionFit, sessionFromProgram, straightStretches, straightText,
  waterPlan, waterText, type Pt3, type SessionInput,
} from "../lib/routes/session-fit";
import { classifyPoi } from "../lib/routes/poi";
import { pickThree, scoreRoute, whyText } from "../lib/routes/score";
import { routeHref } from "../lib/coach/today";

// ── Tracés synthétiques : déplacements en mètres depuis Rennes, altitude en fonction de la distance parcourue ──
const LAT0 = 48.11, LNG0 = -1.68, KX = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
type Move = [dx: number, dy: number];
function trace(moves: Move[], ele: (d: number) => number = () => 30, stepM = 20): Pt3[] {
  let x = 0, y = 0, d = 0;
  const out: Pt3[] = [[LAT0, LNG0, ele(0)]];
  for (const [dx, dy] of moves) {
    const len = Math.hypot(dx, dy), n = Math.max(1, Math.round(len / stepM));
    for (let k = 1; k <= n; k++) {
      const px = x + (dx * k) / n, py = y + (dy * k) / n;
      out.push([LAT0 + py / 110_540, LNG0 + px / KX, ele(d + (len * k) / n)]);
    }
    x += dx; y += dy; d += len;
  }
  return out;
}
/** Bruit déterministe ±2 m (modèle d'altitude d'ORS). */
const noise = (d: number) => 2 * Math.sin(d * 0.37) * Math.cos(d * 0.11);
const square = (side = 1000) => [[side, 0], [0, side], [-side, 0], [0, -side]] as Move[];

// ── Paramètres d'URL et type de séance du programme ──
assert.equal(parseSession("intervals"), "intervals");
assert.equal(parseSession("long"), "long");
assert.equal(parseSession("easy"), "easy");
assert.equal(parseSession("n'importe quoi"), "normal");
assert.equal(parseSession(undefined), "normal");
assert.equal(sessionFromProgram({ kind: "INTERVALS_SHORT", title: "VMA courte · 8 × 30/30" }), "intervals");
assert.equal(sessionFromProgram({ kind: "THRESHOLD", title: "Seuil · 3 × 6′" }), "intervals");
assert.equal(sessionFromProgram({ kind: "LONG_RUN", title: "Sortie longue · 65′" }), "long");
assert.equal(sessionFromProgram({ kind: "RECOVERY", title: "Récup" }), "easy");
assert.equal(sessionFromProgram({ kind: "HILLS", title: "Côtes · 10 × 30″" }), "normal", "côtes : pas de recherche de plat");
assert.equal(sessionFromProgram({ title: "Fractionné 8 × 400 m", summary: "" }), "intervals");
assert.equal(sessionFromProgram({ title: "Sortie longue · 70′", summary: "70′ à 6'20 /km" }), "long");
assert.equal(sessionFromProgram({ title: "Footing en endurance · 40′", summary: "40′ à 6'10 /km (65 % VMA)" }), "easy", "le résumé d'un footing parle de VMA : le titre l'emporte");
assert.equal(sessionFromProgram({ title: "Séance du mardi", summary: "20′ · 10 × 1′ à 4'00 /km (r 1′) · 10′" }), "intervals");
assert.equal(sessionFromProgram({ title: "Séance libre", summary: "" }), null);
assert.equal(routeHref(50, "intervals"), "/itineraires?sport=RUN&minutes=50&session=intervals");
assert.equal(routeHref(47, "normal"), "/itineraires?sport=RUN&minutes=45");
assert.equal(routeHref(40), "/itineraires?sport=RUN&minutes=40");

// ── Mise en forme ──
assert.equal(fmtKm(2.1), "2,1");
assert.equal(fmtKm(14), "14");
assert.equal(fmtDuration(50), "50 min");
assert.equal(fmtDuration(90), "1 h 30");
assert.equal(fmtDuration(120), "2 h");

// ── Rééchantillonnage : un point tous les 25 m, altitude lissée ──
const sq = trace(square(), (d) => 30 + noise(d));
const rs = resample(sq);
assert.equal(rs.length, 161, "4 km tous les 25 m, départ et arrivée compris");
assert.ok(rs.every((p) => Math.abs(p.ele - 30) < 1.5), "le bruit de ±2 m est lissé");

// ── Fractionné : lignes droites plates ──
// Carré de 1 km de côté, plat (avec bruit) : 3 côtés droits retenus, le plus long dès le départ.
const st = straightStretches(sq);
assert.equal(st.length, 3);
assert.ok(st[0].lengthM >= 950 && st[0].lengthM <= 1000, JSON.stringify(st));
assert.ok(Math.abs(st[0].gradePct) < 0.5);
assert.equal(straightText(st.slice(0, 1)), `Ligne droite plate de ${st[0].lengthM} m ${st[0].fromKm < 0.1 ? "dès le départ" : `au km ${fmtKm(st[0].fromKm)}`}`);

// Premier côté en côte (+30 m sur 1 km) : il n'est plus retenu, la ligne droite est plus loin.
const hill = trace(square(), (d) => 30 + (d < 1000 ? d * 0.03 : 30));
const sth = straightStretches(hill);
assert.ok(sth.length >= 1 && sth.every((s) => s.fromKm >= 0.9), JSON.stringify(sth));
assert.ok(/au km 1(,\d)? /.test(straightText(sth)) || /au km 0,9 /.test(straightText(sth)), straightText(sth));

// Chemin sinueux (zigzag de 30 m tous les 50 m) : aucune ligne droite.
const zig: Move[] = Array.from({ length: 40 }, (_, i) => [50, i % 2 ? 30 : -30] as Move);
assert.deepEqual(straightStretches(trace(zig, () => 20, 10)), []);
assert.equal(straightText([]), "Pas de ligne droite plate de 400 m : fais tes fractions au temps");

// Grande courbe (rayon 5 km) : « très peu sinueuse », acceptée.
const arc: Move[] = [];
for (let i = 0, a = 0; i < 40; i++, a += 20 / 5000) arc.push([20 * Math.cos(a), 20 * Math.sin(a)]);
assert.ok((straightStretches(trace(arc, () => 10, 20))[0]?.lengthM ?? 0) >= 750, "800 m en courbe douce");

// Trop court : des droites de 350 m seulement.
assert.deepEqual(straightStretches(trace([[350, 0], [0, 350], [350, 0]], () => 10)), []);

// Grande route : le côté qui la suit est écarté (indices de coordonnées ORS).
const firstSide = sq.findIndex((c) => Math.abs((c[1] - LNG0) * KX - 1000) < 1);
const stBig = straightStretches(sq, { bigRoadSpans: [[0, firstSide]] });
assert.ok(stBig.every((s) => s.fromKm >= 0.9), JSON.stringify(stBig));
assert.deepEqual(reverseSpans([[0, 10], [20, 30]], 41), [[10, 20], [30, 40]]);

// ── Récup : planéité ──
assert.ok(flatShare(sq) > 0.95);
const hilly = trace(square(), (d) => 30 + 25 * Math.sin(d / 160));
assert.ok(flatShare(hilly) < 0.5, String(flatShare(hilly)));

// ── Sortie longue : points d'eau ──
const w2 = waterPlan([{ type: "drinking_water", km: 5 }, { type: "viewpoint", km: 6 }, { type: "cemetery", km: 10 }], 15, 90);
assert.equal(w2.drinking, 1);
assert.equal(w2.cemeteries, 1);
assert.equal(w2.maxDryMin, 30, "eau au km 5 et 10 sur 15 km : 30 min au plus sans eau");
assert.equal(waterText(w2, 90), "Points d'eau : km 5 ; 10 (cimetière)");
const w0 = waterPlan([], 15, 90);
assert.equal(w0.maxDryMin, 90);
assert.equal(waterText(w0, 90), "Aucun point d'eau sur 1 h 30 : emporte à boire");
assert.equal(waterText(waterPlan([{ type: "drinking_water", km: 1.4 }], 18, 110), 110), "Point d'eau au km 1,4 · jusqu'à 1 h 41 sans eau");

// ── Note de séance ──
const base = (coords: Pt3[], extra: Partial<SessionInput> = {}): SessionInput => ({
  coords, distanceM: 4000, ascentM: 0, estMinutes: 22, pois: [], nature: 0.3, unpaved: 0, bigRoad: 0, ...extra,
});
assert.equal(sessionFit("normal", base(sq)), null, "séance normale : classement inchangé");

const iv = sessionFit("intervals", base(sq))!;
assert.ok(iv.ok && iv.bonus >= 0.45 && iv.key >= 0.95, JSON.stringify(iv));
assert.ok(iv.text.startsWith("Ligne droite plate de "));
const ivNo = sessionFit("intervals", base(trace(zig, () => 20, 10)))!;
assert.ok(!ivNo.ok && ivNo.bonus < 0 && ivNo.key === 0);

const longDry = sessionFit("long", base(sq, { distanceM: 16_000, estMinutes: 95 }))!;
const longWet = sessionFit("long", base(sq, { distanceM: 16_000, estMinutes: 95, pois: [{ type: "drinking_water", km: 6 }, { type: "drinking_water", km: 11 }] }))!;
assert.ok(longDry.bonus < -0.3 && !longDry.ok, "95 min sans eau : pénalisée");
assert.ok(longWet.bonus > 0.1 && longWet.ok && longWet.key > longDry.key);
assert.equal(longWet.scores.water?.maxDryMin, 36);
const longShort = sessionFit("long", base(sq, { distanceM: 12_000, estMinutes: 70 }))!;
assert.ok(longShort.ok && longShort.bonus === 0, "moins de 75 min : pas de pénalité");

const easyFlat = sessionFit("easy", base(sq, { nature: 0.6, ascentM: 4 }))!;
const easyHilly = sessionFit("easy", base(hilly, { nature: 0.6, ascentM: 120 }))!;
const easyRoad = sessionFit("easy", base(sq, { nature: 0.1, ascentM: 4, bigRoad: 0.5 }))!;
assert.ok(easyFlat.key > easyHilly.key && easyFlat.key > easyRoad.key);
assert.ok(easyFlat.bonus > easyHilly.bonus && easyFlat.bonus > easyRoad.bonus);
assert.equal(easyFlat.text, "100 % plat, 1 m D+/km, quasi sans grandes routes");
assert.equal(easyFlat.scores.flatPct, 100);

// ── Points d'intérêt : fontaines potables et cimetières ──
assert.equal(classifyPoi({ amenity: "fountain", drinking_water: "yes" }), "drinking_water");
assert.equal(classifyPoi({ amenity: "fountain" }), null, "fontaine décorative : pas d'eau");
assert.equal(classifyPoi({ man_made: "water_tap", drinking_water: "yes" }), "drinking_water");
assert.equal(classifyPoi({ landuse: "cemetery" }), "cemetery");
assert.equal(classifyPoi({ amenity: "grave_yard" }), "cemetery");

// ── Notation : un cimetière n'est ni une curiosité ni un point d'eau garanti ──
const cand = (coords: Pt3[], key: string) => ({ key, coords, distanceM: 4000, estMinutes: 22, bigRoadPct: 0, unpavedPct: 0 });
const scored = scoreRoute(cand(sq, "a"), null, "RUN", 22);
scored.pois = [{ id: "c", name: null, type: "cemetery", lat: 0, lng: 0, km: 2 }, { id: "w", name: null, type: "drinking_water", lat: 0, lng: 0, km: 3 }];
assert.ok(!whyText({ ...scored.scores, osm: true, waterPoints: 1 }, scored.pois, { water: false }).includes("point d'eau"));
assert.ok(whyText({ ...scored.scores, osm: true, waterPoints: 1 }, scored.pois).includes("1 point d'eau"));
assert.ok(!whyText({ ...scored.scores, osm: true, waterPoints: 1 }, scored.pois).includes("cimetière"));

// ── Choix des 3 boucles : la meilleure pour la séance d'abord, libellés jamais redonnés ──
const far = (dx: number) => sq.map(([lat, lng, e]) => [lat, lng + dx / KX, e] as Pt3);
const list = [scoreRoute(cand(sq, "a"), null, "RUN", 22), scoreRoute(cand(far(3000), "b"), null, "RUN", 22), scoreRoute(cand(far(6000), "c"), null, "RUN", 22)];
const keyOf = new Map<object, number>([[list[0], 0.2], [list[1], 0.9], [list[2], 0.5]]);
const picks = pickThree(list, [], 3, { label: "Pour le fractionné", key: (r) => keyOf.get(r) ?? 0 });
assert.equal(picks[0].label, "Pour le fractionné");
assert.equal(picks[0].route, list[1]);
assert.equal(picks.length, 3);
assert.equal(new Set(picks.map((p) => p.label)).size, 3);
// Complément d'une première sélection : on garde les choix faits, sans doubler un libellé.
const partial = pickThree([list[1]], [], 3, { label: "Pour le fractionné", key: () => 1 });
const full = pickThree(list, partial);
assert.equal(full[0].label, "Pour le fractionné");
assert.equal(full.length, 3);
assert.equal(new Set(full.map((p) => p.label)).size, 3, full.map((p) => p.label).join(", "));

console.log("✓ séances : fractionné (ligne droite plate), sortie longue (points d'eau), récup (plat, nature)");
