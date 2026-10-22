import Link from "next/link";
import { ExternalLink, MapPin, CalendarDays, Flag, FileWarning, ChevronRight } from "lucide-react";
import { SPORTS } from "@/lib/sports";
import { fmtGoalPace, fmtHms, fmtRaceDay, fmtRaceDistance, PLATFORM_LABEL } from "@/lib/races/format";
import type { RaceView } from "@/lib/races/view";
import { RaceCountdown } from "./race-countdown";

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex min-h-7 items-center rounded-full bg-surface-2 px-2.5 text-[13px] font-semibold text-ink">{children}</span>;
}

export function NextRaceHero({ race: r, now }: { race: RaceView; now: string }) {
  const pace = r.goalTimeS && r.targetDistance ? fmtGoalPace(r.goalTimeS, r.targetDistance, r.sport) : null;
  const platform = PLATFORM_LABEL[r.platform];
  return (
    <section aria-label="Prochaine course" className="overflow-hidden rounded-2xl border border-brand/30 bg-surface">
      <div className="bg-gradient-to-br from-brand/15 via-brand/5 to-transparent p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-brand">Prochaine course</p>
        <Link href={`/events/${r.id}`} className="group mt-1 block">
          <h2 className="font-display text-2xl font-bold leading-tight">{r.name}<ChevronRight className="ml-0.5 inline h-5 w-5 text-brand transition group-hover:translate-x-0.5" aria-hidden /></h2>
          {r.eventName && r.eventName !== r.name && <p className="text-sm text-ink-soft">{r.eventName}</p>}
        </Link>
        <RaceCountdown race={r} now={now} className="mt-4" />
      </div>
      <div className="space-y-3 p-5 pt-3">
        <ul className="space-y-1 text-sm">
          <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden /><span className="first-letter:uppercase">{fmtRaceDay(r.date)}</span>{r.startTime && <span className="font-semibold">· {r.startTime.replace(":", "h")}</span>}</li>
          {r.location && <li className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />{r.location}</li>}
        </ul>
        <div className="flex flex-wrap gap-1.5">
          {r.targetDistance && <Chip>{fmtRaceDistance(r.targetDistance)}</Chip>}
          {r.targetElevation && <Chip>{Math.round(r.targetElevation)} m D+</Chip>}
          <Chip>{SPORTS[r.sport]?.label ?? r.sport}</Chip>
          {platform && <Chip>{platform}</Chip>}
        </div>
        {r.goalTimeS && (
          <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
            <Flag className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span>Objectif <b className="tabular-nums">{fmtHms(r.goalTimeS)}</b>{pace && <> · allure <b className="tabular-nums">{pace}</b></>}</span>
          </p>
        )}
        {r.requiredDocument && r.status === "REGISTERED" && (
          <p className="flex items-start gap-2 rounded-xl border border-brand/40 px-3 py-2.5 text-sm"><FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /><span><b>Pense à ton PPS / licence</b><span className="block text-ink-soft">Demandé : {r.requiredDocument}</span></span></p>
        )}
        {r.url && (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-brand-ink active:scale-[.99]">
            Voir la page d’inscription<ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
      </div>
    </section>
  );
}
