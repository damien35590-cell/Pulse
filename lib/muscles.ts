export const GROUPS = ["pectoraux", "dorsaux", "épaules", "biceps", "triceps", "abdominaux", "quadriceps", "ischio-jambiers", "mollets"] as const;
export type Group = (typeof GROUPS)[number];
export type MuscleLoad = { tonnage: number; sets: number };
/** Groupes du haut du corps ; les autres (jambes, abdominaux) forment « bas + abdos », comme l'alternance Lafay du coach. */
export const UPPER_GROUPS: ReadonlySet<Group> = new Set<Group>(["pectoraux", "dorsaux", "épaules", "biceps", "triceps"]);

/** Premier motif qui correspond gagne : (muscle, part de la charge). Le nom d'exercice est du texte libre, d'où ce dictionnaire. */
const RULES: [RegExp, [Group, number][]][] = [
  [/(souleve de terre roumain|romanian|good morning|leg curl|ischio|hip thrust|pont fessier|jambes tendues|glute.?ham)/, [["ischio-jambiers", 1], ["dorsaux", 0.2]]],
  [/(souleve de terre|deadlift|\bsdt\b)/, [["ischio-jambiers", 0.8], ["dorsaux", 0.8], ["quadriceps", 0.4]]],
  [/(squat|presse|leg press|fente|lunge|leg extension|extension jambe|quadri|hack|step.?up)/, [["quadriceps", 1], ["ischio-jambiers", 0.4]]],
  [/(mollet|calf|talon)/, [["mollets", 1]]],
  [/(traction|pull.?up|chin.?up|tirage|rowing|\brow\b|dorsal|pull.?over|lombaire)/, [["dorsaux", 1], ["biceps", 0.5]]],
  [/(developpe militaire|overhead|shoulder press|arnold|elevation|oiseau|epaule|rear delt|face pull|shrug|haussement)/, [["épaules", 1], ["triceps", 0.3]]],
  [/(triceps|barre au front|skull|kickback|extension (nuque|triceps|verticale|couche)|dips? (arriere|banc)|bench dips?)/, [["triceps", 1]]],
  [/(curl|biceps)/, [["biceps", 1]]],
  [/\bbras\b/, [["biceps", 0.5], ["triceps", 0.5]]],
  [/(pompe|push.?up|dips?|developpe|\bdc\b|bench|ecarte|\bfly\b|\bpec)/, [["pectoraux", 1], ["épaules", 0.4], ["triceps", 0.4]]],
  [/(abdo|crunch|gainage|planche|plank|releve de jambes|leg raise|sit.?up|frog kick|roulette|ab wheel|oblique|russian twist|hollow|mountain climber)/, [["abdominaux", 1]]],
];
const flat = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Méthode Lafay : on saisit souvent le code seul (« A1 », « F », « B2 - dips »). La lettre donne l'exercice de base, le chiffre sa variante. */
const LAFAY: Record<string, [Group, number][]> = {
  a: [["pectoraux", 1], ["épaules", 0.4], ["triceps", 0.4]], // pompes
  b: [["pectoraux", 1], ["triceps", 0.6], ["épaules", 0.4]], // dips
  c: [["dorsaux", 1], ["biceps", 0.5]], // tractions
  d: [["triceps", 1]], // dips arrière
  e: [["quadriceps", 1], ["ischio-jambiers", 0.4]], // flexions : cuisses, fessiers (comptés sur les ischios)
  f: [["quadriceps", 1], ["mollets", 0.6]], // flexions : cuisses, mollets
  g: [["abdominaux", 1]], // abdominaux
  h: [["abdominaux", 1]], // abdominaux
  i: [["dorsaux", 1]], // tractions (dos)
  j: [["épaules", 1], ["pectoraux", 0.4], ["triceps", 0.4]], // pompes piquées
  k: [["triceps", 1]], // triceps
  l: [["pectoraux", 1], ["épaules", 0.4], ["triceps", 0.4]], // pompes en rotation
  m: [["dorsaux", 0.6], ["ischio-jambiers", 0.4]], // lombaires
  n: [["abdominaux", 1]], // obliques
  o: [["abdominaux", 1]], // crunch rotation
  p: [["abdominaux", 1]], // relevé de buste
  q: [["épaules", 1], ["triceps", 0.6], ["pectoraux", 0.6]], // pompes à un bras
  r: [["épaules", 0.5]], // abaissement des épaules (trapèzes)
  s: [], // nuque
  t: [["abdominaux", 0.6]], // rotations assis
  u: [["abdominaux", 0.6]], // enroulement
  v: [["abdominaux", 0.6]], // essuie-glace
  w: [["mollets", 1]], // mollets
  x: [["abdominaux", 0.4]], // rotations debout
  y: [], // cou
  z: [["dorsaux", 0.3], ["épaules", 0.3]], // pont
};
// Lettre + chiffres (« a1 », « b2 dips ») ou lettre seule / suivie d'un séparateur (« f », « c - tractions ») ; « a la barre » n'en est pas un
const LAFAY_CODE = /^([a-i])(?:(\d{1,2})(?=$|[\s\-–:.])|(?=$|\s*[-–:.]))/;
// Lettres J à Z (catalogue complet) : plus strict, pour ne pas confondre « L-sit », « T-bar », « V-ups » avec un code.
// Lettre + chiffres suivis d'un espace ou de la fin (« k2 », « w - mollets » n'a pas de chiffres), lettre seule, ou « l - … » avec espaces.
const LAFAY_CODE_EXT = /^([j-z])(?:(\d{1,2})(?=$|\s)|(?=$|\s+[-–]\s))/;
/** Code Lafay d'un nom d'exercice : « B2 - dips » → { letter: "b", digits: 2 } ; null si le nom n'est pas un code. */
export const lafayCode = (name: string) => {
  const n = flat(name).trim();
  const m = LAFAY_CODE.exec(n) ?? LAFAY_CODE_EXT.exec(n);
  return m ? { letter: m[1], digits: m[2] ? Number(m[2]) : null } : null;
};
export const musclesOf = (name: string) => {
  const code = lafayCode(name);
  return code ? LAFAY[code.letter] : RULES.find(([re]) => re.test(flat(name).trim()))?.[1] ?? [];
};

type Ex = { name: string; sets: number; reps: number; loadKg: number | null };
/** Tonnage réparti par groupe musculaire. Sans charge (poids de corps), on compte 60 % du poids du corps (70 kg par défaut). */
export function volumeByMuscle(exercises: Ex[], bodyKg = 70): Record<Group, MuscleLoad> {
  const out = Object.fromEntries(GROUPS.map((g) => [g, { tonnage: 0, sets: 0 }])) as Record<Group, MuscleLoad>;
  for (const e of exercises) {
    const load = e.loadKg ?? bodyKg * 0.6;
    for (const [g, w] of musclesOf(e.name)) { out[g].tonnage += e.sets * e.reps * load * w; out[g].sets += e.sets * w; }
  }
  return out;
}

/** Pêche (peu sollicité) → orange de la marque → rouge profond (très sollicité). Le repos (0) est géré par la carte, en couleur neutre du thème. */
const HEAT = [[255, 200, 160], [242, 74, 0], [178, 18, 0]];
export function heatColor(r: number): string {
  const t = Math.max(0, Math.min(1, r)) * 2, i = Math.min(1, Math.floor(t)), f = t - i, [a, b] = [HEAT[i], HEAT[i + 1]];
  return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * f)).join(",")})`;
}
