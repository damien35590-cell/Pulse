/**
 * Ceinture cardio Bluetooth (service standard Heart Rate 0x180D) via Web Bluetooth : Chrome Android, PWA installée, HTTPS.
 * Ce module ne connaît ni React ni le store : il pousse ses événements dans `HrHandlers` (stores/heart-rate.ts les branche).
 * `parseHeartRate` est pur (tests : tools/test-heart-rate.ts).
 */

export type BleStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export type HrHandlers = {
  onStatus: (status: BleStatus, info?: { name?: string; error?: string }) => void;
  /** null = capteur sans contact (la ceinture envoie 0). */
  onBpm: (bpm: number | null) => void;
  onBattery: (pct: number | null) => void;
};

/** Pause avant chaque nouvel essai de reconnexion silencieuse (ms) : 5 essais, puis erreur. */
export const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];
/** Attente d'une annonce de la ceinture quand on se reconnecte à un appareil déjà autorisé (hors reconnexion après coupure). */
const ADVERT_WAIT_MS = 12000;
const LAST_KEY = "pulse-hr-device";

/** Web Bluetooth existe (Chrome Android / bureau, contexte sécurisé). Sinon l'interface cache le bouton. */
export const bleSupported = () => typeof navigator !== "undefined" && !!navigator.bluetooth;

/**
 * Mesure du service Heart Rate (0x2A37) : l'octet de drapeaux dit le format ; bit 0 = FC en 16 bits (petit-boutiste), sinon 8 bits.
 * Les intervalles RR éventuels qui suivent sont ignorés. Null hors plage (0 = ceinture sans contact avec la peau).
 */
export function parseHeartRate(dv: DataView): number | null {
  if (dv.byteLength < 2) return null;
  const bpm = dv.getUint8(0) & 0x01 ? (dv.byteLength >= 3 ? dv.getUint16(1, true) : 0) : dv.getUint8(1);
  return bpm >= 30 && bpm <= 250 ? bpm : null;
}

type Last = { id: string; name: string };
const readLast = (): Last | null => {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null");
    return typeof v?.id === "string" ? { id: v.id, name: String(v.name ?? "") } : null;
  } catch { return null; }
};
const writeLast = (d: BluetoothDevice) => { try { localStorage.setItem(LAST_KEY, JSON.stringify({ id: d.id, name: d.name ?? "" })); } catch { /* stockage indisponible */ } };

/** Un appareil déjà autorisé est mémorisé et `getDevices` existe : on peut se reconnecter sans rouvrir le sélecteur. */
export const canReconnectSilently = () => bleSupported() && typeof navigator.bluetooth.getDevices === "function" && readLast() != null;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type HrLink = {
  /** Ouvre le sélecteur du navigateur : à appeler depuis un tap. */
  connect: () => Promise<void>;
  /** Reconnexion silencieuse au dernier appareil (pas de sélecteur). Renvoie false s'il n'y en a pas ou s'il est introuvable. */
  reconnectLast: () => Promise<boolean>;
  /** Coupe la connexion, sans reconnexion automatique. */
  disconnect: () => void;
};

