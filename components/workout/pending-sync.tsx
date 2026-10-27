"use client";
import { useEffect } from "react";
import { flushPending } from "@/lib/workout/pending-uploads";

/** Renvoie les séances en attente : au lancement, au retour du réseau, quand l'app revient au premier plan, et à l'échéance du délai d'attente. Sans rendu. */
export function PendingSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined, dead = false;
    const run = async (force: boolean) => {
      clearTimeout(timer);
      try {
        const r = await flushPending(force);
        if (!dead && r.left && r.nextAt != null) timer = setTimeout(() => run(false), Math.max(5_000, r.nextAt - Date.now()));
      } catch { /* IndexedDB indisponible : rien à renvoyer */ }
    };
    const online = () => run(true), visible = () => { if (document.visibilityState === "visible") run(false); };
    run(false);
    addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => { dead = true; clearTimeout(timer); removeEventListener("online", online); document.removeEventListener("visibilitychange", visible); };
  }, []);
  return null;
}
