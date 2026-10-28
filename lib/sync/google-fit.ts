import type { ActivityType } from "@prisma/client";
import { SPORT_LABEL } from "@/lib/sports";
import { prisma } from "@/lib/prisma";
import { absorbActivities, OVERLAP_RATIO, overlapRatio, processActivity } from "@/lib/pipeline/post-import";
import { awardBadges } from "@/lib/data/badges";
import { isSegmentActivity, keepGroup, leftoverGroups, mergedSpan, planSession, type Existing, type FitSession } from "@/lib/sync/google-fit-merge";

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

/** Marge avant expiration : en dessous, on renouvelle le jeton. */
const TOKEN_MARGIN_S = 5 * 60;

/**
 * Jeton Google valide : celui en base s'il vaut encore plus de 5 min, sinon renouvelé (et réécrit en base).
 * Un renouvellement refusé n'est plus avalé : avec un jeton mort, Google répondrait 401 à chaque appel. On lève une erreur claire,
 * sauf si l'ancien jeton est encore valable (il sert jusqu'au bout).
 */
export async function getValidAccessToken(account: any) {
  const left = (account.expires_at ?? 0) - Math.floor(Date.now() / 1000);
  if (!account.refresh_token || (account.access_token && left > TOKEN_MARGIN_S)) return account.access_token;

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
    console.error("[google-fit] renouvellement du jeton refusé :", error);
    if (account.access_token && left > 0) return account.access_token;
    const why = (error as { error_description?: string; error?: string })?.error_description ?? (error as { error?: string })?.error ?? (error instanceof Error ? error.message : "inconnu");
    throw new Error(`Google : jeton expiré et renouvellement refusé (${why}). Reconnecte ton compte Google.`);
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

/** Distance d'un seau d'agrégat Google (somme des points com.google.distance.delta). */
const bucketDistance = (b: any) => Math.round((b.dataset ?? []).flatMap((d: any) => d.point ?? []).reduce((s: number, p: any) => s + (p.value?.[0]?.fpVal ?? 0), 0));

/** Activités détectées automatiquement (vélo, marche, course) AVEC leur distance : un seul appel (agrégat de distance par segment). */
async function fetchActivitySegments(
  token: string,
  startMs: number,
  endMs: number
): Promise<{ activity: number; startMs: number; endMs: number; distanceM: number }[]> {
  try {
    const res = await fetch(AGGREGATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: "com.google.distance.delta" }],
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
        distanceM: bucketDistance(b),
      }));
  } catch (e) {
    console.warn("[google-fit] segments: erreur", e);
    return [];
  }
}

/** Durée minimale d'une sortie détectée automatiquement (segments), une fois ses morceaux recollés. */
const MIN_AUTO_S = 5 * 60;
const TOLERANCE_MS = 5 * 60 * 1000;

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

/** Distance de chaque session de la période, en un seul appel (agrégat par session). Vide si Google refuse : on retombe sur un appel par session. */
async function fetchSessionDistances(token: string, startMs: number, endMs: number): Promise<Map<string, number>> {
  try {
    const res = await fetch(AGGREGATE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ aggregateBy: [{ dataTypeName: "com.google.distance.delta" }], bucketBySession: { minDurationMillis: 0 }, startTimeMillis: startMs, endTimeMillis: endMs }),
    });
    if (!res.ok) return new Map();
    const data = await res.json();
    return new Map((data.bucket ?? []).filter((b: any) => b.session?.id).map((b: any) => [String(b.session.id), bucketDistance(b)]));
  } catch {
    return new Map();
  }
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
/** `known` : distance déjà lue par fetchSessionDistances ; `hr` : la lecture de la FC est autorisée (sinon pas d'appel). Durées tronquées à la seconde, comme l'appli Fit. */
export async function sessionValues(token: string, s: RawSession, opts: { known?: number; hr?: boolean } = {}) {
  const [distanceM, hr] = await Promise.all([
    opts.known ?? fetchSessionDistanceM(token, s.startMs, s.endMs),
    opts.hr ? fetchHeartRate(token, s.startMs, s.endMs) : null,
  ]);
  const elapsedS = Math.floor((s.endMs - s.startMs) / 1000);
  return { distanceM: distanceM ?? 0, movingS: s.activeMs ? Math.min(elapsedS, Math.floor(s.activeMs / 1000)) : elapsedS, elapsedS, hr };
}
const canReadHr = (scope: string | null | undefined) => !!scope?.includes("fitness.heart_rate.read");

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

