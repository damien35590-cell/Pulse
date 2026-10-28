"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pause, Play, SkipForward, Unlink } from "lucide-react";
import { ConfirmSheet } from "@/components/ui/bottom-sheet";
import { completePlannedSession, detachPlannedSession, saveVmaTest, skipPlannedSession, toggleProgramPause, updateVma } from "@/app/actions";
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

/** « Détacher cette sortie » : la séance repasse à faire, la sortie garde ses données et ne sera plus reliée automatiquement à cette séance. */
export function DetachSession({ sessionId, className }: { sessionId: string; className?: string }) {
  const { pending, err, run } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" disabled={pending} onClick={() => { tap(); setOpen(true); }} className={cn("inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-soft disabled:opacity-50", className)}>
        <Unlink className="size-4" aria-hidden />Détacher cette sortie
      </button>
      {err && <p role="alert" className="text-sm font-semibold text-bad">{err}</p>}
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => { tap(10); run(() => detachPlannedSession(sessionId)); }}
        title="Détacher cette sortie ?"
        message="La séance repasse à faire. La sortie garde toutes ses données et ne sera plus reliée automatiquement à cette séance."
        confirmLabel="Détacher"
      />
    </>
  );
}

/**
 * Muscu du jour sur la carte d'accueil : « Démarrer la séance » (même départ que le « + » : la suggestion du jour, déjà préparée)
 * et « Passer ». Aucune séance de muscu n'existe en base à passer : « Passer » est mémorisé pour la journée dans le navigateur.
 */
export function LiftActions() {
  const key = `pulse-lift-skip-${new Date().toLocaleDateString("sv-SE")}`;
  const [skipped, setSkipped] = useState(false);
  useEffect(() => { try { setSkipped(localStorage.getItem(key) === "1"); } catch { /* stockage indisponible */ } }, [key]);
  if (skipped) return <p className="mt-4 text-sm text-ink-mute">Séance passée pour aujourd’hui.</p>;
  return (
    <div className="mt-5 grid grid-cols-[2fr_1fr] gap-2">
      <Link href="/record/session?suggest=1" onPointerDown={() => tap(12)} className={cn(ui.btnPrimary, "w-full px-4")}>Démarrer la séance</Link>
      <button type="button" onClick={() => { tap(); try { localStorage.setItem(key, "1"); } catch { /* stockage indisponible */ } setSkipped(true); }} className={cn(ui.btnSecondary, "bg-transparent px-4 text-ink-soft")}>
        <SkipForward className="h-4 w-4" aria-hidden />Passer
      </button>
    </div>
  );
}
