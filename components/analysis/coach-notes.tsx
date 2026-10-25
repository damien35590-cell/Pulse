import Link from "next/link";
import { ChevronRight, CircleAlert, Lightbulb, TrendingUp, TriangleAlert } from "lucide-react";
import type { CoachNote, CoachTone } from "@/lib/analytics/coach-notes";
import { cn } from "@/lib/utils";

const TONE: Record<CoachTone, { icon: typeof TrendingUp; cls: string; label: string }> = {
  bad: { icon: CircleAlert, cls: "bg-bad/15 text-bad", label: "Alerte" },
  warn: { icon: TriangleAlert, cls: "bg-warn/15 text-warn", label: "À surveiller" },
  good: { icon: TrendingUp, cls: "bg-good/15 text-good", label: "Progrès" },
  info: { icon: Lightbulb, cls: "bg-surface-2 text-ink-soft", label: "Info" },
};

/** Les commentaires du coach (lib/analytics/coach-notes.ts), déjà classés par importance : une liste à placer dans la carte « Coach ». */
export function CoachNotes({ notes, className }: { notes: CoachNote[]; className?: string }) {
  if (!notes.length) return null;
  return (
    <ul className={cn("divide-y divide-surface-2", className)}>
      {notes.map((n) => {
        const t = TONE[n.tone], Icon = t.icon;
        return (
          <li key={n.id} className="flex gap-3 py-3 first:pt-0">
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", t.cls)} title={t.label}>
              <Icon className="size-[18px]" strokeWidth={2.25} aria-hidden />
              <span className="sr-only">{t.label}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug text-ink">{n.title}</p>
              {n.body && <p className="mt-1 text-sm text-ink-soft">{n.body}</p>}
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
  );
}