/** Distance d'une sortie recollée : somme des morceaux (déjà lue avec les segments). */
const piecesDistanceM = (g: { distanceM: number }[]) => g.reduce((s, p) => s + p.distanceM, 0);

/**
 * Synchro Google Fit. Les SESSIONS font foi (ce que montre l'appli Fit) : une activité par session, clé gfit-<id de session>.
 * Les segments bruts ne servent que pour le temps qu'aucune session ne couvre (vélotaf, marches détectés), recollés par type (< 10 min).
 * Rien n'est jamais supprimé ici : une session recouverte par d'anciennes activités nées de segments est signalée (« à reconstruire »)
 * et laissée à tools/reconstruire-gfit.ts.
 *
 * Rapidité (la fonction Vercel est aux États-Unis, la base à Londres : chaque requête coûte) : 4 appels Google en tout (liste des sessions,
 * distance par session, segments avec leur distance, plus le renouvellement du jeton s'il expire), activités de la période lues une fois
 * et cherchées en mémoire, badges recalculés une seule fois à la fin.
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

  const [sessions, distances, segments, existing, around] = await Promise.all([
    fetchSessions(validToken, startMs, endMs),
    fetchSessionDistances(validToken, startMs, endMs),
    fetchActivitySegments(validToken, startMs, endMs),
    loadExisting(uid, startMs, endMs),
    // Toutes sources : pour ne pas doubler une sortie déjà enregistrée par Strava, un fichier FIT, une saisie…
    prisma.activity.findMany({
      where: { userId: uid, startedAt: { gte: new Date(startMs - 864e5), lte: new Date(endMs) } },
      select: { startedAt: true, movingTimeS: true, elapsedTimeS: true },
    }),
  ]);
  const takenBy = (span: { startedAt: Date; movingTimeS: number; elapsedTimeS?: number | null }) => around.some((o) => overlapRatio(o, span) > OVERLAP_RATIO);
  const hr = canReadHr(account.scope);
  const created: string[] = [];

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
      const own = await prisma.activity.findUnique({ where: { id: plan.ownId! }, select: { distanceM: true } });
      const d = distances.get(s.id);
      if (own && own.distanceM === 0 && d) { await prisma.activity.update({ where: { id: plan.ownId! }, data: { distanceM: d } }); updated++; }
      else duplicates++;
      continue;
    }
    const v = await sessionValues(validToken, s, { known: distances.get(s.id), hr });
    const span = { startedAt: new Date(s.startMs), movingTimeS: v.movingS, elapsedTimeS: v.elapsedS };
    if (takenBy(span)) { duplicates++; continue; }
    let id: string;
    try {
      id = await createFromSession(uid, s, v);
    } catch (e: any) {
      throw new Error(`Erreur Prisma : ${e.message || String(e)}`);
    }
    around.push(span);
    existing.push({ id, type: mapFitType(s.activityType), dedupeKey: `gfit-${s.id}`, mergedSourceIds: [], startMs: s.startMs, endMs: s.endMs });
    created.push(id);
    saved++;
  }

  // ---------- 2. Segments hors sessions (vélotaf, marches détectés) : recollés par type ----------
  for (const g of leftoverGroups(segments.map((s) => ({ ...s, type: s.activity, id: `seg-${s.activity}-${s.startMs}` })), sessions)) {
    const span = mergedSpan(g), ids = g.map((p) => p.id), merged = g.length > 1;
    // Au moins 5 min en tout, un segment de 5 min ou plus, et 300 m pour une marche : le reste, c'est le téléphone qui bouge dans la poche.
    if (span.movingS < MIN_AUTO_S || !keepGroup(g)) continue;
    const typeEnum = mapFitType(g[0].activity), types: string[] = typeEnum === "EBIKE" ? ["EBIKE", "RIDE"] : [typeEnum];
    // Déjà en base : par id (clé, morceaux recollés) ou activité née de segments du même type qui démarre dans la sortie.
    const found = existing.filter((e) =>
      ids.some((i) => e.dedupeKey === `gfit-${i}` || e.mergedSourceIds.includes(i))
      || (isSegmentActivity(e) && types.includes(e.type) && e.startMs >= span.startMs - TOLERANCE_MS && e.startMs <= span.endMs));
    const distanceM = piecesDistanceM(g);
    if (found.length > 1) { duplicates++; continue; } // importés séparément avant le recollage : tools/fusionner-gfit.ts
    if (found.length === 1) {
      const e = found[0], has = new Set([...e.mergedSourceIds, e.dedupeKey?.replace(/^gfit-/, "")]);
      if (ids.every((i) => has.has(i))) {
        const own = await prisma.activity.findUnique({ where: { id: e.id }, select: { distanceM: true } });
        if (own && own.distanceM === 0 && distanceM) { await prisma.activity.update({ where: { id: e.id }, data: { distanceM } }); updated++; }
        else duplicates++;
        continue;
      }
      // La sortie a grandi (ou n'avait été prise qu'en partie) : on la complète, sans toucher à ce que tu as saisi dessus.
      await prisma.activity.update({
        where: { id: e.id },
        data: { startedAt: new Date(span.startMs), movingTimeS: span.movingS, elapsedTimeS: merged ? span.elapsedS : null, distanceM, mergedSourceIds: merged ? ids : [] },
      });
      created.push(e.id);
      if (merged) joined += g.length - 1;
      updated++;
      continue;
    }
    const at = { startedAt: new Date(span.startMs), movingTimeS: span.movingS, elapsedTimeS: span.elapsedS };
    if (takenBy(at)) { duplicates++; continue; }
    const dedupeKey = `gfit-${g[0].id}`;
    let id: string;
    try {
      ({ id } = await prisma.activity.create({
        data: {
          userId: uid, dedupeKey, externalId: dedupeKey, source: GOOGLE_FIT_SOURCE,
          title: AUTO_TITLES[typeEnum] || `Activité ${typeEnum}`, type: typeEnum,
          startedAt: at.startedAt, movingTimeS: span.movingS,
          ...(merged ? { elapsedTimeS: span.elapsedS, mergedSourceIds: ids } : {}),
          distanceM,
        },
        select: { id: true },
      }));
    } catch (e: any) {
      throw new Error(`Erreur Prisma : ${e.message || String(e)}`);
    }
    around.push(at);
    existing.push({ id, type: typeEnum, dedupeKey, mergedSourceIds: merged ? ids : [], startMs: span.startMs, endMs: span.endMs });
    if (merged) joined += g.length - 1;
    created.push(id);
    auto++;
  }

  // ---------- 3. Traitement d'import (charge, records, programme, anecdote), puis badges une seule fois ----------
  for (const id of created) await processActivity(id, undefined, { badges: false });
  if (created.length) {
    const tz = (await prisma.user.findUnique({ where: { id: uid }, select: { timezone: true } }))?.timezone ?? "Europe/Paris";
    await awardBadges(uid, tz).catch((e) => console.error("[google-fit] badges", e));
  }

  return {
    success: true,
    count: sessions.length + segments.length,
    saved: saved + auto, // activités créées (séances + automatiques)
    message: `${saved} séance(s), ${auto} activité(s) automatique(s), ${updated} mise(s) à jour, ${duplicates} déjà présente(s)${joined ? `, ${joined} morceau(x) recollé(s)` : ""}${pending ? `, ${pending} sortie(s) à reconstruire depuis la session` : ""}.`,
  };
}
