import Link from "next/link";
import { ArrowRight, CircleCheck, Dumbbell, Footprints, MoonStar } from "lucide-react";
import type { CoachPlan } from "@/lib/coach/today";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";

const ICON = { run: Footprints, lift: Dumbbell, rest: MoonStar, done: CircleCheck } as const;
const TONE = { go: "bg-brand text-brand-ink", easy: "bg-good/15 text-good", rest: "bg-surface-2 text-ink-soft" } as const;

/** Coach du jour : une seule recommandation (séance, créneau météo, boucle) et ce qui vient demain. */
export function CoachCard({ c }: { c: CoachPlan }) {
  const Icon = ICON[c.kind];
  return (
    <section className={cn(ui.card, "p-4")} aria-label="Coach du jour">
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold", TONE[c.tone])}>
          <Icon className="size-3.5" aria-hidden />{c.tag}
        </span>
        <span className={ui.label}>Aujourd&apos;hui</span>
      </div>
      <h2 className="mt-3 text-[22px] font-bold leading-tight tracking-tight text-ink">{c.title}</h2>
      <ul className="mt-2 space-y-1.5">
        {c.lines.map((l) => <li key={l} className="text-[15px] leading-snug text-ink-soft">{l}</li>)}
      </ul>
      {c.primary && (
        <Link href={c.primary.href} className={cn(ui.btnPrimary, "mt-4 w-full")}>{c.primary.label}</Link>
      )}
      {(c.secondary || c.next) && (
        <div className="mt-3 flex items-center justify-between gap-3">
          {c.next ? <p className="min-w-0 text-sm text-ink-mute">{c.next}</p> : <span />}
          {c.secondary && (
            <Link href={c.secondary.href} className="inline-flex h-12 shrink-0 touch-manipulation items-center gap-1 text-sm font-semibold text-brand active:opacity-60">
              {c.secondary.label}<ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
