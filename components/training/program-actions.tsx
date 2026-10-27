"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pause, Play, SkipForward } from "lucide-react";
import { completePlannedSession, saveVmaTest, skipPlannedSession, toggleProgramPause, updateVma } from "@/app/actions";
import { celebrate, tap } from "@/lib/haptics";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";

type Res = { ok: boolean; error?: string };
const btn = "flex min-h-12 items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:opacity-50";
const input = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base tabular-nums";

/** Lance une action serveur, affiche l'erreur éventuelle, puis rafraîchit la page. */
function useAction() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const run = (f: () => Promise<Res>, after?: () => void) => start(async () => {
    const r = await f();
    if (!r.ok) setErr(r.error ?? "Action impossible.");
    else { setErr(null); after?.(); router.refresh(); }
  });
  return { pending, err, run };
}

/** « Faite » / « Passer » sur la prochaine séance. */
export function SessionActions({ id, variant }: { id: string; variant?: "card" }) {
  const { pending, err, run } = useAction();
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[2fr_1fr] gap-2">
        <button disabled={pending} onClick={() => { tap(); run(() => completePlannedSession(id), celebrate); }} className={variant === "card" ? ui.btnSecondary : cn(btn, "bg-brand text-brand-ink")}>
          <Check className="h-5 w-5" aria-hidden />Faite
        </button>
        <button disabled={pending} onClick={() => { tap(); run(() => skipPlannedSession(id)); }} className={variant === "card" ? cn(ui.btnSecondary, "bg-transparent text-ink-soft") : cn(btn, "border border-line bg-surface text-ink-soft")}>
          <SkipForward className="h-4 w-4" aria-hidden />Passer
        </button>
      </div>
      {err && <p role="alert" className="text-sm font-semibold">{err}</p>}
    </div>
  );
}

export function PauseToggle({ id, paused, full }: { id: string; paused: boolean; full?: boolean }) {
  const { pending, err, run } = useAction();
  const Icon = paused ? Play : Pause;
  return (
    <>
      <button disabled={pending} onClick={() => { tap(); run(() => toggleProgramPause(id)); }}
        className={cn(btn, full ? "w-full" : "px-4", paused ? "bg-brand text-brand-ink" : "border border-line bg-surface text-ink-soft")}>
        <Icon className="h-4 w-4" aria-hidden />{paused ? "Reprendre le programme" : "Mettre en pause"}
      </button>
      {err && <p role="alert" className="text-sm font-semibold">{err}</p>}
    </>
  );
}

/** Après le demi-Cooper : distance en 6 minutes → VMA. Les allures de toutes les séances suivantes suivent. */
export function VmaTestPrompt({ sessionId }: { sessionId: string }) {
  const { pending, err, run } = useAction();
  const [m, setM] = useState("");
  // Une fois enregistrée, la carte disparaît et la nouvelle VMA s'affiche avec les allures recalculées.
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => saveVmaTest(sessionId, Number(m.replace(/\s/g, ""))), celebrate); }}
      className="space-y-2 rounded-xl border border-brand/40 bg-brand/5 p-3">
      <label className="block text-sm font-semibold" htmlFor={`cooper-${sessionId}`}>Test VMA bouclé 💪 Distance parcourue en 6 minutes (m)</label>
      <div className="flex gap-2">
        <input id={`cooper-${sessionId}`} value={m} onChange={(e) => setM(e.target.value)} inputMode="numeric" placeholder="ex. 1450" className={input} />
        <button disabled={pending || !m} className={cn(btn, "shrink-0 bg-brand px-4 text-brand-ink")}>{pending ? "…" : "Valider"}</button>
      </div>
      {m && Number(m) >= 800 && Number(m) <= 2500 && <p className="text-xs text-ink-soft">Soit une VMA de {fmtNum(Math.round(Number(m) / 10) / 10)} km/h</p>}
      {err && <p role="alert" className="text-sm font-semibold">{err}</p>}
    </form>
  );
}

/** Ligne VMA de la couverture : « VMA 15 km/h · test » + « Mettre à jour » (saisie d'une valeur connue : test récent, course…). */
export function VmaRow({ vmaKmh, label }: { vmaKmh: number; label: string }) {
  const { pending, err, run } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(String(vmaKmh).replace(".", ","));
  return (
    <div>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-ink-soft">VMA <b className="font-num text-base font-semibold tabular-nums text-ink">{fmtNum(vmaKmh)} km/h</b> · {label}</p>
        {!open && <button type="button" onClick={() => { tap(); setOpen(true); }} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-brand">Mettre à jour</button>}
      </div>
      {open && (
        <form onSubmit={(e) => { e.preventDefault(); run(() => updateVma(parseFloat(v.replace(",", "."))), () => setOpen(false)); }} className="space-y-2 pb-1">
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">VMA en km/h</span>
              <input value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" autoFocus className={cn(input, "pr-14")} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">km/h</span>
            </label>
            <button disabled={pending} className={cn(btn, "shrink-0 bg-surface-3 px-4 text-ink")}>{pending ? "…" : "Enregistrer"}</button>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 text-sm text-ink-soft">Annuler</button>
          {err && <p role="alert" className="text-sm font-semibold">{err}</p>}
        </form>
      )}
    </div>
  );
}
