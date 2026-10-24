/**
 * Note du coach en tête de fiche d'activité : 1 à 2 phrases tirées de la doctrine (lib/coach/doctrine.ts) et du contexte de la semaine
 * (séances déjà faites, prochaine séance du programme). Gabarits déterministes, aucun appel LLM : rien à mettre en cache, jamais d'attente.
 * Tutoiement, concret, jamais culpabilisant ; vélotaf et marche ne sont jamais commentés comme de l'entraînement (null).
 * `activityNote` est pure (tests : tools/test-activity-note.ts) ; `getActivityNote` lit la base.
 */
import { prisma } from "../prisma";
import { dayKey, shiftDay, weekKeys } from "../dates";
import { isCommute } from "../routes/estimate";
import { sessionClass, type SessionClass } from "../activity/comparables";

export type NextSession = { kind: SessionClass | "lift"; /** Jours après l'activité (1 = lendemain). */ days: number; /** « jeudi » */ weekday: string };
export type NoteInput = {
  type: string;
  title: string;
  source?: string | null;
  dedupeKey?: string | null;
  /** Course : genre de séance (lib/activity/comparables.ts). */
  cls?: SessionClass | null;
  /** Muscu : moitié travaillée. */
  workoutKind?: "HAUT" | "BAS" | "LIBRE" | null;
  feeling?: string | null;
  rpe?: number | null;
  /** Rang de l'activité dans la semaine pour son sport (course ou muscu), elle comprise. */
  weekRank: number;
  /** Prochaine séance du programme dans les 4 jours qui suivent. */
  next?: NextSession | null;
};

/** Au-delà, la prochaine séance est trop loin pour orienter la récupération. */
export const NEXT_WITHIN_DAYS = 4;

const when = (n: NextSession) => (n.days === 1 ? "de demain" : `de ${n.weekday}`);
const NEXT_NAME: Record<NextSession["kind"], string> = { key: "la séance clé", long: "la sortie longue", easy: "le prochain footing", lift: "la prochaine muscu" };
const hard = (i: NoteInput) => i.feeling === "HARD" || i.feeling === "TIRED" || (i.rpe ?? 0) >= 9;

function runNote(i: NoteInput): string[] {
  const n = i.next, demanding = n && (n.kind === "key" || n.kind === "long") ? n : null;
  const rank = i.weekRank >= 4 ? `${i.weekRank}ᵉ sortie de la semaine, au-delà de la cible de 2 à 3 : garde du repos.` : i.weekRank === 3 ? "3ᵉ sortie de la semaine : la cible de 2 à 3 est atteinte." : i.weekRank === 2 ? "2ᵉ sortie de la semaine, dans la cible de 2 à 3." : null;
  switch (i.cls ?? "easy") {
    case "key":
      return [
        "Séance clé faite : la qualité de la semaine est assurée.",
        hard(i) ? "Ressentie dure : si la fatigue reste, allège d'abord la prochaine course intense."
          : demanding && n!.days <= 1 ? `Récupère bien avant ${NEXT_NAME[demanding.kind]} ${when(demanding)} : vise le bas des allures.`
          : "D'ici la prochaine, du footing facile ou de la muscu haut du corps.",
      ];
    case "long":
      return [
        "Sortie longue faite : c'est elle qui construit l'endurance.",
        hard(i) ? "Ressentie dure : mange, hydrate-toi et garde le lendemain très calme." : "Lendemain en douceur : repos ou muscu haut du corps.",
      ];
    default:
      if (hard(i)) return ["Footing ressenti difficile : dors bien et garde le prochain en aisance respiratoire."];
      if (demanding) return [`Footing bien placé, garde les jambes fraîches pour ${NEXT_NAME[demanding.kind]} ${when(demanding)}.`];
      return ["Footing en endurance : c'est ce volume facile qui fait progresser.", ...(rank ? [rank] : [])];
  }
}

