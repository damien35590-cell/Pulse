import Link from "next/link";
import { ChevronRight, CircleAlert, Lightbulb, TrendingUp, TriangleAlert } from "lucide-react";
import { Section } from "@/components/ui/section";
import type { CoachNote, CoachTone } from "@/lib/analytics/coach-notes";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";

const TONE: Record<CoachTone, { icon: typeof TrendingUp; cls: string; label: string }> = {
  bad: { icon: CircleAlert, cls: "bg-bad/15 text-bad", label: "Alerte" },
  warn: { icon: TriangleAlert, cls: "bg-warn/15 text-warn", label: "À surveiller" },
  good: { icon: TrendingUp, cls: "bg-good/15 text-good", label: "Progrès" },
  info: { icon: Lightbulb, cls: "bg-surface-2 text-ink-soft", label: "Info" },
};

/** « Le mot du coach » : 2 à 4 commentaires, les alertes d'abord (lib/analytics/coach-notes.ts). Rien n'est affiché sans commentaire. */
export function CoachNotes({ notes }: { notes: CoachNote[] }) {
  if (!notes.length) return null;
  return (
    <Section title="Le mot du coach">
      <ul className={cn(ui.card, "divide-y divide-surface-2")}>
        {notes.map((n) => {
          const t = TONE[n.tone], Icon = t.icon;
          return (
            <li key={n.id} className="flex gap-3 p-4">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", t.cls)} title={t.label}>
                <Icon className="size-[18px]" strokeWidth={2.25} aria-hidden />
                <span className="sr-only">{t.label}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug text-ink">{n.title}</p>
                <p className="mt-1 text-sm text-ink-soft">{n.body}</p>
                {n.action && (
                  <Link href={n.action.href} className="-mb-2 mt-1 inline-flex min-h-12 items-center gap-1 text-sm font-semibold text-brand active:opacity-60">
                    {n.action.label}<ChevronRight className="size-4" aria-hidden />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
