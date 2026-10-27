import Link from "next/link";
import { Check, Circle, SkipForward } from "lucide-react";
import type { SessionStatus } from "@prisma/client";
import { EffortStrip } from "@/components/art/effort-strip";
import { KeyBadge } from "@/components/training/program-card";
import type { RibbonSegment } from "@/lib/art/zone-ribbon";
import { cn } from "@/lib/utils";

/** Ce que les lignes d'une semaine ont besoin de savoir d'une séance (léger : passe aussi à la feuille d'une semaine, côté client). */
export type WeekSession = { id: string; title: string; summary: string; status: SessionStatus; isKey: boolean; isNext: boolean; activityId: string | null; ribbon: RibbonSegment[] };
export type WeekInfo = { number: number; startDate: string; isRecovery: boolean; note: string | null; sessions: WeekSession[] };

export const weekDay = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
/** Séances de la semaine déjà traitées (faites). */
export const doneIn = (w: { sessions: { status: SessionStatus }[] }) => w.sessions.filter((s) => s.status === "COMPLETED").length;

/** Une ligne de séance : état, titre, ligne d'allure, « Voir la sortie » quand elle est faite, vignette de la forme prévue (52 × 32). */
export function SessionRow({ s }: { s: WeekSession }) {
  const Icon = s.status === "COMPLETED" ? Check : s.status === "SKIPPED" ? SkipForward : Circle;
  return (
    <li className={cn("flex min-h-14 items-center gap-3 py-3", s.status === "SKIPPED" && "opacity-60")}>
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", s.status === "COMPLETED" ? "bg-ink text-bg" : s.isNext ? "border-2 border-ink text-ink-soft" : "border-2 border-surface-3 text-ink-mute")}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate font-semibold leading-tight text-ink">{s.title}</p>
          {s.isKey && <KeyBadge />}
        </div>
        {s.summary && <p className="mt-0.5 truncate font-num text-sm tabular-nums text-ink-soft">{s.summary}</p>}
        {s.status === "COMPLETED" && s.activityId && <Link href={`/activities/${s.activityId}`} className="-mb-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand">Voir la sortie</Link>}
        {s.status === "SKIPPED" && <p className="text-xs text-ink-mute">Passée</p>}
      </div>
      {s.ribbon.length > 0 && <EffortStrip mini segments={s.ribbon} />}
    </li>
  );
}

/** Les séances d'une semaine, lignes séparées (carte « Semaine N » et feuille d'une semaine du plan). */
export function SessionList({ sessions }: { sessions: WeekSession[] }) {
  return <ol className="divide-y divide-surface-2">{sessions.map((s) => <SessionRow key={s.id} s={s} />)}</ol>;
}
