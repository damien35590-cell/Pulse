"use client";
import { useEffect } from "react";

/**
 * Garde l'écran allumé tant que `active` (Wake Lock API, Chrome Android) : téléphone posé au sol pendant une séance, avec une ceinture cardio
 * qui n'a plus d'intérêt si l'écran s'éteint. Le navigateur libère le verrou quand la page passe en arrière-plan : on le reprend au retour.
 * Sans effet si l'API n'existe pas ou refuse (économiseur de batterie).
 */
export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !navigator.wakeLock) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      if (stopped || lock || document.visibilityState !== "visible") return;
      try {
        const l = await navigator.wakeLock.request("screen");
        if (stopped) return void l.release().catch(() => null);
        lock = l;
        l.addEventListener("release", () => { if (lock === l) lock = null; });
      } catch { /* refusé : batterie faible, onglet masqué… */ }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void acquire(); };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => null);
      lock = null;
    };
  }, [active]);
}
