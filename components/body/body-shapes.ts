/**
 * Dessin du corps de la carte des muscles (components/body/body-map.tsx) : illustration originale de Pulse.
 * Adulte athlétique d'environ 8 têtes (tête de 41 unités, du sommet y = 16 à la plante y = 357), épaules larges de 2,5 têtes,
 * deltoïdes en coiffes rondes qui débordent du bras, dos en V, mains discrètes.
 * Seule la moitié gauche de l'écran (x ≤ 100) est décrite ; la droite est la même en miroir autour de x = 100.
 * Chaque muscle est une forme arrondie ; l'écart entre deux formes laisse voir la silhouette (le trait de la carte l'accentue).
 * `m: null` : forme décorative, jamais mise en couleur (tibial antérieur).
 */
import type { MuscleId } from "@/lib/workout/catalog-data";

export type BodyShape = { m: MuscleId | null; d: string };

/** Silhouette, moitié gauche : déborde de 0,6 sur l'axe pour que les deux moitiés se recouvrent sans liseré. */
export const BODY_OUTLINE =
  "M100.6 16.4 C92.8 16.4 86.95 22.25 86.5 31.7 C86.14 38.9 87.4 46.1 90.55 51.05 C91.45 52.4 91.9 53.75 91.9 56 L91 62 " +
  "C85 66 76 69 68 71.5 C60 72.6 52.4 75.6 50 82.4 C48 88.6 48.4 97 51.2 104 " + // trapèze, épaule
  "C49.8 116 48 130 46.5 146 C44 154 42 164 40.5 174 C39.5 181 39 186 39 190 " + // bras, avant-bras
  "C38 195 38 200 38.8 204.5 C39.6 208.8 41.8 211.5 44.4 211.6 C47 211.6 48.6 209 49 205 C49.4 200.5 49.8 195.5 50.5 192 " + // main
  "C52.5 180 56 168 59 158 C60 154 60.5 150 60.5 147 C62 136 64.5 120 66.5 108 C67.4 104 68 101 68.6 98.5 " + // retour par l'intérieur du bras
  "C69 107 70.2 117 72.6 127.5 C75 137.5 76.6 147 76.2 155 C75.5 162 73.6 168 71.6 174 " + // flanc, taille, hanche
  "C69 182 67.8 192 68 202 C68.4 218 71.4 236 76 252 C77 258 77.5 263 76.5 268 " + // cuisse, genou
  "C73.5 276 72 286 72.5 295 C73 308 77 322 80 336 C80.5 340 79.5 344 78 348 C76 352 76.5 356.5 80 357 L92 357 " + // jambe, pied
  "C95 356.5 95.5 352 94.5 347 C93.5 343 93 339 93 335 C94 322 96.5 306 97.5 292 C98 282 97 272 95 265 " +
  "C94.5 261 94.5 258 95.5 254 C97.5 240 98.5 220 98.8 200 C99 195 99.5 191 100.6 189 Z";

const FOREARM_OUT = "M46.8 150 C44.5 156.5 43 164 42.4 172 C42 178 42 183.5 42.3 187.5 C44 182.5 46 175 48.2 167 C49.8 161 51 155.5 51.4 150.5 Z";
const FOREARM_IN = "M53.4 150.5 C52.6 157.5 50.8 165.5 48.8 173 C47 179.5 45.5 185 45 189 L49.6 189.5 C51.2 181 53.8 171 56.8 162 C58 158 59 154 59.2 150.5 Z";

