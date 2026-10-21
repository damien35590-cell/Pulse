// Lancer avec : npx tsx tools/test-webpush.ts
// Web Push sans dépendance : JWT VAPID (RFC 8292) et chiffrement aes128gcm (RFC 8291), vérifiés en simulant le navigateur.
import assert from "node:assert/strict";
import { createDecipheriv, createECDH, randomBytes, verify } from "node:crypto";
import {
  b64u, deriveKeys, encryptPayload, fromB64u, generateVapidKeys, MAX_PAYLOAD, publicKeyObject, RECORD_SIZE,
  vapidAuthorization, vapidJwt, vapidKeysValid, VAPID_TTL_S,
} from "../lib/push/webpush";

/** Ce que fait le navigateur à la réception : relit l'en-tête RFC 8188, refait l'ECDH avec SA clé privée, dérive, déchiffre. */
function browserDecrypt(message: Uint8Array, uaPrivate: Uint8Array, authSecret: Uint8Array) {
  const m = Buffer.from(message);
  const salt = m.subarray(0, 16), rs = m.readUInt32BE(16), idlen = m.readUInt8(20);
  const asPublic = m.subarray(21, 21 + idlen), record = m.subarray(21 + idlen);
  assert.ok(record.length <= rs, "un seul enregistrement attendu");
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(uaPrivate);
  const uaPublic = ecdh.getPublicKey();
  const { cek, nonce } = deriveKeys({ ecdhSecret: ecdh.computeSecret(asPublic), authSecret, uaPublic, asPublic, salt });
  const d = createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(record.subarray(record.length - 16));
  const padded = Buffer.concat([d.update(record.subarray(0, record.length - 16)), d.final()]);
  // Retire le bourrage (zéros) puis le délimiteur : 0x02 = dernier enregistrement.
  let end = padded.length - 1;
  while (end >= 0 && padded[end] === 0) end--;
  assert.equal(padded[end], 2, "délimiteur de dernier enregistrement");
  return { text: padded.subarray(0, end).toString("utf8"), rs, asPublic };
}

// ── 1. Vecteur de test de la RFC 8291, annexe A ──
const V = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  ecdh: "kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs",
  prkKey: "Snr3JMxaHVDXHWJn5wdC52WjpCtd2EIEGBykDcZW32k",
  ikm: "S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg",
  prk: "09_eUZGrsvxChDCGRCdkLiDXrReGOEVeSCdCcPBSJSc",
  cek: "oIhVW04MRdy2XN9CiKLxTg",
  nonce: "4h_95klXJ5E_qnoN",
  message:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};
{
  const k = deriveKeys({
    ecdhSecret: fromB64u(V.ecdh), authSecret: fromB64u(V.auth), uaPublic: fromB64u(V.uaPublic), asPublic: fromB64u(V.asPublic), salt: fromB64u(V.salt),
  });
  assert.equal(b64u(k.prkKey), V.prkKey, "PRK_key");
  assert.equal(b64u(k.ikm), V.ikm, "IKM");
  assert.equal(b64u(k.prk), V.prk, "PRK");
  assert.equal(b64u(k.cek), V.cek, "CEK");
  assert.equal(b64u(k.nonce), V.nonce, "NONCE");

  const msg = encryptPayload(Buffer.from(V.plaintext), { p256dh: V.uaPublic, auth: V.auth }, { salt: fromB64u(V.salt), asPrivate: fromB64u(V.asPrivate) });
  assert.equal(b64u(msg), V.message, "message chiffré identique octet pour octet à la RFC 8291");
  const back = browserDecrypt(fromB64u(V.message), fromB64u(V.uaPrivate), fromB64u(V.auth));
  assert.equal(back.text, V.plaintext, "le message de la RFC se déchiffre");
  assert.equal(back.rs, RECORD_SIZE);
}

