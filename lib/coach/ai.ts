/**
 * Appel du coach IA (API Claude d'Anthropic) : doctrine en cache (prompt caching), faits de la période en JSON,
 * réponse en JSON strict. Clé serveur ANTHROPIC_API_KEY (console.anthropic.com), jamais exposée au navigateur.
 * Sans dépendance : simple fetch vers l'API Messages. parseDebrief est pure (tests : tools/test-coach-ai.ts).
 */
import { DOCTRINE } from "./doctrine";

export const COACH_MODEL = process.env.COACH_MODEL?.trim() || "claude-sonnet-5-5";
export type DebriefPoint = { tone: "good" | "warn" | "bad"; text: string };
export type Debrief = { verdict: string; points: DebriefPoint[]; consigne: string; principe: string | null };
export type DebriefResult = { debrief: Debrief; model: string; inputTokens: number; outputTokens: number; cachedTokens: number };

const RULES = `Tu es le coach personnel de Damien dans son appli Pulse. Tu appliques la doctrine ci-dessous.
On te donne en JSON les chiffres d'une période d'analyse, déjà calculés par Pulse, et des « constatsPulse » (règles automatiques).

Règles strictes :
- N'utilise QUE les chiffres fournis. N'invente aucune séance, aucun chiffre, aucune date. Si une donnée manque, n'en parle pas.
- Ne recopie pas les constats : explique ce qu'ils veulent dire ensemble et pourquoi, selon la doctrine (cite la méthode quand c'est utile : Lafay, SuperPhysique, Campus Coach).
- Une seule consigne, concrète et faisable dans les 7 prochains jours (quoi, combien, quand).
- Si les données sont trop maigres pour conclure, dis-le simplement et donne la consigne la plus utile pour en avoir.
- Français, tutoiement, phrases courtes. 120 mots au total au maximum.

Réponds UNIQUEMENT avec un objet JSON, sans texte autour ni balises de code :
{"verdict": "une phrase de bilan", "points": [{"tone": "good|warn|bad", "text": "une phrase"}], "consigne": "la consigne de la semaine", "principe": "la règle de méthode sur laquelle s'appuie la consigne, en une phrase, ou null"}
Entre 2 et 4 points.`;

/** Extrait et valide le JSON de la réponse (tolère des balises de code ou du texte autour). Null si inutilisable. */
export function parseDebrief(text: string): Debrief | null {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let j: unknown;
  try { j = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>, str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const points = (Array.isArray(o.points) ? o.points : [])
    .map((p) => { const x = (p ?? {}) as Record<string, unknown>; return { tone: (["good", "warn", "bad"].includes(str(x.tone)) ? str(x.tone) : "warn") as DebriefPoint["tone"], text: str(x.text) }; })
    .filter((p) => p.text).slice(0, 4);
  const d: Debrief = { verdict: str(o.verdict), points, consigne: str(o.consigne), principe: str(o.principe) || null };
  if (d.principe === "null") d.principe = null;
  return d.verdict && d.consigne ? d : null;
}

export class CoachAiError extends Error {}

type Block = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
type Usage = { inputTokens: number; outputTokens: number; cachedTokens: number };

/** Appel brut de l'API Messages. `system` : blocs mis en cache s'ils sont marqués. Renvoie le texte de la réponse et la consommation. */
export async function callClaude(o: { system: Block[]; messages: { role: "user" | "assistant"; content: string }[]; maxTokens: number }): Promise<{ text: string; model: string } & Usage> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new CoachAiError("Clé ANTHROPIC_API_KEY absente : ajoute-la dans Vercel (Settings > Environment Variables) puis redéploie.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: COACH_MODEL, max_tokens: o.maxTokens, system: o.system, messages: o.messages }),
    signal: AbortSignal.timeout(50_000),
  });
  const body = (await res.json().catch(() => null)) as {
    content?: { type: string; text?: string }[]; model?: string; error?: { message?: string };
    usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  } | null;
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    throw new CoachAiError(res.status === 401 ? "Clé ANTHROPIC_API_KEY refusée : vérifie-la dans Vercel." : res.status === 400 && /credit/i.test(msg) ? "Crédit de l'API épuisé : recharge-le sur console.anthropic.com." : `Le coach IA n'a pas répondu (${msg}).`);
  }
  const u = body?.usage ?? {};
  return {
    text: (body?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim(),
    model: body?.model ?? COACH_MODEL,
    inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), outputTokens: u.output_tokens ?? 0, cachedTokens: u.cache_read_input_tokens ?? 0,
  };
}

export async function askCoach(facts: unknown): Promise<DebriefResult> {
  const r = await callClaude({
    maxTokens: 900,
    // La doctrine ne change pas d'un appel à l'autre : mise en cache, relue à prix réduit
    system: [{ type: "text", text: `${RULES}\n\n${DOCTRINE}`, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Faits de la période (JSON) :\n${JSON.stringify(facts)}` }],
  });
  const debrief = parseDebrief(r.text);
  if (!debrief) throw new CoachAiError("Réponse du coach illisible, réessaie.");
  return { debrief, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cachedTokens: r.cachedTokens };
}
