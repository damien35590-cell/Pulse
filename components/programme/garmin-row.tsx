"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, RefreshCw, Watch } from "lucide-react";
import { sendProgramToIntervals, setGarminSync } from "@/app/actions";
import { Switch } from "@/components/ui/switch";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

const syncedLabel = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso));

/**
 * « Envoi sur Garmin » : une ligne, un interrupteur. Actif = les séances des 14 prochains jours partent dans Intervals.icu (→ montre), mises à jour chaque nuit ;
 * éteint = programme en pause (plus d'envoi, séances retirées de la montre). Le détail de la ligne garde « Renvoyer maintenant ».
 */
export function GarminRow({ programId, paused, syncedAt }: { programId: string; paused: boolean; syncedAt: string | null }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const router = useRouter();

  const toggle = (on: boolean) => start(async () => {
    const r = await setGarminSync(programId, on);
    setMsg(!r.ok ? { text: r.error, bad: true } : r.warning ? { text: r.warning, bad: true } : null);
    router.refresh();
  });
  const resend = () => { tap(); start(async () => {
    const r = await sendProgramToIntervals();
    setMsg(r.ok ? { text: "Séances renvoyées.", bad: false } : { text: r.error ?? "Envoi impossible.", bad: true });
    if (r.ok) router.refresh();
  }); };

  return (
    <section aria-label="Envoi sur Garmin" className={cn(ui.card, "px-4 py-1")}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-tile bg-surface-2 text-ink-soft"><Watch className="size-5" aria-hidden /></span>
        <Switch checked={!paused} disabled={pending} onChange={toggle} label="Envoi sur Garmin"
          description={paused ? "Programme en pause · aucun envoi" : "14 prochains jours · mis à jour chaque nuit"} className="flex-1" />
        <button type="button" aria-expanded={open} aria-label="Détail de l’envoi" onClick={() => { tap(6); setOpen(!open); }} className={cn(ui.iconBtn, "-mr-3 text-ink-mute")}>
          <ChevronDown className={cn("size-5 transition-transform duration-150", open && "rotate-180")} aria-hidden />
        </button>
      </div>
      {open && (
        <div className="space-y-2 pb-3">
          <p className="text-sm text-ink-soft">{syncedAt ? `Dernier envoi le ${syncedLabel(syncedAt)}.` : "Rien envoyé pour l’instant."} Les séances passent par Intervals.icu, puis arrivent sur ta montre.</p>
          <button type="button" disabled={pending || paused} onClick={resend} className={cn(ui.btnSecondary, "h-12 w-full")}>
            <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden />{pending ? "Envoi…" : "Renvoyer maintenant"}
          </button>
        </div>
      )}
      {msg && <p role={msg.bad ? "alert" : "status"} className={cn("pb-3 text-sm", msg.bad ? "font-semibold text-bad" : "text-ink-soft")}>{msg.text}</p>}
    </section>
  );
}