export const FRONT_SHAPES: BodyShape[] = [
  { m: "neck", d: "M92.2 54.6 C94 60 96 65.5 99 70 C99.3 67.5 98.5 64.5 97.2 61.5 C96 58.5 95.3 56 95 53.5 Z" }, // sterno-cléido-mastoïdien
  { m: "traps", d: "M92 57 C92.6 61 93.4 65 94.6 69 C87 70.6 79 71.6 71 72.6 C77.5 70.2 84.5 67.5 91.2 63.6 Z" },
  { m: "chest", d: "M99 77 C93 75.8 85 75.5 78.5 76.5 C75 81 72.5 88 71.5 96 C72.5 102.5 75.5 107.5 80 110 C86.5 113 93.5 113 99 111.5 Z" },
  { m: "front_delts", d: "M78 75 C73.8 73.6 68.8 73.8 66.2 74.8 C63.6 85 62.8 97 63.2 108 C66 104.4 69 99.8 71 95.4 C72.2 88 74.4 80.6 78 75 Z" },
  { m: "side_delts", d: "M65.2 74.6 C58.8 74.8 52.6 77.8 50.6 84.4 C49.2 90 49.8 97.4 52.6 103.6 C55 107.4 58.6 109.4 62 110 C61 98.5 61.8 86 65.2 74.6 Z" },
  { m: "biceps", d: "M64.5 110 C60.5 112 57 116 55.3 123 C53.8 131 54.2 139 56.5 145 C58.3 146.6 60 146 60.6 144 C62 135 63.2 124 64.6 113 Z" },
  { m: "triceps", d: "M53.5 107.5 C51.5 117 49.8 129 48.8 141 C50 144.5 52 145.5 54 144 C53 136 53.2 125 55 115 C55.6 111.5 55 109 53.5 107.5 Z" }, // vaste latéral, vu de face
  { m: "forearms", d: FOREARM_OUT },
  { m: "forearms", d: FOREARM_IN },
  { m: "lats", d: "M70 102 C70.2 109.5 71 118 72.6 126.5 C73.8 121 75 115 76.2 110.2 C74.4 106.4 72.4 104 70 102 Z" },
  { m: "obliques", d: "M86.6 114.5 C82.5 114.2 79.6 112.8 77.2 111 C75.8 120 76.6 132 77.6 143 C78.2 151 77 160 75 167 C79.5 171 84.5 174.5 89.5 178 C87.6 165 86.6 150 86.4 135 C86.3 127 86.4 120 86.6 114.5 Z" },
  { m: "glute_med", d: "M76 170.6 C74 173 72.2 176.4 71 180 C70.6 181.6 70.6 182.6 71 183 C73.6 182.6 76.4 181 78.4 178.8 C78.8 176 77.8 173 76 170.6 Z" },
  { m: "abs", d: "M98.8 114 L98.8 127 C95.2 127.6 91.8 127.4 89.2 126.4 C88.5 122.5 88.5 118 89.2 115.2 C92.4 113.8 95.8 113.5 98.8 114 Z" },
  { m: "abs", d: "M98.8 129.5 L98.8 143 C95 143.5 91.5 143.3 88.8 142.4 C88.1 138 88.1 133.5 88.8 130.4 C92.2 129.4 95.6 129.2 98.8 129.5 Z" },
  { m: "abs", d: "M98.8 145.5 L98.8 160 C95 160.5 91.4 160.2 88.7 159.2 C88 154.5 88 150 88.7 146.4 C92.1 145.4 95.5 145.2 98.8 145.5 Z" },
  { m: "abs", d: "M98.8 162.5 L98.8 184 C96.2 182.5 93.4 178 91.2 172.5 C89.8 169 89 165.5 88.9 163.3 C92.2 162.4 95.6 162.2 98.8 162.5 Z" },
  { m: "quads", d: "M72 184 C69.6 196 69.6 212 71.4 227 C73 239 75.4 248 78.2 253.5 C79.6 246 79.8 235 79.4 223 C79.2 209 78.4 195 75.2 185.4 Z" }, // vaste latéral
  { m: "quads", d: "M79.4 180.5 C78.8 195 80.4 213 82.8 231 C84 240 85.2 247 86.2 251.5 C88.4 244.5 89.4 233.5 89.4 220.5 C89.2 205 85.6 191 79.4 180.5 Z" }, // droit fémoral
  { m: "quads", d: "M90.8 223 C89.4 232 89 241.5 90.4 249.5 C92.2 254 95 254.6 96 251 C96.9 244 96.6 236 95.2 229 C94.2 225.2 92.7 223.2 90.8 223 Z" }, // vaste médial
  { m: "adductors", d: "M98.6 193 C94.5 193.5 90.8 195.5 88.4 199 C89.8 207.5 91.5 214.5 93.6 221.5 C95.6 214 97.6 205 98.6 197 Z" },
  { m: "calves", d: "M94.6 267 C96.4 275 97 285 96.2 295 C95.4 303 93.8 309 92 312 C90.2 302 89.8 290 90.2 280.5 C90.6 274 92.2 269 94.6 267 Z" }, // jumeau interne
  { m: "calves", d: "M77.6 269 C74.8 277 73.6 287 74.4 297 C75.2 303.5 76.6 307.5 78 309.5 C79 298 79.6 286.5 79.4 276 C79.3 273 78.6 270.5 77.6 269 Z" }, // jumeau externe
  { m: null, d: "M81.3 268.5 C81 283 82.2 299 84.5 316 C85.4 323 86 329 86.4 334 C87.6 323 88.2 311 88.2 299 C88.2 285 87.2 274 85.6 267 Z" }, // tibial antérieur
];

