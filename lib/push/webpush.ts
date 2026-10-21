/**
 * Web Push écrit à la main, sans dépendance (node:crypto uniquement) :
 * - VAPID (RFC 8292) : jeton JWT ES256 signé avec la clé privée de l'app, envoyé dans « Authorization: vapid t=…, k=… » ;
 * - chiffrement du message (RFC 8291 + RFC 8188, « aes128gcm ») : ECDH P-256 avec la clé du navigateur, HKDF-SHA-256, un seul enregistrement.
 * Aucun accès base ni réseau ici, sauf sendWebPush() (fetch). Tests : tools/test-webpush.ts (vecteur de la RFC 8291, annexe A).
 */
import { createCipheriv, createECDH, createHmac, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, type KeyObject } from "node:crypto";

// ───────── base64url ─────────
export const b64u = (b: Uint8Array) => Buffer.from(b).toString("base64url");
export const fromB64u = (s: string) => Buffer.from(s.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"), "base64url");

// ───────── Clés VAPID ─────────
/** Paire VAPID au format habituel (celui de la bibliothèque web-push) : publique = point non compressé (65 octets), privée = d (32 octets), en base64url. */
export type VapidKeys = { publicKey: string; privateKey: string };

export function generateVapidKeys(): VapidKeys {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  const pub = Buffer.concat([Buffer.from([4]), fromB64u(jwk.x!), fromB64u(jwk.y!)]);
  return { publicKey: b64u(pub), privateKey: b64u(fromB64u(jwk.d!)) };
}

/** Coordonnées x, y d'un point P-256 non compressé (0x04 ‖ x ‖ y). */
function xy(pub: Uint8Array) {
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("clé publique P-256 invalide (65 octets attendus, 0x04 en tête)");
  return { x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) };
}
export const vapidPrivateKeyObject = (k: VapidKeys): KeyObject =>
  createPrivateKey({ format: "jwk", key: { kty: "EC", crv: "P-256", d: b64u(fromB64u(k.privateKey)), ...xy(fromB64u(k.publicKey)) } });
export const publicKeyObject = (publicKey: string): KeyObject =>
  createPublicKey({ format: "jwk", key: { kty: "EC", crv: "P-256", ...xy(fromB64u(publicKey)) } });

/** Vérifie qu'une paire est cohérente (la clé publique correspond bien à la privée). */
export function vapidKeysValid(k: VapidKeys) {
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(fromB64u(k.privateKey));
    return ecdh.getPublicKey().equals(fromB64u(k.publicKey));
  } catch {
    return false;
  }
}

// ───────── JWT VAPID (RFC 8292) ─────────
/** Durée de validité du jeton : 12 h (la RFC plafonne à 24 h). */
export const VAPID_TTL_S = 12 * 3600;

