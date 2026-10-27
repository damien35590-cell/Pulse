import { create } from "zustand";
import { canReconnectSilently, createHeartRateLink, type BleStatus, type HrLink } from "@/lib/ble/heart-rate";
import type { HrSample } from "@/lib/workout/hr";

/**
 * FC en direct pendant une séance de muscu : état de la ceinture + tampon d'échantillons (1 Hz au plus, secondes depuis le début de la séance).
 * Le tampon est copié dans localStorage toutes les ~10 s sous l'identifiant de la séance : un rechargement ou un plantage ne le perd pas.
 * Un seul tampon actif à la fois (la séance affichée). Aucune ceinture = le tampon reste vide et rien d'autre ne change.
 */
const KEY = "pulse-hr-v1:";
const FLUSH_MS = 10_000;
/** Les tampons de séances abandonnées sont purgés au démarrage de la suivante. */
const STALE_MS = 24 * 3600 * 1000;

type State = {
  status: BleStatus;
  /** Dernière mesure ; null sans signal. */
  bpm: number | null;
  battery: number | null;
  deviceName: string | null;
  error: string | null;
  sessionId: string | null;
  samples: HrSample[];
  /** Branche le tampon de la séance (le recharge s'il existe) et tente la reconnexion silencieuse à la dernière ceinture. */
  begin: (sessionId: string, startedAt: number) => void;
  /** Depuis un tap : ouvre le sélecteur Bluetooth. */
  connect: () => Promise<void>;
  /** Coupe la ceinture ; le tampon est conservé. */
  disconnect: () => void;
  /** Plus haute FC des `seconds` dernières secondes (début d'un repos), sinon la mesure courante. */
  recentPeak: (seconds: number) => number | null;
  /** Le composant se démonte : le tampon est copié, la ceinture coupée. La séance reste reprenable. */
  detach: () => void;
  /** La séance est terminée ou abandonnée : tampon effacé (mémoire et localStorage), ceinture coupée. */
  discard: () => void;
};

// Hors état : ces objets n'ont pas à déclencher de rendu.
let link: HrLink | null = null;
let startedAt = 0;
let lastT = -1;
let dirty = false;
let timer: ReturnType<typeof setInterval> | undefined;

const read = (id: string): HrSample[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY + id) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => Number.isFinite(x?.t) && Number.isFinite(x?.bpm)) : [];
  } catch { return []; }
};
const write = (id: string, samples: HrSample[]) => { try { localStorage.setItem(KEY + id, JSON.stringify(samples)); } catch { /* stockage indisponible ou plein */ } };
const drop = (id: string) => { try { localStorage.removeItem(KEY + id); } catch { /* */ } };

/** Efface le tampon d'une séance sans qu'elle soit affichée (séance abandonnée au profit d'une nouvelle). */
export const clearHrBuffer = (sessionId: string) => drop(sessionId);

function purgeStale(keep: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith(KEY) || k === KEY + keep) continue;
      const at = Number(k.slice(KEY.length)); // l'identifiant d'une séance est son début en ms
      if (!Number.isFinite(at) || Date.now() - at > STALE_MS) localStorage.removeItem(k);
    }
  } catch { /* */ }
}

export const useHeartRate = create<State>()((set, get) => {
  const flush = () => {
    const { sessionId, samples } = get();
    if (sessionId && dirty) { write(sessionId, samples); dirty = false; }
  };
  const onHide = () => { if (document.visibilityState === "hidden") flush(); };
  const stop = () => {
    clearInterval(timer); timer = undefined;
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", flush);
  };
  const ensureLink = () => (link ??= createHeartRateLink({
    onStatus: (status, info) => set((s) => ({ status, error: info?.error ?? null, deviceName: status === "idle" ? null : info?.name ?? s.deviceName })),
    onBattery: (battery) => set({ battery }),
    onBpm: (bpm) => {
      set({ bpm });
      const { sessionId } = get();
      if (bpm == null || !sessionId) return;
      const t = Math.floor((Date.now() - startedAt) / 1000);
      if (t <= lastT || t < 0) return; // 1 Hz au plus
      lastT = t;
      dirty = true;
      set((s) => ({ samples: [...s.samples, { t, bpm }] }));
    },
  }));

  return {
    status: "idle", bpm: null, battery: null, deviceName: null, error: null, sessionId: null, samples: [],

    begin(sessionId, start) {
      if (get().sessionId === sessionId) return;
      stop();
      startedAt = start;
      const samples = read(sessionId);
      lastT = samples.length ? samples[samples.length - 1].t : -1;
      dirty = false;
      purgeStale(sessionId);
      set({ sessionId, samples });
      timer = setInterval(flush, FLUSH_MS);
      document.addEventListener("visibilitychange", onHide);
      window.addEventListener("pagehide", flush);
      if (get().status === "idle" && canReconnectSilently()) void ensureLink().reconnectLast();
    },

    async connect() {
      await ensureLink().connect();
    },

    disconnect() {
      link?.disconnect();
    },

    recentPeak(seconds) {
      const { samples, bpm } = get();
      const from = Math.floor((Date.now() - startedAt) / 1000) - seconds;
      const recent = samples.filter((x) => x.t >= from);
      return recent.length ? Math.max(...recent.map((x) => x.bpm)) : bpm;
    },

    detach() {
      flush();
      stop();
      link?.disconnect();
      set({ sessionId: null, samples: [] });
    },

    discard() {
      const { sessionId } = get();
      if (sessionId) drop(sessionId);
      dirty = false;
      stop();
      link?.disconnect();
      set({ sessionId: null, samples: [] });
    },
  };
});
