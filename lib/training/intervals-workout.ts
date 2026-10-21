/**
 * Séance de course Pulse → séance « texte » Intervals.icu (calendrier WORKOUT), exportée ensuite vers Garmin Connect.
 * Fonctions pures, sans accès base ni réseau.
 *
 * Source : la RunWorkoutStructure (intensités relatives + VMA du moment), pas le résumé affiché : même donnée que le résumé,
 * sans risque d'erreur de lecture. Si la structure est absente ou inexprimable, on retombe sur le texte brut (Garmin n'aura que le nom).
 *
 * Syntaxe Intervals.icu (forum « Workout Builder Syntax Quick Guide ») :
 *  - un pas = une ligne « - [texte] <durée> <cible> » ;
 *  - durée : « 20m » = 20 MINUTES, « 1m15 », « 45s » ; distance : « 400mtr », « 2km » (« m » seul n'est JAMAIS des mètres) ;
 *  - allure absolue : « 4:05/km Pace » ou fourchette « 5:31/km-6:22/km Pace » ; zone cardio : « Z2 HR » ;
 *  - répétitions : ligne « 8x » avant les pas, blocs séparés par une ligne vide, pas de répétition imbriquée ;
 *  - en-têtes « Warmup » / « Cooldown » (lignes sans tiret).
 */
import type { Intensity, RunStep, RunWorkoutStructure, StepDuration, StepRole } from "@/types/training";
import { estimateRun, paceSPerKm, summarizeRun } from "./resolve";

type Step = Extract<RunStep, { kind: "step" }>;

const ROLE_LABEL: Record<StepRole, string> = { warmup: "Échauffement", active: "Effort", recovery: "Récup", cooldown: "Retour au calme", rest: "Repos" };

/** 75 → « 1m15 », 20 min → « 20m », 45 → « 45s ». */
export function fmtTime(totalS: number) {
  const s = Math.max(1, Math.round(totalS)), m = Math.floor(s / 60), r = s % 60;
  return m === 0 ? `${r}s` : r === 0 ? `${m}m` : `${m}m${String(r).padStart(2, "0")}`;
}

/** 400 → « 400mtr », 2000 → « 2km », 1500 → « 1.5km ». Null pour « jusqu'au tour » (pas d'équivalent texte). */
export function fmtDuration(d: StepDuration): string | null {
  if (d.type === "time") return d.s > 0 ? fmtTime(d.s) : null;
  if (d.type === "distance") return d.m <= 0 ? null : d.m >= 1000 && d.m % 100 === 0 ? `${d.m / 1000}km` : `${Math.round(d.m)}mtr`;
  return null;
}

const pace = (s: number) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}/km`; };

/** Cible Intervals d'une intensité ; "" si elle n'a pas d'équivalent absolu (allure objectif, ressenti) : le pas n'a alors que sa durée. */
function target(t: Intensity | undefined, vma: number): string {
  if (!t) return "";
  if (t.ref === "VMA") {
    const fast = pace(paceSPerKm(vma, t.pctMax)), slow = pace(paceSPerKm(vma, t.pctMin));
    return fast === slow ? `${fast} Pace` : `${fast}-${slow} Pace`;
  }
  if (t.ref === "PACE") {
    const fast = pace(t.sPerKmMin), slow = pace(t.sPerKmMax);
    return fast === slow ? `${fast} Pace` : `${fast}-${slow} Pace`;
  }
  if (t.ref === "HR_ZONE") return `Z${t.zone} HR`;
  return "";
}

/** Texte libre avant la durée = nom du pas sur la montre. On ne garde que des lettres : pas de chiffre ni de « m » qui seraient lus comme une durée. */
const cue = (st: Step) => (st.label && /^[\p{L} ]{1,24}$/u.test(st.label) ? st.label : ROLE_LABEL[st.role]);

function line(st: Step, vma: number): string | null {
  const d = fmtDuration(st.duration);
  if (!d) return null;
  return ["-", cue(st), d, target(st.target, vma)].filter(Boolean).join(" ");
}

/**
 * Structure → texte Intervals, ou null si inexprimable (pas « tour », répétition imbriquée, séance vide).
 * Exemple : « Warmup\n- Échauffement 20m 5:31/km-6:22/km Pace\n\n8x\n- Effort 400mtr 4:05/km Pace\n- Récup 1m15 …\n\nCooldown\n- … ».
 */
export function structureToIntervals(s: RunWorkoutStructure, vmaKmh: number): string | null {
  if (!s.steps.length || !(vmaKmh > 0)) return null;
  const blocks: { header?: string; lines: string[] }[] = [];
  let open: { key: string; lines: string[]; header?: string } | null = null;
  for (const st of s.steps) {
    if (st.kind === "repeat") {
      if (!st.steps.length || st.steps.some((x) => x.kind === "repeat")) return null;
      const lines: string[] = [];
      for (const x of st.steps) { const l = line(x as Step, vmaKmh); if (!l) return null; lines.push(l); }
      open = null;
      // Une seule répétition : on n'écrit pas « 1x ».
      blocks.push(st.times > 1 ? { header: `${st.times}x`, lines } : { lines });
      continue;
    }
    const l = line(st, vmaKmh);
    if (!l) return null;
    const key = st.role === "warmup" ? "warmup" : st.role === "cooldown" ? "cooldown" : "main";
    if (open && open.key === key) { open.lines.push(l); continue; }
    open = { key, lines: [l], header: key === "warmup" ? "Warmup" : key === "cooldown" ? "Cooldown" : undefined };
    blocks.push(open);
  }
  return blocks.map((b) => [b.header, ...b.lines].filter(Boolean).join("\n")).join("\n\n");
}

export type PlannedForIntervals = {
  id: string; date: string; // YYYY-MM-DD, jour local
  title: string; description: string | null; structure: RunWorkoutStructure | null; plannedDurationS: number | null;
};

/** Événement de l'API Intervals.icu (POST /athlete/{id}/events/bulk). */
export type IntervalsEvent = {
  category: "WORKOUT"; start_date_local: string; type: "Run"; name: string; description: string; moving_time?: number; external_id: string;
};

export const externalId = (sessionId: string) => `pulse-${sessionId}`;
export const sessionIdOf = (external: string | null | undefined) => (external?.startsWith("pulse-") ? external.slice(6) : null);

/** Description : texte structuré si possible ; sinon résumé brut (ou description, ou titre) : l'événement existe, la montre n'aura que le nom. */
export function intervalsDescription(p: Pick<PlannedForIntervals, "title" | "description" | "structure">, vmaKmh: number) {
  const text = p.structure ? structureToIntervals(p.structure, vmaKmh) : null;
  if (text) return { text, structured: true };
  const raw = (p.structure ? summarizeRun(p.structure, vmaKmh) : "") || p.description || p.title;
  return { text: raw, structured: false };
}

export function toIntervalsEvent(p: PlannedForIntervals, vmaKmh: number): IntervalsEvent {
  const seconds = p.structure ? estimateRun(p.structure, vmaKmh).durationS : 0;
  const moving = seconds > 0 ? seconds : p.plannedDurationS ?? 0;
  return {
    category: "WORKOUT",
    start_date_local: `${p.date}T00:00:00`,
    type: "Run",
    name: p.title,
    description: intervalsDescription(p, vmaKmh).text,
    ...(moving > 0 && { moving_time: Math.round(moving) }),
    external_id: externalId(p.id),
  };
}
