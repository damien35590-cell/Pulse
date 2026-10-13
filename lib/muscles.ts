export const GROUPS = ["pectoraux", "dorsaux", "épaules", "bras", "quadriceps", "ischio-jambiers", "mollets"] as const;
export type Group = (typeof GROUPS)[number];
export type MuscleLoad = { tonnage: number; sets: number };

/** Premier motif qui correspond gagne : (muscle, part de la charge). Le nom d'exercice est du texte libre, d'où ce dictionnaire. */
const RULES: [RegExp, [Group, number][]][] = [
  [/(souleve de terre roumain|romanian|good morning|leg curl|ischio|hip thrust|pont fessier)/, [["ischio-jambiers", 1], ["dorsaux", 0.2]]],
  [/(souleve de terre|deadlift)/, [["ischio-jambiers", 0.8], ["dorsaux", 0.8], ["quadriceps", 0.4]]],
  [/(squat|presse|leg press|fente|lunge|leg extension|extension jambe|quadri|hack|step.?up)/, [["quadriceps", 1], ["ischio-jambiers", 0.4]]],
  [/(mollet|calf|talon)/, [["mollets", 1]]],
  [/(traction|pull.?up|chin.?up|tirage|rowing|\brow\b|dorsal|pull.?over)/, [["dorsaux", 1], ["bras", 0.5]]],
  [/(developpe militaire|overhead|shoulder press|arnold|elevation|oiseau|epaule|rear delt|face pull)/, [["épaules", 1], ["bras", 0.3]]],
  [/(curl|biceps|triceps|barre au front|skull|kickback|\bbras\b)/, [["bras", 1]]],
  [/(pompe|push.?up|dips?|developpe|bench|ecarte|\bfly\b|\bpec)/, [["pectoraux", 1], ["épaules", 0.4], ["bras", 0.4]]],
];
const flat = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const musclesOf = (name: string) => RULES.find(([re]) => re.test(flat(name)))?.[1] ?? [];

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

/** Gris sombre (0) vers rouge vif (1). */
export function heatColor(r: number): string {
  const t = Math.max(0, Math.min(1, r)), a = [58, 58, 66], b = [255, 45, 22];
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",")})`;
}