function liftNote(i: NoteInput): string[] {
  const n = i.next, runSoon = n && (n.kind === "key" || n.kind === "long") && n.days <= 1 ? n : null;
  const rank = i.weekRank >= 2 ? `${i.weekRank}ᵉ séance de muscu de la semaine${i.weekRank >= 3 ? " : la cible de 2 à 3 est atteinte" : ""}.` : null;
  if (i.workoutKind === "BAS")
    return runSoon
      ? [`Bas du corps la veille de ${NEXT_NAME[runSoon.kind]} : si les jambes sont lourdes demain, vise le bas des allures.`]
      : ["Bas du corps fait : laisse 48 h aux jambes avant une séance clé de course.", ...(rank ? [rank] : [])];
  if (i.workoutKind === "HAUT")
    return [runSoon ? `Haut du corps la veille de ${NEXT_NAME[runSoon.kind]} : les jambes restent fraîches.` : "Haut du corps fait : prochaine muscu en bas du corps + abdos, loin de la séance clé.", ...(rank ? [rank] : [])];
  return ["Séance de muscu faite : la régularité prime, vise 2 à 3 séances par semaine.", ...(rank ? [rank] : [])];
}

/** 1 à 2 phrases, ou null (vélotaf, marche, sport sans conseil utile). */
export function activityNote(i: NoteInput): string | null {
  if (isCommute({ type: i.type, title: i.title, source: i.source ?? "", dedupeKey: i.dedupeKey ?? null, startedAt: new Date(0), distanceM: 0, movingTimeS: 0 })) return null;
  let out: string[];
  if (i.type === "RUN") out = runNote(i);
  else if (i.type === "WORKOUT") out = liftNote(i);
  else if (i.type === "RIDE") {
    const n = i.next;
    out = ["Sortie vélo : du volume sans impact, un bon complément de la course."];
    if (n && n.kind === "key" && n.days <= 1) out.push("Garde de la fraîcheur pour la séance clé de demain.");
  } else return null;
  return out.slice(0, 2).join(" ");
}

const weekdayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" });

/** Note du coach d'une activité de l'utilisateur. `cls` : genre de séance déjà calculé pour la comparaison (même classement). */
export async function getActivityNote(userId: string, activityId: string, tz: string, cls?: SessionClass | null): Promise<string | null> {
  const a = await prisma.activity.findFirst({
    where: { id: activityId, userId },
    select: { type: true, title: true, source: true, dedupeKey: true, startedAt: true, feeling: true, rpe: true, kind: true, distanceM: true, movingTimeS: true },
  });
  if (!a || !["RUN", "WORKOUT", "RIDE"].includes(a.type)) return null;
  const day = dayKey(a.startedAt, tz), week = weekKeys(a.startedAt, tz);
  const [peers, planned] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, type: a.type, startedAt: { gte: new Date(Date.parse(week[0]) - 864e5), lte: a.startedAt } },
      select: { type: true, title: true, source: true, dedupeKey: true, startedAt: true, distanceM: true, movingTimeS: true },
    }),
    prisma.plannedSession.findFirst({
      where: { userId, status: "PLANNED", date: { gt: new Date(day), lte: new Date(shiftDay(day, NEXT_WITHIN_DAYS)) } },
      orderBy: [{ date: "asc" }, { orderInWeek: "asc" }],
      select: { date: true, sport: true, kind: true, isKeySession: true },
    }),
  ]);
  const weekRank = peers.filter((p) => week.includes(dayKey(p.startedAt, tz)) && !isCommute(p)).length;
  const next: NextSession | null = planned && {
    kind: planned.sport === "WORKOUT" || planned.kind === "STRENGTH_WORKOUT" ? "lift"
      : sessionClass({ id: "", type: "RUN", startedAt: planned.date, distanceM: 0, movingTimeS: 0, planned: { kind: planned.kind, isKeySession: planned.isKeySession } }),
    days: Math.round((+planned.date - Date.parse(day)) / 864e5),
    weekday: weekdayFmt.format(planned.date),
  };
  return activityNote({ ...a, workoutKind: a.kind, cls: a.type === "RUN" ? cls ?? sessionClass({ ...a, id: activityId }) : null, weekRank: Math.max(1, weekRank), next });
}
