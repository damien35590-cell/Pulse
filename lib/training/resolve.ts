/**
 * Traduit une RunWorkoutStructure (intensités relatives) en allures réelles à partir de la VMA du moment.
 * Fonctions pures, sans accès base : allure (s/km) = 3600 / (VMA × %).
 */
import type { Intensity, ResolvedRunStep, RunStep, RunWorkoutStructure, StepDuration } from "@/types/training";

/** Allure en s/km pour un pourcentage de VMA (km/h). */
export const paceSPerKm = (vmaKmh: number, pct: number) => 3600 / (vmaKmh * (pct / 100));

/** 240 → « 4:00 ». */
export const fmtPaceS = (s: number) => {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
};

/** Durée d'étape : « 20′ », « 30″ », « 1′15 ». */
export const fmtStepTime = (s: number) => {
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return m === 0 ? `${r}″` : r === 0 ? `${m}′` : `${m}′${String(r).padStart(2, "0")}`;
};

const fmtDuration = (d: StepDuration) => (d.type === "time" ? fmtStepTime(d.s) : d.type === "distance" ? (d.m >= 1000 ? `${(d.m / 1000).toLocaleString("fr-FR")} km` : `${d.m} m`) : "1 tour");

const vmaRange = (t?: Intensity) => (t?.ref === "VMA" ? t : null);
/** Fourchette d'allure : le % le plus haut donne l'allure la plus rapide (min). */
const paceRange = (t: Intensity | undefined, vma: number) => {
  const r = vmaRange(t);
  return r ? { min: paceSPerKm(vma, r.pctMax), max: paceSPerKm(vma, r.pctMin) } : undefined;
};
const midPct = (t?: Intensity) => { const r = vmaRange(t); return r ? (r.pctMin + r.pctMax) / 2 : null; };
/** Au-delà de 80 % de VMA, on parle d'allure cible ; en dessous, d'endurance fondamentale. */
const isHard = (t?: Intensity) => (vmaRange(t)?.pctMax ?? 0) > 80;

/** Étapes à plat, répétitions déroulées, avec les allures réelles. */
export function resolveSteps(s: RunWorkoutStructure, vmaKmh: number): ResolvedRunStep[] {
  const out: ResolvedRunStep[] = [];
  const walk = (steps: RunStep[], repeat?: ResolvedRunStep["repeat"]) => {
    for (const st of steps) {
      if (st.kind === "repeat") { for (let i = 1; i <= st.times; i++) walk(st.steps, { current: i, total: st.times }); continue; }
      out.push({
        role: st.role, duration: st.duration, ...(st.label && { label: st.label }), ...(repeat && { repeat }),
        ...(st.target?.ref === "VMA" && { paceSPerKm: paceRange(st.target, vmaKmh) }),
        ...(st.target?.ref === "PACE" && { paceSPerKm: { min: st.target.sPerKmMin, max: st.target.sPerKmMax } }),
        ...(st.target?.ref === "RPE" && { rpe: st.target.value }),
      });
    }
  };
  walk(s.steps);
  return out;
}

/** Durée (s) et distance (m) estimées : les étapes en distance sont converties avec l'allure médiane. */
export function estimateRun(s: RunWorkoutStructure, vmaKmh: number) {
  let durationS = 0, distanceM = 0;
  const walk = (steps: RunStep[], n: number) => {
    for (const st of steps) {
      if (st.kind === "repeat") { walk(st.steps, n * st.times); continue; }
      const pct = midPct(st.target), speed = pct ? (vmaKmh * pct) / 100 / 3.6 : null; // m/s
      if (st.duration.type === "time") { durationS += n * st.duration.s; if (speed) distanceM += n * st.duration.s * speed; }
      else if (st.duration.type === "distance") { distanceM += n * st.duration.m; if (speed) durationS += n * (st.duration.m / speed); }
    }
  };
  walk(s.steps, 1);
  return { durationS: Math.round(durationS), distanceM: Math.round(distanceM) };
}

/** Une étape isolée : « 20′ EF », « 6′ à fond (≈ 4:08 /km) », « 40′ EF à 5:31–6:22 /km ». */
function stepText(st: Extract<RunStep, { kind: "step" }>, vma: number, alone: boolean) {
  const d = fmtDuration(st.duration), mid = midPct(st.target);
  if (st.role === "warmup") return `${d} EF`;
  if (st.role === "cooldown") return `${d} RAC`;
  if (st.label && mid) return `${d} ${st.label} (≈ ${fmtPaceS(paceSPerKm(vma, mid))} /km)`;
  if (isHard(st.target) && mid) return `${d} à ${fmtPaceS(paceSPerKm(vma, mid))} /km`;
  const r = paceRange(st.target, vma);
  return alone && r ? `${d} EF à ${fmtPaceS(r.min)}–${fmtPaceS(r.max)} /km` : `${d} EF`;
}

/** Résumé court : « 20′ EF · 10 × 400 m à 4:05 /km (r 1′15) · 10′ RAC ». */
export function summarizeRun(s: RunWorkoutStructure, vmaKmh: number) {
  const parts = s.steps.map((st) => {
    if (st.kind === "step") return stepText(st, vmaKmh, s.steps.length === 1);
    const work = st.steps.find((x): x is Extract<RunStep, { kind: "step" }> => x.kind === "step" && x.role === "active");
    const rest = st.steps.find((x): x is Extract<RunStep, { kind: "step" }> => x.kind === "step" && (x.role === "recovery" || x.role === "rest"));
    if (!work) return `${st.times} × …`;
    const mid = midPct(work.target);
    return `${st.times} × ${fmtDuration(work.duration)}${mid ? ` à ${fmtPaceS(paceSPerKm(vmaKmh, mid))} /km` : ""}${rest ? ` (r ${fmtDuration(rest.duration)})` : ""}`;
  });
  return parts.join(" · ");
}
