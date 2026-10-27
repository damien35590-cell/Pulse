import { ChevronRight, Pause } from "lucide-react";
import type { RunProgramView, SessionView } from "@/lib/data/training";
import { fmtDuration } from "@/lib/format";
import { fmtPaceS, fmtStepTime } from "@/lib/training/resolve";
import { KeyBadge } from "@/components/training/program-card";
import { SessionActions, VmaTestPrompt } from "@/components/training/program-actions";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

const ROLE = { warmup: "Échauffement", active: "Effort", recovery: "Récup", cooldown: "Retour au calme", rest: "Repos" } as const;

/** Détail des étapes, répétitions regroupées : « 10 × 400 m · 3:59–4:13 /km ». Se déplie sur place (<details>). */
function Steps({ s }: { s: SessionView }) {
  const rows: { key: string; label: string; what: string; pace?: string }[] = [];
  for (const st of s.steps) {
    if (st.repeat && st.repeat.current > 1) continue;
    const what = st.duration.type === "time" ? fmtStepTime(st.duration.s) : st.duration.type === "distance" ? `${st.duration.m} m` : "1 tour";
    rows.push({
      key: `${rows.length}`, label: st.repeat ? `${st.repeat.total} × ${ROLE[st.role].toLowerCase()}` : ROLE[st.role], what,
      pace: st.paceSPerKm && (Math.round(st.paceSPerKm.min) === Math.round(st.paceSPerKm.max) ? `${fmtPaceS(st.paceSPerKm.min)} /km` : `${fmtPaceS(st.paceSPerKm.min)}–${fmtPaceS(st.paceSPerKm.max)} /km`),
    });
  }
  return (
    <details className="group text-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 font-semibold text-brand [&::-webkit-details-marker]:hidden">
        Détail des étapes <ChevronRight className="size-4 transition-transform duration-150 group-open:rotate-90" aria-hidden />
      </summary>
      <dl className="divide-y divide-surface-3 rounded-tile bg-surface-2 px-3">
        {rows.map((r) => <div key={r.key} className="flex items-baseline justify-between gap-3 py-2"><dt className="text-ink-soft">{r.label} · {r.what}</dt><dd className="shrink-0 font-num font-semibold tabular-nums">{r.pace ?? ""}</dd></div>)}
      </dl>
      {s.description && <p className="mt-2 text-ink-soft">{s.description}</p>}
    </details>
  );
}

/** Prochaine séance : titre, ligne d'allure, « Faite » (action principale) / « Passer », puis le détail des étapes. */
export function RunNext({ p }: { p: RunProgramView }) {
  const n = p.next, paused = p.status === "PAUSED";
  return (
    <>
      {p.pendingTest && <VmaTestPrompt sessionId={p.pendingTest.sessionId} />}
      <section aria-label="Prochaine séance" className={cn(ui.card, "space-y-3 p-4")}>
        <div className="flex items-center justify-between gap-2">
          <p className={ui.label}>Prochaine séance</p>
          {!paused && n?.isKeySession && <KeyBadge />}
        </div>
        {!n ? (
          <p className="text-ink-soft">Programme terminé, bravo.</p>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-bold leading-tight tracking-tight text-ink">{n.title}</h2>
              <p className="mt-1 text-sm text-ink-soft"><span className="font-num tabular-nums">{n.summary}</span>{n.summary && " · "}<span className="font-num tabular-nums">≈ {fmtDuration(n.durationS)}</span></p>
            </div>
            {paused
              ? <p className="flex items-center gap-2 text-sm text-ink-soft"><Pause className="size-4 shrink-0" aria-hidden />Programme en pause. Réactive-le avec l’interrupteur « Envoi sur Garmin » plus bas.</p>
              : <SessionActions id={n.id} />}
            <Steps s={n} />
          </>
        )}
      </section>
    </>
  );
}
