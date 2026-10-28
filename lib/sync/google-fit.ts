import type { ActivityType } from "@prisma/client";
import { SPORT_LABEL } from "@/lib/sports";
import { prisma } from "@/lib/prisma";
import { absorbActivities, findOverlapping, processActivity } from "@/lib/pipeline/post-import";
import { leftoverGroups, mergedSpan, planSession, type Existing, type FitSession, type Piece } from "@/lib/sync/google-fit-merge";

/** Source des activités créées par cette synchro (les plus anciennes portent « fit » ; on les reconnaît à leur dedupeKey « gfit-… »). */
export const GOOGLE_FIT_SOURCE = "google-fit";

const AGGREGATE_URL =
  "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate";

// Traduit les codes d'activité Google Fit vers ton ActivityType Prisma
function mapFitType(typeId: number): ActivityType {
  switch (typeId) {
    case 8: return "RUN";      // Course à pied
    case 1:
    case 17: return "EBIKE";   // Vélo : sur Google Fit, ce sont les vélotafs à assistance électrique
    case 7: return "WALK";     // Marche
    case 76: return "SWIM";    // Natation
    case 97:                   // Musculation/Haltérophilie
    case 11:                   // Crossfit
    case 9: return "WORKOUT";  // Fitness/Aerobics
    default: return "OTHER";   // Autre sport par défaut
  }
}

// Activités détectées automatiquement qu'on importe : vélo (vélotaf), marche, course
const AUTO_TYPES = new Set([1, 7, 8]);
const AUTO_TITLES: Record<string, string> = {
  EBIKE: "Vélotaf",
  WALK: SPORT_LABEL("WALK"),
  RUN: SPORT_LABEL("RUN"),
};

// Fonction pour rafraîchir le jeton Google s'il est expiré
export async function getValidAccessToken(account: any) {
  if (!account.refresh_token) return account.access_token;

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }),
    });

    const tokens = await response.json();
    if (!response.ok) throw tokens;

    await prisma.account.update({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: account.providerAccountId,
        },
      },
      data: {
        access_token: tokens.access_token,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
      },
    });

    return tokens.access_token;
  } catch (error) {
    console.error("Erreur de rafraîchissement du token :", error);
    return account.access_token;
  }
}

// Récupère la distance (en mètres) sur une période (null si indisponible)
export async function fetchSessionDistanceM(
  token: string,
  startMs: number,
  endMs: number
): Promise<number | null> {
  try {
    const res = await fetch(AGGREGATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: "com.google.distance.delta" }],
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    });

    if (!res.ok) {
      console.warn(
        `[google-fit] distance ${res.status}: ${(await res.text()).substring(0, 120)}`
      );
      return null;
    }

    const data = await res.json();
    let total = 0;
    for (const bucket of data.bucket ?? []) {
      for (const ds of bucket.dataset ?? []) {
        for (const point of ds.point ?? []) {
          total += point.value?.[0]?.fpVal ?? 0;
        }
      }
    }
    return Math.round(total);
  } catch (e) {
    console.warn("[google-fit] distance: erreur", e);
    return null;
  }
}

// Récupère les activités détectées automatiquement (vélo, marche, course)
async function fetchActivitySegments(
  token: string,
  startMs: number,
  endMs: number
): Promise<{ activity: number; startMs: number; endMs: number }[]> {
  try {
    const res = await fetch(AGGREGATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: "com.google.activity.segment" }],
        bucketByActivitySegment: { minDurationMillis: 60 * 1000 }, // 1 min : les morceaux courts sont recollés, puis seuil de 5 min (MIN_AUTO_S)
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    });

    if (!res.ok) {
      console.warn(
        `[google-fit] segments ${res.status}: ${(await res.text()).substring(0, 120)}`
      );
      return [];
    }

    const data = await res.json();
    return (data.bucket ?? [])
      .filter((b: any) => AUTO_TYPES.has(b.activity))
      .map((b: any) => ({
        activity: b.activity as number,
        startMs: Number(b.startTimeMillis),
        endMs: Number(b.endTimeMillis),
      }));
  } catch (e) {
    console.warn("[google-fit] segments: erreur", e);
    return [];
  }
}