/** Jeton ES256 : en-tête.charge.signature, signature brute r ‖ s (64 octets, pas de DER). */
export function vapidJwt(audience: string, subject: string, keys: VapidKeys, nowS = Math.floor(Date.now() / 1000)) {
  const enc = (o: object) => b64u(Buffer.from(JSON.stringify(o)));
  const data = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud: audience, exp: nowS + VAPID_TTL_S, sub: subject })}`;
  const sig = sign("sha256", Buffer.from(data), { key: vapidPrivateKeyObject(keys), dsaEncoding: "ieee-p1363" });
  return `${data}.${b64u(sig)}`;
}

/** En-tête Authorization pour un abonnement : l'audience est l'origine du service push (https://fcm.googleapis.com…). */
export function vapidAuthorization(endpoint: string, subject: string, keys: VapidKeys, nowS?: number) {
  return `vapid t=${vapidJwt(new URL(endpoint).origin, subject, keys, nowS)}, k=${keys.publicKey}`;
}

// ───────── Chiffrement aes128gcm (RFC 8291 / 8188) ─────────
export type PushSubscriptionKeys = { endpoint: string; p256dh: string; auth: string };

/** Taille d'enregistrement annoncée (RFC 8188) ; le message entier tient dans un seul enregistrement. */
export const RECORD_SIZE = 4096;
/** En-tête : sel 16 + rs 4 + idlen 1 + clé publique éphémère 65 = 86 octets ; puis étiquette GCM 16 octets et délimiteur 1 octet. */
export const MAX_PAYLOAD = RECORD_SIZE - 86 - 16 - 1;

const hmac = (key: Uint8Array, ...data: Uint8Array[]) => {
  const h = createHmac("sha256", key);
  for (const d of data) h.update(d);
  return h.digest();
};
const txt = (s: string) => Buffer.from(s, "utf8");
const ONE = Buffer.from([1]), ZERO = Buffer.from([0]);

/**
 * Dérivation commune (chiffrement côté serveur ET déchiffrement côté navigateur) :
 * IKM = HKDF(auth, ecdh, "WebPush: info" ‖ 0 ‖ ua_public ‖ as_public), puis CEK (16) et NONCE (12) depuis le sel.
 * Chaque HKDF ne produit ici qu'un bloc (≤ 32 octets) : expand = HMAC(PRK, info ‖ 0x01) tronqué.
 */
export function deriveKeys(p: { ecdhSecret: Uint8Array; authSecret: Uint8Array; uaPublic: Uint8Array; asPublic: Uint8Array; salt: Uint8Array }) {
  const prkKey = hmac(p.authSecret, p.ecdhSecret);
  const keyInfo = Buffer.concat([txt("WebPush: info"), ZERO, p.uaPublic, p.asPublic]);
  const ikm = hmac(prkKey, keyInfo, ONE);
  const prk = hmac(p.salt, ikm);
  const cek = hmac(prk, txt("Content-Encoding: aes128gcm"), ZERO, ONE).subarray(0, 16);
  const nonce = hmac(prk, txt("Content-Encoding: nonce"), ZERO, ONE).subarray(0, 12);
  return { prkKey, keyInfo, ikm, prk, cek, nonce };
}

/**
 * Chiffre `plaintext` pour un abonnement. `salt` et `asPrivate` (clé éphémère du serveur) ne sont fournis
 * que par les tests (vecteur de la RFC) ; sinon tirés au hasard à chaque message.
 */
export function encryptPayload(plaintext: Uint8Array, sub: Pick<PushSubscriptionKeys, "p256dh" | "auth">, opts: { salt?: Uint8Array; asPrivate?: Uint8Array } = {}) {
  if (plaintext.length > MAX_PAYLOAD) throw new Error(`message trop long pour Web Push (${plaintext.length} > ${MAX_PAYLOAD} octets)`);
  const uaPublic = fromB64u(sub.p256dh), authSecret = fromB64u(sub.auth);
  if (uaPublic.length !== 65) throw new Error("clé p256dh de l'abonnement invalide");
  if (authSecret.length !== 16) throw new Error("secret auth de l'abonnement invalide");
  const ecdh = createECDH("prime256v1");
  if (opts.asPrivate) ecdh.setPrivateKey(opts.asPrivate); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(uaPublic);
  const salt = opts.salt ? Buffer.from(opts.salt) : randomBytes(16);
  const { cek, nonce } = deriveKeys({ ecdhSecret, authSecret, uaPublic, asPublic, salt });

  // Enregistrement unique (donc le dernier) : texte ‖ 0x02, sans bourrage.
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

// ───────── Envoi ─────────
export type PushResult = { status: number; ok: boolean; /** 404 / 410 : l'abonnement n'existe plus, à supprimer. */ gone: boolean; body?: string };
export type PushOptions = { ttl: number; urgency?: "very-low" | "low" | "normal" | "high"; /** Remplace un message encore en attente sur le service push (≤ 32 car. base64url). */ topic?: string };

export async function sendWebPush(sub: PushSubscriptionKeys, payload: string, keys: VapidKeys, subject: string, o: PushOptions): Promise<PushResult> {
  const body = new Uint8Array(encryptPayload(txt(payload), sub)); // Uint8Array<ArrayBuffer> : accepté tel quel comme corps de fetch
  const headers: Record<string, string> = {
    Authorization: vapidAuthorization(sub.endpoint, subject, keys),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(Math.max(0, Math.round(o.ttl))),
    Urgency: o.urgency ?? "normal",
  };
  if (o.topic) headers.Topic = o.topic;
  const r = await fetch(sub.endpoint, { method: "POST", headers, body, signal: AbortSignal.timeout(15000) });
  const text = r.ok ? undefined : (await r.text().catch(() => "")).slice(0, 300);
  return { status: r.status, ok: r.ok, gone: r.status === 404 || r.status === 410, body: text };
}
