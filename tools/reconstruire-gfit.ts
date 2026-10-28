/**
 * Rattrapage : reconstruit les sorties Google Fit depuis leurs SESSIONS (ce que montre l'appli Fit), à la place des activités nées des segments
 * bruts que Fit réétiquette minute par minute (une course de 40 min importée en « marche + course + course + marche »).
 *
 *   npx tsx tools/reconstruire-gfit.ts                                  → simulation sur les 3 derniers jours (fenêtre de la synchro)
 *   npx tsx tools/reconstruire-gfit.ts --from=2026-10-27 --to=2026-10-27
 *   … --apply                                                          → applique
 *
 * Par session : activité créée depuis la session (début, fin, type, distance agrégée sur toute sa période, temps actif, FC si autorisée), puis
 * les activités nées de segments qui la recouvrent (quel que soit leur type) y versent ressenti, matériel, séance du programme, records…
 * et sont supprimées ; enfin le traitement d'import est rejoué (charge, records, programme, anecdote). Une session déjà importée et que rien
 * ne recouvre est laissée telle quelle : relancer ne crée rien de plus.
 *
 * Il faut un jeton Google valide en base : sans le secret client (variable « sensible » sur Vercel), le script ne peut pas le renouveler ;
 * lance d'abord « Synchroniser maintenant » dans l'appli (jeton valable 1 h).
 * Base : DIRECT_URL du .env (dev). Pour la prod, voir CLAUDE.md.
 */
import { prisma } from "../lib/prisma";
import { findOverlapping, processActivity } from "../lib/pipeline/post-import";
import { createFromSession, fetchSessions, getValidAccessToken, loadExisting, rebuildFromSession, sessionValues } from "../lib/sync/google-fit";
import { planSession } from "../lib/sync/google-fit-merge";

const apply = process.argv.includes("--apply");
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const time = (ms: number) => new Date(ms).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const hms = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

async function main() {
  const to = arg("to"), from = arg("from");
  const endMs = to ? Date.parse(`${to}T23:59:59+01:00`) : Date.now();
  const startMs = from ? Date.parse(`${from}T00:00:00+01:00`) : endMs - 3 * 864e5;
  console.log(`${apply ? "Reconstruction" : "Simulation (rien n'est écrit ; --apply pour appliquer)"} du ${time(startMs)} au ${time(endMs)}.`);

  for (const account of await prisma.account.findMany({ where: { provider: "google" } })) {
    const uid = account.userId, token = await getValidAccessToken(account);
    let sessions;
    try { sessions = await fetchSessions(token, startMs, endMs); }
    catch (e) { console.log(`✗ Google refuse la lecture (${e instanceof Error ? e.message : e}). Lance « Synchroniser maintenant » dans l'appli puis relance.`); continue; }
    const existing = await loadExisting(uid, startMs, endMs);
    const acts = new Map((await prisma.activity.findMany({ where: { id: { in: existing.map((e) => e.id) } }, select: { id: true, type: true, title: true, distanceM: true, movingTimeS: true } })).map((a) => [a.id, a]));
    let n = 0;
    for (const s of sessions) {
      const plan = planSession(s, existing);
      if (plan.status === "exists") continue;
      const v = await sessionValues(token, s);
      if (plan.status === "create" && (await findOverlapping(uid, { startedAt: new Date(s.startMs), movingTimeS: v.movingS, elapsedTimeS: v.elapsedS })).length) continue; // déjà là via une autre source
      n++;
      console.log(`\n« ${s.name ?? "sans nom"} » (type Fit ${s.activityType}) · ${time(s.startMs)} → ${time(s.endMs)}`);
      console.log(`  → ${plan.ownId ? "activité de la session gardée" : "à créer"} : ${(v.distanceM / 1000).toFixed(2)} km, ${hms(v.movingS)} en mouvement, ${hms(v.elapsedS)} écoulé${v.hr ? `, FC ${v.hr.avg} / ${v.hr.max}` : ""}`);
      for (const id of plan.replaces) {
        const e = existing.find((x) => x.id === id)!, a = acts.get(id);
        console.log(`  ✗ remplacée puis supprimée : ${a?.type} « ${a?.title} » ${time(e.startMs)} → ${time(e.endMs)}, ${((a?.distanceM ?? 0) / 1000).toFixed(2)} km  (${id})`);
      }
      if (!apply) continue;
      const keep = plan.status === "replace" ? await rebuildFromSession(uid, s, plan, token) : await createFromSession(uid, s, v);
      if (plan.status === "create") await processActivity(keep);
      console.log(`  ✓ ${keep}`);
    }
    console.log(n ? "" : "Rien à reconstruire.");
  }
}
main().finally(() => prisma.$disconnect());
