/** Noms d'exercices (texte libre) : clé de comparaison, suggestions, double progression. Sans dépendance : utilisé aussi par tools/. */

export type SetDetail = { reps: number; loadKg: number | null; done: boolean };
/** Une occurrence passée d'un exercice : le prévu (sets/reps/loadKg) et, si saisi, le réel série par série. */
export type Past = { date: string; sets: number; reps: number; loadKg: number | null; restS: number | null; setsDetail: SetDetail[] | null };
/** Historique d'un exercice, séances de la plus récente à la plus ancienne. */
export type ExerciseHistory = { key: string; name: string; count: number; sessions: Past[] };

/** « Pompes » = « pompe » = « POMPE » : sans accents ni majuscules, mots au singulier (s/x final retiré). */
export function exerciseKey(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ").map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w)).join(" ");
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}

/** Exercices existants proches de ce qui est tapé : exact, puis début, puis contenu, puis faute de frappe ; à égalité, le plus fréquent. */
export function suggestExercises(typed: string, all: ExerciseHistory[], max = 6): ExerciseHistory[] {
  const q = exerciseKey(typed);
  if (!q) return [...all].sort((a, b) => b.count - a.count).slice(0, max);
  const rank = (h: ExerciseHistory) => {
    if (h.key === q) return 0;
    if (h.key.startsWith(q)) return 1;
    if (h.key.includes(q)) return 2;
    const tol = q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
    return tol && (distance(q, h.key) <= tol || distance(q, h.key.slice(0, q.length)) <= tol) ? 3 : -1;
  };
  return all.map((h) => ({ h, r: rank(h) })).filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || b.h.count - a.h.count).slice(0, max).map((x) => x.h);
}
export function daysAgo(iso: string, now = new Date()): string {
  const n = Math.max(0, Math.floor((+now - +new Date(iso)) / 864e5));
  return n === 0 ? "aujourd’hui" : n === 1 ? "hier" : `il y a ${n} j`;
}

/** Regroupe des lignes brutes (plus récentes d'abord) par clé de nom ; le nom affiché est l'orthographe la plus fréquente. */
export function groupHistory(rows: { name: string; date: string; sets: number; reps: number; loadKg: number | null; restS: number | null; setsDetail: SetDetail[] | null }[], keep = 4): ExerciseHistory[] {
  const by = new Map<string, { spell: Map<string, number>; h: ExerciseHistory }>();
  for (const r of rows) {
    const key = exerciseKey(r.name);
    if (!key) continue;
    let g = by.get(key);
    if (!g) by.set(key, g = { spell: new Map(), h: { key, name: r.name.trim(), count: 0, sessions: [] } });
    g.h.count++;
    g.spell.set(r.name.trim(), (g.spell.get(r.name.trim()) ?? 0) + 1);
    if (g.h.sessions.length < keep) g.h.sessions.push({ date: r.date, sets: r.sets, reps: r.reps, loadKg: r.loadKg, restS: r.restS, setsDetail: r.setsDetail });
  }
  return [...by.values()].map(({ spell, h }) => ({ ...h, name: [...spell.entries()].sort((a, b) => b[1] - a[1])[0][0] })).sort((a, b) => b.count - a.count);
}