// ── 2. Aller-retour avec un « navigateur » tiré au hasard (sel et clé éphémère aléatoires) ──
{
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc:def", p256dh: b64u(ua.getPublicKey()), auth: b64u(randomBytes(16)) };
  const payload = JSON.stringify({ title: "Fractionné 8 × 400 m", body: "Meilleur créneau 12 h 30 · 11 °C · sec", url: "/itineraires?sport=RUN&minutes=50&session=intervals", tag: "coach" });
  const a = encryptPayload(Buffer.from(payload), sub), b = encryptPayload(Buffer.from(payload), sub);
  assert.notEqual(b64u(a), b64u(b), "sel et clé éphémère neufs à chaque envoi");
  assert.equal(a.length, 86 + Buffer.byteLength(payload) + 1 + 16, "en-tête 86 + texte + délimiteur + étiquette");
  for (const m of [a, b]) assert.equal(browserDecrypt(m, ua.getPrivateKey(), fromB64u(sub.auth)).text, payload, "accents et symboles intacts");

  // Mauvais secret auth : le déchiffrement doit échouer (étiquette GCM).
  assert.throws(() => browserDecrypt(a, ua.getPrivateKey(), randomBytes(16)));
  // Limites.
  assert.throws(() => encryptPayload(Buffer.alloc(MAX_PAYLOAD + 1), sub), /trop long/);
  assert.doesNotThrow(() => encryptPayload(Buffer.alloc(MAX_PAYLOAD), sub));
  assert.throws(() => encryptPayload(Buffer.from("x"), { p256dh: b64u(randomBytes(10)), auth: sub.auth }), /p256dh/);
}

// ── 3. Clés VAPID et JWT ES256 ──
{
  const keys = generateVapidKeys();
  assert.equal(fromB64u(keys.publicKey).length, 65);
  assert.equal(fromB64u(keys.privateKey).length, 32);
  assert.ok(vapidKeysValid(keys));
  assert.ok(!vapidKeysValid({ ...keys, publicKey: generateVapidKeys().publicKey }), "paire incohérente détectée");
  assert.ok(vapidKeysValid({ publicKey: V.asPublic, privateKey: V.asPrivate }), "clés de la RFC");

  const now = 1_790_000_000;
  const jwt = vapidJwt("https://fcm.googleapis.com", "mailto:moi@example.com", keys, now);
  const [h, p, s] = jwt.split(".");
  assert.deepEqual(JSON.parse(fromB64u(h).toString()), { typ: "JWT", alg: "ES256" });
  assert.deepEqual(JSON.parse(fromB64u(p).toString()), { aud: "https://fcm.googleapis.com", exp: now + VAPID_TTL_S, sub: "mailto:moi@example.com" });
  assert.ok(VAPID_TTL_S <= 24 * 3600, "RFC 8292 : 24 h maximum");
  const sig = fromB64u(s);
  assert.equal(sig.length, 64, "signature brute r ‖ s, pas DER");
  const pub = publicKeyObject(keys.publicKey);
  assert.ok(verify("sha256", Buffer.from(`${h}.${p}`), { key: pub, dsaEncoding: "ieee-p1363" }, sig), "le JWT se vérifie avec la clé publique");
  assert.ok(!verify("sha256", Buffer.from(`${h}.${p}x`), { key: pub, dsaEncoding: "ieee-p1363" }, sig), "charge modifiée : rejetée");
  assert.ok(!verify("sha256", Buffer.from(`${h}.${p}`), { key: publicKeyObject(generateVapidKeys().publicKey), dsaEncoding: "ieee-p1363" }, sig), "autre clé : rejetée");

  const auth = vapidAuthorization("https://updates.push.services.mozilla.com/wpush/v2/xyz?a=1", "mailto:moi@example.com", keys, now);
  const m = /^vapid t=([\w-]+\.[\w-]+\.[\w-]+), k=([\w-]+)$/.exec(auth);
  assert.ok(m, auth);
  assert.equal(m![2], keys.publicKey);
  assert.equal(JSON.parse(fromB64u(m![1].split(".")[1]).toString()).aud, "https://updates.push.services.mozilla.com", "audience = origine du service push");
}

console.log("test-webpush : OK");
