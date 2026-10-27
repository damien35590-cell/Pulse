"use client";
/**
 * File d'envoi des séances de muscu non parties (réseau coupé, erreur serveur) : IndexedDB, sans expiration.
 * Une séance n'en sort qu'après une réponse 2xx de POST /api/activities, rejouable sans doublon grâce à son clientId.
 */
import { saveTemplate } from "@/app/(app)/record/session/actions";

const DB = "pulse-offline", STORE = "pending-uploads";
export const PENDING_EVENT = "pulse:pending-uploads";

export type Pending = {
  clientId: string;
  body: Record<string, unknown>;
  title: string;
  templateName?: string;
  createdAt: number;
  attempts: number;
  /** Prochain essai automatique (ms) ; « Renvoyer » et le retour du réseau l'ignorent. */
  nextAt: number;
  lastError?: string;
};

const BASE_MS = 15_000, MAX_MS = 30 * 60_000;
/** 15 s, 30 s, 1 min, 2 min… plafonné à 30 min, avec un peu de hasard. */
export const backoffMs = (attempts: number, rnd = Math.random()) => Math.round(Math.min(MAX_MS, BASE_MS * 2 ** Math.max(0, attempts - 1)) * (0.85 + rnd * 0.3));

export const newClientId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); });

function open(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "clientId" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((ok, ko) => {
      const t = db.transaction(STORE, mode), req = f(t.objectStore(STORE));
      t.oncomplete = () => ok(req.result);
      t.onerror = t.onabort = () => ko(t.error);
    });
  } finally { db.close(); }
}
const changed = () => { try { window.dispatchEvent(new Event(PENDING_EVENT)); } catch { /* */ } };

export const listPending = async (): Promise<Pending[]> => (await tx("readonly", (s) => s.getAll() as IDBRequest<Pending[]>)).sort((a, b) => a.createdAt - b.createdAt);
export const countPending = async () => (await tx("readonly", (s) => s.count()));
export async function enqueuePending(p: Omit<Pending, "createdAt" | "attempts" | "nextAt"> & Partial<Pick<Pending, "createdAt" | "attempts" | "nextAt">>) {
  await tx("readwrite", (s) => s.put({ createdAt: Date.now(), attempts: 0, nextAt: 0, ...p }));
  changed();
}
export async function removePending(clientId: string) {
  await tx("readwrite", (s) => s.delete(clientId));
  changed();
}

/** Le téléphone peut-il retenter ? Tout sauf une demande refusée pour de bon (4xx hors 408 / 425 / 429). */
export const isRetryable = (status: number) => status >= 500 || status === 408 || status === 425 || status === 429;

let busy = false;
async function exclusive<T>(f: () => Promise<T>): Promise<T | null> {
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request("pulse-pending-flush", { ifAvailable: true }, (l) => (l ? f() : null));
  if (busy) return null;
  busy = true;
  try { return await f(); } finally { busy = false; }
}

/**
 * Envoie les séances en attente. `force` ignore l'attente entre deux essais (retour du réseau, bouton « Renvoyer »).
 * Une séance n'est retirée qu'après une réponse 2xx ; sinon elle reste, avec un essai de plus et un délai doublé.
 */
export async function flushPending(force = false): Promise<{ sent: number; left: number; nextAt: number | null }> {
  const r = await exclusive(async () => {
    let sent = 0;
    for (const p of await listPending()) {
      if (!force && p.nextAt > Date.now()) continue;
      let err: string, offline = false;
      try {
        const res = await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p.body, clientId: p.clientId }) });
        if (res.ok) {
          const j = await res.json().catch(() => ({}));
          await removePending(p.clientId);
          sent++;
          if (p.templateName && j.id && !j.duplicate) await saveTemplate(j.id, p.templateName).catch(() => null);
          continue;
        }
        err = `HTTP ${res.status}`;
      } catch (e) {
        err = e instanceof Error ? e.message : "réseau";
        offline = true;
      }
      const attempts = p.attempts + 1;
      await enqueuePending({ ...p, attempts, nextAt: Date.now() + backoffMs(attempts), lastError: err });
      if (offline) break; // pas de réseau : inutile d'essayer les suivantes
    }
    const left = await listPending();
    return { sent, left: left.length, nextAt: left.length ? Math.min(...left.map((x) => x.nextAt)) : null };
  });
  return r ?? { sent: 0, left: await countPending().catch(() => 0), nextAt: null };
}
