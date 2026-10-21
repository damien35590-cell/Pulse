/** Envoi d'une notification à tous les appareils abonnés d'un utilisateur (côté serveur). */
import { prisma } from "@/lib/prisma";
import type { PushMessage } from "@/lib/notify/content";
import { getVapidKeys, vapidSubject } from "./vapid";
import { sendWebPush, type PushOptions } from "./webpush";

export type SendReport = { total: number; sent: number; removed: number; errors: string[] };

export async function sendToUser(userId: string, msg: PushMessage, o: PushOptions): Promise<SendReport> {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const out: SendReport = { total: subs.length, sent: 0, removed: 0, errors: [] };
  if (!subs.length) return out;
  const [keys, subject] = [await getVapidKeys(), vapidSubject()];
  // Charge utile lue par le service worker (worker/index.ts) : titre, texte, lien, étiquette de remplacement.
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.tag });

  await Promise.all(subs.map(async (s) => {
    const host = (() => { try { return new URL(s.endpoint).host; } catch { return "?"; } })();
    try {
      const r = await sendWebPush(s, payload, keys, subject, o);
      if (r.ok) {
        out.sent++;
        await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastOkAt: new Date() } }).catch(() => null);
      } else if (r.gone) {
        out.removed++;
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => null);
        console.log(`[push] abonnement expiré supprimé (${host}, ${r.status})`);
      } else {
        out.errors.push(`${host} : ${r.status} ${r.body ?? ""}`.trim());
      }
    } catch (e) {
      out.errors.push(`${host} : ${e instanceof Error ? e.message : String(e)}`);
    }
  }));
  if (out.errors.length) console.error("[push] échecs d'envoi", out.errors);
  return out;
}
