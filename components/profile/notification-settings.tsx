"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { Switch } from "@/components/ui/switch";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MORNING_TIMES, type AllPrefs, type Prefs } from "@/lib/notify/prefs";

type State = "loading" | "unsupported" | "nosw" | "denied" | "off" | "on";

const OPTIONS: { key: keyof Prefs; label: string; description: string }[] = [
  { key: "morning", label: "Coach du matin", description: "La séance du jour et le meilleur créneau météo" },
  { key: "reminder", label: "Rappel de séance", description: "Avant le créneau choisi, si la séance du programme n’est pas faite" },
  { key: "weekly", label: "Bilan du dimanche", description: "Le soir : sorties, km, temps, D+ et programme" },
];

/** « 06:00 » → « 6 h 00 » */
const fmtTime = (t: string) => `${Number(t.slice(0, 2))} h ${t.slice(3)}`;

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Le service worker est enregistré par next-pwa en production ; en développement il n'y en a pas. */
const swReady = (ms: number) =>
  Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

const keyBytes = (b64u: string) => {
  const raw = atob(b64u.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64u.length % 4)) % 4));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};
const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a || a.byteLength !== b.length) return false;
  const x = new Uint8Array(a);
  return x.every((v, i) => v === b[i]);
};

/** Abonne cet appareil avec la clé VAPID du serveur (réabonne si la clé a changé) et l'enregistre côté serveur. */
async function subscribe(reg: ServiceWorkerRegistration) {
  const r = await fetch("/api/push/key");
  if (!r.ok) throw new Error("Clé de notification indisponible");
  const key = keyBytes(((await r.json()) as { publicKey: string }).publicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) { await sub.unsubscribe().catch(() => false); sub = null; }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const s = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  if (!s.ok) throw new Error("Abonnement refusé par le serveur");
}

