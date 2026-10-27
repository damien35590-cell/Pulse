"use client";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { bleSupported } from "@/lib/ble/heart-rate";
import { bounds, HR_PCT, zoneIndex } from "@/lib/zones";
import { ZONE_TEXT, type ZoneId } from "@/components/activity/zone-bar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Metric } from "@/components/ui/metric";
import { useHeartRate } from "@/stores/heart-rate";

/** Classe `text-z1`…`text-z6` de la FC courante d'après la FC max de l'utilisateur ; neutre si elle est inconnue. */
export function zoneText(bpm: number | null, hrMax?: number | null) {
  return bpm != null && hrMax ? ZONE_TEXT[(zoneIndex(bpm, bounds(hrMax, HR_PCT)) + 1) as ZoneId] : "text-ink";
}

const BUSY = ["connecting", "reconnecting"];

/**
 * Pastille FC de l'en-tête du SetLogger : cœur + bpm aux couleurs des zones. Déconnectée, un tap ouvre le sélecteur Bluetooth ;
 * sinon il ouvre la feuille (appareil, batterie, déconnecter). Cachée si le navigateur n'a pas Web Bluetooth.
 */
export function HrPill({ hrMax }: { hrMax?: number | null }) {
  const { status, bpm, battery, deviceName, error, connect, disconnect } = useHeartRate();
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setSupported(bleSupported()), []);
  useEffect(() => { if (status === "idle") setOpen(false); }, [status]);
  if (!supported) return null;

  const live = status === "connected", busy = BUSY.includes(status);
  const label = live ? `Fréquence cardiaque ${bpm ?? "sans signal"}${bpm ? " battements par minute" : ""}` : busy ? "Ceinture cardio : connexion en cours" : "Connecter une ceinture cardio";

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => { tap(10); if (status === "idle" || status === "error") void connect(); else setOpen(true); }}
        className="grid h-12 min-w-12 shrink-0 select-none touch-manipulation place-items-center rounded-full transition duration-150 ease-snappy active:scale-95"
      >
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-2.5">
          <Heart className={cn("size-4", live ? zoneText(bpm, hrMax) : status === "error" ? "text-bad" : "text-ink-mute", busy && "animate-pulse")} fill={live && bpm ? "currentColor" : "none"} aria-hidden />
          {live || busy
            ? <span className={cn("min-w-[1.75rem] text-center font-num text-sm font-semibold tabular-nums", live ? zoneText(bpm, hrMax) : "text-ink-mute")}>{live && bpm ? bpm : "–"}</span>
            : <span className="text-xs font-semibold text-ink-mute">FC</span>}
        </span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Ceinture cardio">
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 min-w-0">
            <dt className={ui.label}>Appareil</dt>
            <dd className="mt-1 truncate font-semibold">{deviceName ?? "—"}</dd>
          </div>
          <Metric size="lg" label="Fréquence" value={live && bpm ? bpm : "–"} unit="bpm" />
          <Metric size="lg" label="Batterie" value={battery ?? "–"} unit={battery != null ? "%" : undefined} />
        </dl>
        {busy && <p className="mt-3 text-sm text-ink-soft">{status === "reconnecting" ? "Connexion perdue : reconnexion en cours. La mesure reprend dès que la ceinture répond." : "Connexion à la ceinture…"}</p>}
        {live && !bpm && <p className="mt-3 text-sm text-ink-soft">Pas de signal : la ceinture doit toucher la peau (mouille les électrodes).</p>}
        {error && <p role="alert" className="mt-3 text-sm font-medium text-bad">{error}</p>}
        <div className="mt-6 grid gap-2">
          {status === "error" && <button type="button" onClick={() => { setOpen(false); void connect(); }} className={cn(ui.btnPrimary, "w-full")}>Réessayer</button>}
          <button type="button" onClick={() => { tap(10); disconnect(); setOpen(false); }} className={cn(ui.btnSecondary, "w-full", status !== "error" && "bg-surface-3")}>
            {live ? "Déconnecter la ceinture" : busy ? "Annuler" : "Fermer"}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
