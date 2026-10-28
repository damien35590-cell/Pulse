"use client";
import { useState, useTransition } from "react";
import { Loader2, RotateCw, Sparkles } from "lucide-react";
import { generateDebrief } from "@/app/(app)/analysis/actions";
import type { DebriefView } from "@/lib/coach/store";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";

const DOT = { good: "bg-good", warn: "bg-warn", bad: "bg-bad" } as const;
const modelName = (m: string) => (/haiku/i.test(m) ? "Claude Haiku" : /opus/i.test(m) ? "Claude Opus" : /sonnet/i.test(m) ? "Claude Sonnet" : m);
const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/**
 * Analyse du coach IA (Claude) pour l'onglet et la période affichés : bilan, 2 à 4 points, une consigne pour la semaine.
 * Contenu de la carte « Coach » (components/analysis/coach-card.tsx), sans carte ni titre propres.
 * Générée à la demande puis enregistrée : la rouvrir ne coûte rien ; « Actualiser » ne rappelle l'IA que si les chiffres ont changé.
 * Repliée par défaut (action secondaire sous les commentaires) : un debrief déjà enregistré s'affiche au toucher, sans rappeler l'IA.
 */
export function AiDebrief({ params, initial, configured }: { params: { w: string; to?: string; s: string }; initial: DebriefView | null; configured: boolean }) {
  const [view, setView] = useState(initial), [error, setError] = useState<string | null>(null), [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const run = (force = false) => {
    tap(8); setError(null); setOpen(true);
    start(async () => {
      const r = await generateDebrief({ ...params, force });
      if (r.ok) setView(r.view); else setError(r.error);
    });
  };
  const show = () => { if (view) { tap(8); setOpen(true); } else run(false); };

  return (
    <div>
      {view && open ? (
        <div className={cn("space-y-4 transition-opacity", pending && "opacity-50")} aria-busy={pending}>
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold leading-snug text-ink">{view.debrief.verdict}</p>
            <button type="button" onClick={() => run(false)} disabled={pending} aria-label="Actualiser l'analyse" className={cn(ui.iconBtn, "-my-3 -mr-3 text-ink-soft disabled:opacity-40")}>
              <RotateCw className={cn("size-5", pending && "animate-spin")} aria-hidden />
            </button>
          </div>
          {view.debrief.points.length > 0 && (
            <ul className="space-y-2.5">
              {view.debrief.points.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-ink-soft"><i className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[p.tone])} aria-hidden />{p.text}</li>
              ))}
            </ul>
          )}
          <div className="rounded-tile bg-brand/10 p-3">
            <p className={cn(ui.label, "text-brand")}>Ta consigne cette semaine</p>
            <p className="mt-1 font-medium text-ink">{view.debrief.consigne}</p>
            {view.debrief.principe && <p className="mt-2 text-xs text-ink-soft">Pourquoi : {view.debrief.principe}</p>}
          </div>
          <p className="text-xs text-ink-mute">{modelName(view.model)} · {when(view.at)}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <button type="button" onClick={show} disabled={pending || (!configured && !view)} className={cn(ui.btnSecondary, "w-full bg-surface-2")}>
            {pending ? <><Loader2 className="size-5 animate-spin" aria-hidden />Le coach analyse…</> : <><Sparkles className="size-5 text-brand" aria-hidden />Analyser avec le coach IA</>}
          </button>
          {!configured && !view && <p className="text-xs text-ink-mute">Pour l'activer : ajoute la clé ANTHROPIC_API_KEY dans Vercel (Settings &gt; Environment Variables), puis redéploie.</p>}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
    </div>
  );
}