/** Vous › Notifications : activation sur cet appareil, trois interrupteurs, envoi d'un test. */
export function NotificationSettings({ prefs: initial }: { prefs: AllPrefs }) {
  const [state, setState] = useState<State>("loading");
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [pickTime, setPickTime] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const detect = useCallback(async () => {
    if (!supported()) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    const reg = await swReady(4000);
    if (!reg) return setState("nosw");
    const sub = await reg.pushManager.getSubscription();
    if (sub && Notification.permission === "granted") {
      setState("on");
      subscribe(reg).catch(() => null); // resynchronise le serveur (clé changée, base réinitialisée…)
    } else setState("off");
  }, []);

  useEffect(() => {
    detect();
    // Retour depuis les réglages Android après avoir débloqué les notifications.
    const onVis = () => { if (document.visibilityState === "visible") detect(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [detect]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : "Erreur inattendue"); } finally { setBusy(false); }
  };

  const enable = () => run(async () => {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
    const reg = await swReady(8000);
    if (!reg) { setState("nosw"); return; }
    await subscribe(reg);
    setState("on");
    setMsg("Notifications activées. Envoie un test pour vérifier.");
  });

  const disable = () => run(async () => {
    const reg = await swReady(4000), sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off");
    setMsg("Notifications désactivées sur cet appareil.");
  });

  const test = () => run(async () => {
    const r = await fetch("/api/push/test", { method: "POST" });
    const d = (await r.json().catch(() => ({}))) as { total?: number; sent?: number };
    if (!d.total) throw new Error("Aucun appareil abonné : active d’abord les notifications.");
    if (!d.sent) throw new Error("Le service de notification a refusé l’envoi. Désactive puis réactive les notifications.");
    setMsg(d.sent > 1 ? `Test envoyé sur ${d.sent} appareils.` : "Test envoyé : il arrive dans quelques secondes.");
  });

  const toggle = async (key: keyof Prefs, value: boolean) => {
    const before = prefs;
    setPrefs({ ...prefs, [key]: value }); setMsg(null);
    const r = await fetch("/api/push/prefs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) }).catch(() => null);
    if (!r?.ok) { setPrefs(before); setMsg("Réglage non enregistré, réessaie."); }
  };

  const chooseTime = async (time: string) => {
    const before = prefs.morningCoachTime;
    setPickTime(false);
    if (time === before) return;
    setPrefs({ ...prefs, morningCoachTime: time }); setMsg(null);
    const r = await fetch("/api/push/prefs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ morningCoachTime: time }) }).catch(() => null);
    if (!r?.ok) { setPrefs((p) => ({ ...p, morningCoachTime: before })); setMsg("Heure non enregistrée, réessaie."); }
  };

  const status: Record<State, { Icon: typeof Bell; title: string; text: string; tone?: string }> = {
    loading: { Icon: Bell, title: "Notifications", text: "Vérification…" },
    unsupported: { Icon: BellOff, title: "Non disponibles", text: "Ce navigateur ne gère pas les notifications push. Sur Android, ouvre Pulse dans Chrome ou depuis l’app installée.", tone: "text-ink-mute" },
    nosw: { Icon: BellOff, title: "Pas encore prêtes", text: "Le service worker de Pulse n’est pas actif. Recharge la page (en développement, il est désactivé).", tone: "text-warn" },
    denied: { Icon: BellOff, title: "Bloquées", text: "Pour les réactiver : appui long sur l’icône Pulse › Infos sur l’appli › Notifications (ou Chrome › ⋮ › Paramètres › Paramètres des sites › Notifications), puis reviens ici.", tone: "text-bad" },
    off: { Icon: Bell, title: "Désactivées", text: "Coach du matin, rappel avant ta séance et bilan du dimanche, directement sur ton téléphone.", tone: "text-ink-soft" },
    on: { Icon: BellRing, title: "Activées sur cet appareil", text: "Choisis ce que tu veux recevoir.", tone: "text-good" },
  };
  const s = status[state];

  return (
    <>
      <div className={cn(ui.card, "p-4")}>
        <div className="flex items-start gap-3">
          <span className={cn("grid size-12 shrink-0 place-items-center rounded-full bg-surface-2", s.tone)}><s.Icon className="size-6" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{s.title}</p>
            <p className="text-sm text-ink-soft">{s.text}</p>
          </div>
        </div>

        {state === "off" && <button type="button" onClick={enable} disabled={busy} className={cn(ui.btnPrimary, "mt-4 w-full")}>Activer les notifications</button>}
        {state === "nosw" && <button type="button" onClick={() => location.reload()} className={cn(ui.btnSecondary, "mt-4 w-full")}>Recharger</button>}

        <div className="mt-2 divide-y divide-line/60">
          {OPTIONS.map((o) => (
            <Switch key={o.key} label={o.label} description={o.description} checked={prefs[o.key]} onChange={(v) => toggle(o.key, v)} disabled={state !== "on"} />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPickTime(true)}
          disabled={!prefs.morning || state !== "on"}
          className="flex min-h-12 w-full touch-manipulation items-center justify-between gap-3 border-t border-line/60 py-2 text-left active:opacity-60 disabled:opacity-40"
        >
          <span className="font-medium text-ink">Heure du coach du matin</span>
          <span className="font-semibold tabular-nums text-ink-soft">{fmtTime(prefs.morningCoachTime)}</span>
        </button>

        {state === "on" && (
          <div className="mt-3 grid gap-2">
            <button type="button" onClick={test} disabled={busy} className={ui.btnSecondary}>Envoyer un test</button>
            <button type="button" onClick={disable} disabled={busy} className="min-h-12 touch-manipulation text-sm font-semibold text-ink-mute active:opacity-60 disabled:opacity-40">Désactiver sur cet appareil</button>
          </div>
        )}

        <p aria-live="polite" className={cn("text-sm text-ink-soft", msg ? "mt-3" : "sr-only")}>{msg}</p>
      </div>

      <BottomSheet open={pickTime} onClose={() => setPickTime(false)} title="Heure du coach du matin">
        <p className="mt-1 text-sm text-ink-soft">La notification part à cette heure (heure de Paris), ou juste après.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {MORNING_TIMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => chooseTime(t)}
              aria-pressed={t === prefs.morningCoachTime}
              className={cn(t === prefs.morningCoachTime ? ui.btnPrimary : cn(ui.btnSecondary, "bg-surface-3"), "tabular-nums")}
            >
              {fmtTime(t)}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