/** Durée minimale d'une sortie détectée automatiquement (segments), une fois ses morceaux recollés. */
const MIN_AUTO_S = 5 * 60;
const TOLERANCE_MS = 5 * 60 * 1000;

type Sourced = Piece & { id: string };
/** Session Google Fit telle que l'appli Fit l'affiche (« Course à pied du midi », 12:35 → 13:16). */
export type RawSession = FitSession & { name: string | null; activityType: number; activeMs: number | null };

/** Sessions de la période (sessions sans fin ignorées : en cours). */
export async function fetchSessions(token: string, startMs: number, endMs: number): Promise<RawSession[]> {
  const res = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${new Date(startMs).toISOString()}&endTime=${new Date(endMs).toISOString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Google (${res.status}) : ${(await res.text()).substring(0, 80)}`);
  const data = await res.json();
  return (data.session ?? [])
    .filter((s: any) => s.id && s.startTimeMillis && s.endTimeMillis && +s.endTimeMillis > +s.startTimeMillis)
    .map((s: any) => ({
      id: String(s.id), name: s.name || null, activityType: Number(s.activityType),
      startMs: Number(s.startTimeMillis), endMs: Number(s.endTimeMillis), activeMs: s.activeTimeMillis ? Number(s.activeTimeMillis) : null,
    }));
}

/** FC moyenne / max sur une période (agrégat com.google.heart_rate.summary) ; null sans mesure ou sans autorisation de lecture. */
async function fetchHeartRate(token: string, startMs: number, endMs: number): Promise<{ avg: number; max: number } | null> {
  try {
    const res = await fetch(AGGREGATE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ aggregateBy: [{ dataTypeName: "com.google.heart_rate.bpm" }], bucketByTime: { durationMillis: endMs - startMs }, startTimeMillis: startMs, endTimeMillis: endMs }),
    });
    if (!res.ok) return null; // 403 tant que la lecture de la FC n'est pas autorisée : pas grave
    const data = await res.json();
    const v = data.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value; // summary : [moyenne, max, min]
    return v?.[0]?.fpVal ? { avg: Math.round(v[0].fpVal), max: Math.round(v[1]?.fpVal ?? v[0].fpVal) } : null;
  } catch {
    return null;
  }
}

/** Ce qu'une session donne à l'activité : distance agrégée sur toute sa période, temps actif (sinon durée), temps écoulé, FC si dispo. */
export async function sessionValues(token: string, s: RawSession) {
  const [distanceM, hr] = await Promise.all([fetchSessionDistanceM(token, s.startMs, s.endMs), fetchHeartRate(token, s.startMs, s.endMs)]);
  const elapsedS = Math.round((s.endMs - s.startMs) / 1000);
  return { distanceM: distanceM ?? 0, movingS: s.activeMs ? Math.min(elapsedS, Math.round(s.activeMs / 1000)) : elapsedS, elapsedS, hr };
}

/** Activités Google Fit d'un utilisateur qui commencent dans la période (un jour de marge avant). */
export async function loadExisting(uid: string, startMs: number, endMs: number): Promise<(Existing & { type: ActivityType })[]> {
  const list = await prisma.activity.findMany({
    where: { userId: uid, OR: [{ source: GOOGLE_FIT_SOURCE }, { dedupeKey: { startsWith: "gfit-" } }], startedAt: { gte: new Date(startMs - 864e5), lte: new Date(endMs) } },
    select: { id: true, type: true, dedupeKey: true, mergedSourceIds: true, startedAt: true, movingTimeS: true, elapsedTimeS: true },
  });
  return list.map((a) => ({ id: a.id, type: a.type, dedupeKey: a.dedupeKey, mergedSourceIds: a.mergedSourceIds, startMs: +a.startedAt, endMs: +a.startedAt + 1000 * Math.max(a.movingTimeS, a.elapsedTimeS ?? 0) }));
}

/** Crée l'activité d'une session (sans le traitement d'import : à l'appelant de lancer processActivity). */
export async function createFromSession(uid: string, s: RawSession, v: Awaited<ReturnType<typeof sessionValues>>): Promise<string> {
  const type = mapFitType(s.activityType), dedupeKey = `gfit-${s.id}`;
  const { id } = await prisma.activity.create({
    data: {
      userId: uid, dedupeKey, externalId: dedupeKey, source: GOOGLE_FIT_SOURCE,
      title: s.name || AUTO_TITLES[type] || `Activité ${type}`, type,
      startedAt: new Date(s.startMs), movingTimeS: v.movingS, elapsedTimeS: v.elapsedS, distanceM: v.distanceM,
      ...(v.hr ? { avgHr: v.hr.avg, maxHr: v.hr.max } : {}),
    },
    select: { id: true },
  });
  return id;
}

/**
 * Reconstruit une sortie depuis sa session : crée l'activité de la session (si elle n'existe pas), y verse ce que portaient les activités nées
 * des segments qui la recouvrent (ressenti, matériel, séance du programme, records…), les supprime, puis rejoue le traitement d'import.
 * Utilisé par tools/reconstruire-gfit.ts. Renvoie l'id gardé.
 */
export async function rebuildFromSession(uid: string, s: RawSession, plan: { ownId: string | null; replaces: string[] }, token: string): Promise<string> {
  const keep = plan.ownId ?? (await createFromSession(uid, s, await sessionValues(token, s)));
  await absorbActivities(keep, plan.replaces);
  await processActivity(keep);
  return keep;
}

/** Distance d'une sortie recollée : somme des morceaux (null si Google n'en donne pour aucun). */
async function piecesDistanceM(token: string, g: Piece[]): Promise<number | null> {
  const parts = await Promise.all(g.map((p) => fetchSessionDistanceM(token, p.startMs, p.endMs)));
  return parts.some((d) => d != null) ? parts.reduce<number>((s, d) => s + (d ?? 0), 0) : null;
}

/**
 * Activités nées de segments déjà en base pour un groupe de segments hors sessions : par id (dedupeKey, mergedSourceIds) ou du même type
 * démarrant dans la période. Aucune → à créer. Une seule → complétée si elle ne couvre pas encore tous les morceaux. Plusieurs → importées
 * séparément avant le recollage : on n'y touche pas ici (rattrapage : tools/fusionner-gfit.ts).
 */
async function existingFor(uid: string, types: ActivityType[], ids: string[], span: { startMs: number; endMs: number }) {
  return prisma.activity.findMany({
    where: {
      userId: uid,
      OR: [
        { dedupeKey: { in: ids.map((i) => `gfit-${i}`) } },
        { mergedSourceIds: { hasSome: ids } },
        { dedupeKey: { startsWith: "gfit-seg-" }, type: { in: types }, startedAt: { gte: new Date(span.startMs - TOLERANCE_MS), lte: new Date(span.endMs) } },
      ],
    },
    select: { id: true, dedupeKey: true, mergedSourceIds: true, distanceM: true },
  });
}

/**
 * Synchro Google Fit. Les SESSIONS font foi (ce que montre l'appli Fit) : une activité par session, clé gfit-<id de session>.
 * Les segments bruts ne servent que pour le temps qu'aucune session ne couvre (vélotaf, marches détectés), recollés par type (< 10 min).
 * Rien n'est jamais supprimé ici : une session recouverte par d'anciennes activités nées de segments est signalée (« à reconstruire »)
 * et laissée à tools/reconstruire-gfit.ts.
 */
export async function syncGoogleFit(uid: string, days: number = 7) {
  const account = await prisma.account.findFirst({
    where: { userId: uid, provider: "google" },
  });

  if (!account || !account.access_token) {
    throw new Error("Compte Google non lié.");
  }

  const validToken = await getValidAccessToken(account);
  const endMs = Date.now(), startMs = endMs - days * 864e5;

  const sessions = await fetchSessions(validToken, startMs, endMs);
  const existing = await loadExisting(uid, startMs, endMs);

  let saved = 0;
  let duplicates = 0;
  let updated = 0;
  let auto = 0;
  let joined = 0;
  let pending = 0;

  // ---------- 1. Sessions : la source de vérité ----------
  for (const s of sessions) {
    const plan = planSession(s, existing);
    if (plan.status === "replace") { pending++; continue; }
    if (plan.status === "exists") {
      const e = await prisma.activity.findUnique({ where: { id: plan.ownId! }, select: { distanceM: true } });
      if (e && e.distanceM === 0) {
        const d = await fetchSessionDistanceM(validToken, s.startMs, s.endMs);
        if (d) { await prisma.activity.update({ where: { id: plan.ownId! }, data: { distanceM: d } }); updated++; continue; }
      }
      duplicates++;
      continue;
    }
    const v = await sessionValues(validToken, s);
    // Même sortie déjà enregistrée par une autre source (FIT, Strava, saisie…) : Google Fit n'apporte rien de plus.
    if ((await findOverlapping(uid, { startedAt: new Date(s.startMs), movingTimeS: v.movingS, elapsedTimeS: v.elapsedS })).length) { duplicates++; continue; }
    let id: string;
    try {
      id = await createFromSession(uid, s, v);
    } catch (e: any) {
      throw new Error(`Erreur Prisma : ${e.message || String(e)}`);
    }
    saved++;
    await processActivity(id);
  }

  // ---------- 2. Segments hors sessions (vélotaf, marches détectés) : recollés par type ----------
  const segments = await fetchActivitySegments(validToken, startMs, endMs);
  for (const g of leftoverGroups(segments.map((s) => ({ ...s, type: s.activity, id: `seg-${s.activity}-${s.startMs}` })), sessions)) {
    const span = mergedSpan(g), ids = g.map((p) => p.id), merged = g.length > 1;
    // Les petits bouts isolés restent ignorés ; recollés, ils comptent.
    if (span.movingS < MIN_AUTO_S) continue;
    const typeEnum = mapFitType(g[0].activity);
    const found = await existingFor(uid, typeEnum === "EBIKE" ? ["EBIKE", "RIDE"] : [typeEnum], ids, span);
    if (found.length > 1) { duplicates++; continue; }
    if (found.length === 1) {
      const e = found[0], has = new Set([...e.mergedSourceIds, e.dedupeKey?.replace(/^gfit-/, "")]);
      if (ids.every((i) => has.has(i))) {
        if (e.distanceM === 0) {
          const d = await piecesDistanceM(validToken, g);
          if (d) { await prisma.activity.update({ where: { id: e.id }, data: { distanceM: d } }); updated++; continue; }
        }
        duplicates++;
        continue;
      }
      // La sortie a grandi (ou n'avait été prise qu'en partie) : on la complète, sans toucher à ce que tu as saisi dessus.
      const d = await piecesDistanceM(validToken, g);
      await prisma.activity.update({
        where: { id: e.id },
        data: { startedAt: new Date(span.startMs), movingTimeS: span.movingS, elapsedTimeS: merged ? span.elapsedS : null, ...(d != null ? { distanceM: d } : {}), mergedSourceIds: merged ? ids : [] },
      });
      await processActivity(e.id);
      if (merged) joined += g.length - 1;
      updated++;
      continue;
    }
    if ((await findOverlapping(uid, { startedAt: new Date(span.startMs), movingTimeS: span.movingS, elapsedTimeS: span.elapsedS })).length) { duplicates++; continue; }
    const distanceM = await piecesDistanceM(validToken, g);
    const dedupeKey = `gfit-${g[0].id}`;
    let id: string;
    try {
      ({ id } = await prisma.activity.create({
        data: {
          userId: uid, dedupeKey, externalId: dedupeKey, source: GOOGLE_FIT_SOURCE,
          title: AUTO_TITLES[typeEnum] || `Activité ${typeEnum}`, type: typeEnum,
          startedAt: new Date(span.startMs), movingTimeS: span.movingS,
          ...(merged ? { elapsedTimeS: span.elapsedS, mergedSourceIds: ids } : {}),
          distanceM: distanceM ?? 0,
        },
        select: { id: true },
      }));
    } catch (e: any) {
      throw new Error(`Erreur Prisma : ${e.message || String(e)}`);
    }
    if (merged) joined += g.length - 1;
    auto++;
    await processActivity(id);
  }

  return {
    success: true,
    count: sessions.length + segments.length,
    saved: saved + auto, // activités créées (séances + automatiques)
    message: `${saved} séance(s), ${auto} activité(s) automatique(s), ${updated} mise(s) à jour, ${duplicates} déjà présente(s)${joined ? `, ${joined} morceau(x) recollé(s)` : ""}${pending ? `, ${pending} sortie(s) à reconstruire depuis la session` : ""}.`,
  };
}