export const BACK_SHAPES: BodyShape[] = [
  { m: "neck", d: "M99 51.5 C96.2 51.6 93.6 52.6 92 54.2 C92.3 56.8 92.9 59.6 93.6 61.6 C95.4 60.4 97.2 59.8 99 59.6 Z" },
  { m: "traps", d: "M99 61.5 C96.6 62 94.2 63.2 92 64.6 C86 68 78.5 70.4 70.8 72.4 C69.4 74.2 69 76.2 69.6 78.2 C75.4 81 81.2 84.6 86.4 88.6 C89.2 98.5 92.6 110 95.6 122 C97 128 98.1 134 99 140 Z" },
  { m: "rear_delts", d: "M70.6 79.2 C67.6 77.8 64.6 77.2 62.8 77.4 C61.4 88 61.6 99 62.8 108.6 C65.6 104.6 68.2 99.6 69.8 94.6 C70.8 89.6 71.1 84.4 70.6 79.2 Z" },
  { m: "side_delts", d: "M61.6 77 C57.6 77.2 52.8 79.6 50.8 85 C49.2 90.6 49.8 98 52.6 103.8 C55 107.4 58 109 60.8 109.6 C59.8 98.8 59.8 87.6 61.6 77 Z" },
  { m: "upper_back", d: "M84.6 90.6 C80.2 88 75.8 85.2 71.8 82.6 C72 89 71.8 95.2 70.6 100.8 C74.4 106.6 78.6 110.6 83.4 113 C86 110.5 88.2 107.2 89.4 103.6 C88.4 98.8 86.8 94.4 84.6 90.6 Z" }, // sous-épineux, grand rond
  { m: "triceps", d: "M53.8 108.6 C51.8 116.6 50.4 126 50 134.4 C52.6 132.4 55.2 128.4 57 122.8 C58.4 118 59.2 113.6 59.4 110.6 C57.6 109.2 55.8 108.6 53.8 108.6 Z" }, // vaste latéral
  { m: "triceps", d: "M60.4 111 C58.6 118.6 56.2 126.6 53.6 132.8 C51.8 137 50.4 140.8 49.6 144.6 C52.6 146.6 56.6 147 60 146 C62.2 137.6 63.6 127.6 64.2 117.6 C64.6 114 64 110.6 62.8 108.2 Z" }, // long chef
  { m: "forearms", d: FOREARM_OUT },
  { m: "forearms", d: FOREARM_IN },
  { m: "lats", d: "M70 102.8 C74.4 108.6 78.8 112.4 83.8 115.4 C87.8 117.8 91.6 121.4 93.8 126.2 C95.4 131 96.2 136.2 96.6 141.6 C92.4 145.2 88.4 149 84.6 153.4 C81.8 156.4 79.6 159.2 77.8 162 C77.4 151.5 75.8 140.5 73.6 130 C71.8 121 70.6 111.6 70 102.8 Z" },
  { m: "lower_back", d: "M98.8 147 C95 148 91.8 150 89.6 152.6 C88.6 160.5 89 169.5 91 177.5 C93.4 179.6 96.2 180.6 98.8 180.8 Z" },
  { m: "obliques", d: "M78.4 165 C80.8 160.6 84 157.4 87.6 155.4 C87 162.4 87.5 169 88.8 174.6 C84.4 173.2 79.4 172.8 74.6 173.4 C75.8 170.6 77 167.8 78.4 165 Z" },
  { m: "glute_med", d: "M88.8 178 C83.6 176 78.2 175.6 73.4 176.8 C71.8 181 71 185.6 71.2 190 C76.4 186.4 82.2 183.6 88.8 181.6 Z" }, // moyen fessier
  { m: "glutes", d: "M98.8 184 C92.6 182.4 85.6 183.4 79.4 186.8 C73.6 190 70 195.4 69.8 201.6 C69.8 208.6 73.2 214 79 216.4 C85 218.8 92.2 218.4 97.4 215.6 C98.4 212 98.8 208 98.8 204 Z" }, // grand fessier
  { m: "hamstrings", d: "M76 219.6 C73.2 227.4 72.8 237 74.2 245.6 C75.2 250.6 77.2 254 79.8 256 C81.2 247.6 82 236.6 82 226.4 C82 223 81.6 220.4 80.6 218.8 Z" }, // biceps fémoral
  { m: "hamstrings", d: "M84.2 219 C84 229 84.6 240.6 86 251 C87.4 255.8 89.8 257.6 91.8 255.6 C93.4 247 94 236 93.6 226 C93.2 221.6 92.2 218.8 90.6 217.4 Z" }, // semi-tendineux
  { m: "adductors", d: "M95.4 219.6 C96.4 226.6 96.6 233.4 96.2 240.2 C97.4 234.4 98.2 227.8 98.6 220.4 Z" },
  { m: "calves", d: "M80.4 263.6 C76.6 270 74.2 279.6 74.6 289.4 C75 296.6 77.2 301.6 80.2 303.8 C82.2 296.6 83.6 285.8 84 275.8 C84.2 270.8 83.2 266.6 80.4 263.6 Z" }, // jumeau externe
  { m: "calves", d: "M87.8 262.8 C91.8 265.8 95 273 95.8 283 C96.4 292 94.8 300 91.6 306 C89.2 301.8 87.4 294 86.8 285 C86.4 276 86.4 268.2 87.8 262.8 Z" }, // jumeau interne
  { m: "calves", d: "M76.6 301 C76.4 311 78.2 321.6 80.6 330 C81.6 324.6 82.4 318.4 82.4 312.4 C80.8 308.4 78.8 304.6 76.6 301 Z" }, // soléaire
  { m: "calves", d: "M94.4 304 C94.8 314 93.6 323.6 92 331 C90.6 325.6 90 319 90.4 313 C91.8 309.6 93.2 306.6 94.4 304 Z" },
];

