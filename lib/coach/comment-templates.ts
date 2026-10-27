/**
 * Gabarits déterministes des commentaires de séance, un par verdict (lib/coach/session-verdict.ts). Ton sobre, factuel, stoïque :
 * style télégraphique, infinitifs, aucun chiffre qui ne vienne de `facts`. Fonctions pures (tests : tools/test-session-verdict.ts).
 */
import type { Verdict } from "./session-verdict";

const mmss = (s: number) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`; };
const hms = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}` : mmss(s));
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : "±"}${Math.abs(n)}`;

/** Muscu avec ceinture cardio : une phrase de chiffres, rien d'interprété. Vide sans mesure. */
const hrLine = (f: Verdict["facts"]) =>
  f.hrAvg != null && f.hrMax != null
    ? ` FC moyenne ${f.hrAvg} bpm, maximale ${f.hrMax} bpm${f.hrRestDrop != null ? `, baisse moyenne de ${f.hrRestDrop} bpm pendant les repos` : ""}.`
    : "";

export function commentTemplate(v: Verdict): string {
  return commentBody(v) + (v.facts.sport === "WORKOUT" ? hrLine(v.facts) : "");
}

function commentBody({ kind, facts: f }: Verdict): string {
  const strength = f.sport === "WORKOUT";
  switch (kind) {
    case "record":
      return strength
        ? `Record de répétitions sur ${f.exercise} : ${f.recordReps} reps (${signed(f.recordGain ?? 0)}). Bravo, la progression est confirmée par les chiffres.`
        : `Record personnel sur ${f.recordLabel} : ${hms(f.recordTimeS ?? 0)}. Félicitations, la progression est confirmée par les chiffres.`;
    case "fatigue": {
      const tail = "Signe de fatigue accumulée, privilégier la récupération sur les prochaines 48h.";
      if (f.hrDriftBpm != null) return `Dérive cardiaque observée (${signed(f.hrDriftBpm)} BPM à allure constante). ${tail}`;
      if (f.decouplingPct != null) return `Découplage FC/allure de ${f.decouplingPct.toLocaleString("fr-FR")} % (seuil 5 %). ${tail}`;
      return `Ressenti ${f.feeling === "HARD" ? "très difficile" : "fatigué"} déclaré. ${tail}`;
    }
    case "underperformance": {
      const half = f.sessionLabel ? `la prochaine séance ${f.sessionLabel}` : "la prochaine séance";
      return `Total ${f.totalReps} reps (${signed(f.deltaReps ?? 0)} vs séance précédente). ${f.stall ? `Blocage ${f.stall}/2. ` : ""}Récupération complète avant ${half}.`;
    }
    case "constrained":
      return "Séance validée. La régularité du plan est maintenue malgré les contraintes.";
    case "validated":
      if (strength) return `Cible de répétitions validée sur ${f.exercises === 1 ? `les ${f.sets} séries` : `les ${f.sets} séries de ${f.exercises} exercices`}. Le volume de travail est atteint pour ce cycle.`;
      return `${f.paceRangeSKm ? `Allure ${f.planLabel ?? "cible"} respectée (${mmss(f.paceRangeSKm[0])}-${mmss(f.paceRangeSKm[1])}).` : "Zone de fréquence cardiaque respectée."} ${
        f.hrInZone && f.paceRangeSKm ? "Bonne assimilation du bloc, fréquence cardiaque maintenue dans la zone cible." : "Bonne assimilation du bloc."}`;
  }
}

/** Cahier des charges à passer en system prompt si un LLM reformule un commentaire (voir comment-guard.ts : resolveComment). */
export const COMMENT_SYSTEM_PROMPT = `Tu rédiges le commentaire automatique d'une séance dans l'appli Pulse. On te donne un verdict et des facts (JSON).
Ton : sobre, factuel, stoïque, data-driven, impersonnel. Style télégraphique accepté, verbes à l'infinitif (« privilégier la récupération »). Motivant par la régularité et la discipline, jamais par l'enthousiasme.
Règles strictes :
- Aucune flatterie, aucun enthousiasme, aucune exclamation, aucun emoji.
- Chiffres uniquement issus de facts : n'en invente aucun.
- 1 à 2 phrases.
- Aucun jugement ni fausse compassion en cas de sous-performance.
- « Bravo » et « félicitations » uniquement si le verdict est « record ».
Réponds avec le commentaire seul, sans guillemets.`;
