/**
 * Paire VAPID de l'app : VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY si elles sont dans l'environnement,
 * sinon générée au premier besoin et gardée en base (table AppSecret). La clé privée n'est jamais journalisée ni renvoyée au client.
 */
import { prisma } from "@/lib/prisma";
import { generateVapidKeys, vapidKeysValid, type VapidKeys } from "./webpush";

const KEY = "vapid";
let cached: VapidKeys | null = null;

export async function getVapidKeys(): Promise<VapidKeys> {
  if (cached) return cached;
  const env = { publicKey: process.env.VAPID_PUBLIC_KEY?.trim() ?? "", privateKey: process.env.VAPID_PRIVATE_KEY?.trim() ?? "" };
  if (env.publicKey && env.privateKey) {
    if (!vapidKeysValid(env)) throw new Error("VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY ne forment pas une paire P-256 valide");
    return (cached = env);
  }

  const read = async () => {
    const row = await prisma.appSecret.findUnique({ where: { key: KEY } });
    if (!row) return null;
    try {
      const k = JSON.parse(row.value) as VapidKeys;
      if (vapidKeysValid(k)) return k;
    } catch { /* ligne illisible : on régénère */ }
    console.error("[push] paire VAPID en base invalide : régénération (les abonnements existants devront être refaits)");
    await prisma.appSecret.delete({ where: { key: KEY } }).catch(() => null);
    return null;
  };
  const existing = await read();
  if (existing) return (cached = existing);

  // Création : si deux requêtes arrivent en même temps, la seconde échoue sur la clé primaire et relit la première.
  const fresh = generateVapidKeys();
  try {
    await prisma.appSecret.create({ data: { key: KEY, value: JSON.stringify(fresh) } });
    console.log("[push] nouvelle paire VAPID générée et stockée en base");
    return (cached = fresh);
  } catch {
    const again = await read();
    if (!again) throw new Error("impossible de créer la paire VAPID");
    return (cached = again);
  }
}

/** « sub » du JWT VAPID : un contact pour l'opérateur du service push. */
export function vapidSubject() {
  const s = process.env.VAPID_SUBJECT?.trim();
  if (s && /^(mailto:|https:)/.test(s)) return s;
  const email = process.env.ALLOWED_EMAIL?.trim();
  if (email) return `mailto:${email}`;
  const url = process.env.NEXTAUTH_URL?.trim();
  return url?.startsWith("https:") ? url : "mailto:pulse@example.com";
}