/** Corps entier [x, y, largeur, hauteur]. */
export const FULL_FRAME = [30, 12, 140, 348] as const;

/** Hauteur du centre de chaque muscle sur le dessin : la vignette se cadre sur la moyenne pondérée des muscles sollicités. */
const MUSCLE_Y: Record<MuscleId, number> = {
  neck: 62, glute_med: 182, traps: 82, front_delts: 90, side_delts: 92, rear_delts: 92, chest: 94, upper_back: 100, lats: 125, triceps: 126,
  biceps: 128, obliques: 145, abs: 148, lower_back: 164, forearms: 170, glutes: 198, adductors: 210, quads: 220, hamstrings: 237, calves: 292,
};
const THUMB = 124;
/** Cadre carré de la vignette : de la tête aux hanches pour le haut du corps, glissé vers le bas jusqu'aux pieds pour les jambes. */
export function thumbFrame(levels: Partial<Record<MuscleId, number>>): [number, number, number, number] {
  let sum = 0, at = 0;
  for (const [id, v] of Object.entries(levels) as [MuscleId, number][]) if (v > 0) { sum += v; at += v * MUSCLE_Y[id]; }
  const cy = Math.min(299, Math.max(120, sum ? at / sum : 120));
  return [100 - THUMB / 2, Math.round(cy - THUMB / 2), THUMB, THUMB];
}

/** Classe de remplissage d'un palier (tokens muscle-1 à muscle-4, littéraux pour Tailwind). */
export const STEP_FILL = { 1: "fill-muscle-1", 2: "fill-muscle-2", 3: "fill-muscle-3", 4: "fill-muscle-4" } as const;
/** Fond d'un palier (barres, légendes). */
export const STEP_BG = { 1: "bg-muscle-1", 2: "bg-muscle-2", 3: "bg-muscle-3", 4: "bg-muscle-4" } as const;
