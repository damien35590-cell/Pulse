/**
 * Chat avec le coach IA : chaque question part avec la doctrine (en cache), un contexte chiffré
 * (12 dernières semaines tous sports, course et muscu + séances prévues des 7 prochains jours) et l'historique de la conversation.
 * L'IA raisonne sur ces faits, elle ne calcule rien d'autre. Rendu du texte : lib/coach/chat-render.ts.
 */
import { prisma } from "../prisma";
import { dayKey, shiftDay } from "../dates";
import { parsePeriod } from "../analysis/period";
import { getCoachFacts } from "./facts";
import { callClaude } from "./ai";
import { DOCTRINE } from "./doctrine";

export const CHAT_WEEKS = 12;
/** Messages de l'historique renvoyés à chaque question (les plus récents). */
export const CHAT_HISTORY = 16;
export const CHAT_MAX_CHARS = 1000;

const RULES = `Tu es le coach personnel de Damien dans son appli Pulse, et il te pose une question. Tu appliques la doctrine ci-dessous.
Tu as un contexte chiffré à jour (JSON) : ses 12 dernières semaines (tous sports, course, musculation), ses programmes et ses séances prévues.

Règles strictes :
- Réponds d'abord à la question posée, directement. Puis justifie en t'appuyant sur ses chiffres et sur la méthode (Lafay, SuperPhysique, Campus Coach) quand c'est utile.
- N'utilise QUE les chiffres du contexte. N'invente aucune séance, aucune date, aucun chiffre. Si l'info manque, dis-le et dis ce qu'il faudrait noter dans Pulse.
- Pour déplacer ou adapter une séance, tiens compte des séances prévues, de la fatigue et des règles hybrides (pas de Bas du corps la veille d'une séance clé).
- Termine par une action concrète quand la question s'y prête.
- Pas de diagnostic médical : douleur ou fatigue anormale qui dure → lever le pied et consulter.
- Français, tutoiement, ton de coach direct et bienveillant. 150 mots au maximum.
- Mise en forme : texte simple, listes avec « - » si besoin, **gras** pour l'essentiel. Pas de titres, pas de tableaux.`;

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Contexte chiffré de la conversation, recalculé à chaque question (il suit tes nouvelles séances). */
export async function chatContext(userId: string, tz: string) {
  const now = new Date(), today = dayKey(now, tz), period = parsePeriod({ w: String(CHAT_WEEKS) }, tz, now);
  const D = (k: string) => new Date(k + "T00:00:00Z");
  const [tous, course, muscu, prevues] = await Promise.all([
    getCoachFacts(userId, "all", period, tz),
    getCoachFacts(userId, "RUN", period, tz),
    getCoachFacts(userId, "WORKOUT", period, tz),
    prisma.plannedSession.findMany({
      where: { userId, status: "PLANNED", date: { gte: D(today), lte: D(shiftDay(today, 7)) } }, orderBy: [{ date: "asc" }, { orderInWeek: "asc" }],
      select: { date: true, sport: true, title: true, isKeySession: true, plannedDurationS: true, program: { select: { name: true } } },
    }),
  ]);
  const strip = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== "aujourdhui" && k !== "periode"));
  return {
    aujourdhui: `${DAYS[D(today).getUTCDay()]} ${today}`,
    periode: tous.periode,
    tousSports: strip(tous), course: strip(course), musculation: strip(muscu),
    seancesPrevues7j: prevues.map((s) => ({
      jour: `${DAYS[s.date.getUTCDay()]} ${s.date.toISOString().slice(0, 10)}`, sport: s.sport, titre: s.title, cle: s.isKeySession,
      dureeMin: s.plannedDurationS ? Math.round(s.plannedDurationS / 60) : null, programme: s.program.name,
    })),
  };
}

/** Réponse du coach à la dernière question de `history` (ordre chronologique, la dernière est la question). */
export async function askCoachChat(history: { role: "user" | "assistant"; content: string }[], context: unknown) {
  return callClaude({
    maxTokens: 2000, // plafond large : seuls les tokens écrits sont facturés
    system: [
      { type: "text", text: `${RULES}\n\n${DOCTRINE}`, cache_control: { type: "ephemeral" } },
      // Contexte en cache lui aussi : les questions suivantes de la conversation le relisent à prix réduit
      { type: "text", text: `Contexte chiffré à jour (JSON) :\n${JSON.stringify(context)}`, cache_control: { type: "ephemeral" } },
    ],
    messages: history.slice(-CHAT_HISTORY),
  });
}