export function createHeartRateLink(h: HrHandlers): HrLink {
  let device: BluetoothDevice | null = null;
  let chr: BluetoothRemoteGATTCharacteristic | null = null;
  let wanted = false; // faux après disconnect() : une coupure n'est plus à rattraper
  let run = 0; // invalide les essais en cours quand une nouvelle connexion démarre ou qu'on coupe

  const onValue = (e: Event) => {
    const dv = (e.target as BluetoothRemoteGATTCharacteristic).value;
    if (dv) h.onBpm(parseHeartRate(dv));
  };

  /** GATT → service FC → notifications ; batterie en option (jamais bloquante). */
  async function attach(d: BluetoothDevice, id: number) {
    const server = await d.gatt!.connect();
    if (id !== run) { server.disconnect(); return; }
    const svc = await server.getPrimaryService("heart_rate");
    const c = await svc.getCharacteristic("heart_rate_measurement");
    c.removeEventListener("characteristicvaluechanged", onValue);
    c.addEventListener("characteristicvaluechanged", onValue);
    await c.startNotifications();
    chr = c;
    writeLast(d);
    h.onStatus("connected", { name: d.name ?? "Ceinture cardio" });
    try {
      const bat = await (await server.getPrimaryService("battery_service")).getCharacteristic("battery_level");
      h.onBattery((await bat.readValue()).getUint8(0));
    } catch { h.onBattery(null); /* pas de service batterie, ou non autorisé */ }
  }

  async function onDrop() {
    if (!wanted || !device || device.gatt?.connected) return;
    const d = device, id = run;
    h.onBpm(null);
    for (const delay of RECONNECT_DELAYS_MS) {
      h.onStatus("reconnecting", { name: d.name ?? undefined });
      await sleep(delay);
      if (!wanted || id !== run) return;
      try { await attach(d, id); return; } catch { /* nouvel essai */ }
    }
    if (wanted && id === run) h.onStatus("error", { name: d.name ?? undefined, error: "Ceinture introuvable. Vérifie qu’elle est bien portée, puis reconnecte-la." });
  }

  function adopt(d: BluetoothDevice) {
    device?.removeEventListener("gattserverdisconnected", onDrop);
    device = d;
    d.addEventListener("gattserverdisconnected", onDrop);
    wanted = true;
  }

  /** Annonce de la ceinture attendue avant de se connecter à un appareil mémorisé (elle n'émet que portée). */
  async function waitAdvert(d: BluetoothDevice, id: number) {
    if (typeof d.watchAdvertisements !== "function") return;
    const ctl = new AbortController();
    const seen = new Promise<void>((ok) => d.addEventListener("advertisementreceived", () => ok(), { once: true }));
    try {
      await d.watchAdvertisements({ signal: ctl.signal });
      await Promise.race([seen, sleep(ADVERT_WAIT_MS)]);
    } finally { ctl.abort(); }
    if (id !== run) throw new Error("annulé");
  }

  return {
    async connect() {
      if (!bleSupported()) return;
      const id = ++run;
      h.onStatus("connecting");
      try {
        const d = await navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }], optionalServices: ["battery_service"] });
        if (id !== run) return;
        adopt(d);
        h.onStatus("connecting", { name: d.name ?? undefined });
        await attach(d, id);
      } catch (e) {
        if (id !== run) return;
        wanted = false;
        // Sélecteur fermé sans choix : pas une erreur.
        if (e instanceof DOMException && e.name === "NotFoundError") return h.onStatus("idle");
        h.onStatus("error", { error: e instanceof DOMException && e.name === "SecurityError" ? "Bluetooth refusé par le navigateur." : "Connexion impossible. Allume la ceinture (elle doit toucher la peau) et réessaie." });
      }
    },

    async reconnectLast() {
      const last = canReconnectSilently() ? readLast() : null;
      if (!last) return false;
      const id = ++run;
      h.onStatus("connecting", { name: last.name || undefined });
      try {
        const d = (await navigator.bluetooth.getDevices()).find((x) => x.id === last.id);
        if (!d) { h.onStatus("idle"); return false; }
        adopt(d);
        await waitAdvert(d, id);
        await attach(d, id);
        return true;
      } catch {
        if (id === run) { wanted = false; h.onStatus("idle"); } // silencieux : le bouton de l'en-tête rouvrira le sélecteur
        return false;
      }
    },

    disconnect() {
      wanted = false;
      run++;
      chr?.removeEventListener("characteristicvaluechanged", onValue);
      chr?.stopNotifications().catch(() => null);
      chr = null;
      device?.removeEventListener("gattserverdisconnected", onDrop);
      if (device?.gatt?.connected) device.gatt.disconnect();
      device = null;
      h.onBpm(null);
      h.onBattery(null);
      h.onStatus("idle");
    },
  };
}
