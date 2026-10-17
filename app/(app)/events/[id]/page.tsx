import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, ChevronDown } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SPORTS } from "@/lib/sports";
import { getCountdown } from "@/lib/races/time";
import { fmtGoalPace, fmtHms, fmtPrice, fmtRaceDay, fmtRaceDistance, fmtRank, PLATFORM_LABEL } from "@/lib/races/format";
import { EditRace } from "@/components/events/edit-race";
import { RaceCountdown } from "@/components/events/race-countdown";
import { Chip } from "@/components/events/next-race-hero";
import { DeleteRace, RaceResultForm, RaceStatusPicker } from "@/components/events/race-actions";
import { RacePrepSection } from "@/components/events/race-prep";
import { prepSports, racePrep, weeklyGoalKm } from "@/lib/races/prep";
import type { ActivityType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Course" };

export default async function RacePage({ params }: { params: { id: string } }) {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const e = await prisma.raceEvent.findFirst({ where: { id: params.id, userId: s.user.id } });
  if (!e) notFound();
  const now = new Date(), c = getCountdown(e, now);
  // Préparation : course à venir dans un sport d'endurance, calculée sur les 100 derniers jours d'activités du même sport.
  const withPrep = !c.isPast && e.status === "REGISTERED" && ["RUN", "RIDE", "HIKE", "WALK"].includes(e.sport);
  const goalType = (e.sport === "WALK" ? "HIKE" : e.sport) as ActivityType, goalKm = weeklyGoalKm(e.targetDistance);
  const [user, acts, weekGoal] = withPrep ? await Promise.all([
    prisma.user.findUnique({ where: { id: s.user.id }, select: { timezone: true } }),
    prisma.activity.findMany({ where: { userId: s.user.id, type: { in: prepSports(e.sport) as ActivityType[] }, startedAt: { gte: new Date(+now - 100 * 864e5) } }, select: { type: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true } }),
    prisma.goal.findFirst({ where: { userId: s.user.id, active: true, metric: "DISTANCE", period: "WEEK", type: goalType }, select: { target: true } }),
  ]) : [null, [], null];
  const prep = withPrep ? racePrep(e, acts, now, user?.timezone ?? "Europe/Paris") : null;
  const pace = e.goalTimeS && e.targetDistance ? fmtGoalPace(e.goalTimeS, e.targetDistance, e.sport) : null;
  const platform = PLATFORM_LABEL[e.platform];
  const showResult = c.isPast || e.status === "COMPLETED" || e.status === "DNF";
  const rows: [string, string | null][] = [
    ["Date", `${fmtRaceDay(e.date)}${e.startTime ? `, départ à ${e.startTime.replace(":", "h")}` : ""}`],
    ["Lieu", e.location],
    ["Prix", e.priceCents != null ? fmtPrice(e.priceCents) : null],
    ["Document requis", e.requiredDocument],
    ["Objectif", e.goalTimeS ? `${fmtHms(e.goalTimeS)}${pace ? ` (${pace})` : ""}` : null],
    ["Dossard", e.bibNumber],
    ["Notes", e.notes],
  ];

  return (
    <div className="space-y-5">
      <Link href="/events" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Courses</Link>

      <header className="rounded-2xl border border-line bg-surface p-5">
        {e.eventName && e.eventName !== e.name && <p className="text-sm font-semibold text-ink-soft">{e.eventName}</p>}
        <h1 className="font-display text-3xl font-bold leading-tight">{e.name}</h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {e.targetDistance && <Chip>{fmtRaceDistance(e.targetDistance)}</Chip>}
          {e.targetElevation && <Chip>{Math.round(e.targetElevation)} m D+</Chip>}
          <Chip>{SPORTS[e.sport]?.label ?? e.sport}</Chip>
          {platform && <Chip>{platform}</Chip>}
        </div>
        {!c.isPast && <RaceCountdown race={{ date: e.date.toISOString(), startTime: e.startTime }} now={now.toISOString()} className="mt-5" />}
        {c.isPast && (e.resultTimeS || e.rankOverall) && (
          <div className="mt-5">
            {e.resultTimeS && <p className="font-display text-5xl font-bold tabular-nums text-brand">{fmtHms(e.resultTimeS)}</p>}
            <p className="mt-1 text-sm font-semibold text-ink-soft">{[e.rankOverall && `${fmtRank(e.rankOverall, e.participants)} au général`, e.rankCategory && `${fmtRank(e.rankCategory)} en catégorie`].filter(Boolean).join(" · ")}</p>
          </div>
        )}
      </header>

      <section aria-label="Statut" className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-ink-soft">Statut</h2>
        <RaceStatusPicker id={e.id} status={e.status} />
      </section>

      {prep && (
        <RacePrepSection id={e.id} prep={prep} distanceKm={e.targetDistance} hasGoalTime={!!e.goalTimeS}
          goal={goalKm ? { km: goalKm, sportLabel: (SPORTS[goalType]?.label ?? "").toLowerCase(), active: weekGoal?.target === goalKm * 1000 } : null} />
      )}

      {showResult && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-3 font-display text-lg font-bold">{e.resultTimeS ? "Résultat" : `Comment s’est passée la course ?`}</h2>
          <RaceResultForm id={e.id} initial={{ resultTimeS: e.resultTimeS, rankOverall: e.rankOverall, rankCategory: e.rankCategory, participants: e.participants }} />
        </section>
      )}

      <dl className="divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="shrink-0 text-ink-soft">{k}</dt><dd className="text-right font-semibold first-letter:uppercase">{v}</dd></div>
        ))}
      </dl>
      {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface font-semibold text-brand">Voir la page d’inscription{platform ? ` sur ${platform}` : ""}<ExternalLink className="h-4 w-4" aria-hidden /></a>}

      <details className="group">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-xl border border-line bg-surface px-4 font-semibold [&::-webkit-details-marker]:hidden">
          Modifier les infos<ChevronDown className="h-4 w-4 text-ink-soft transition group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-2.5">
          <EditRace id={e.id} draft={{
            url: e.url ?? "", platform: e.platform, name: e.name, eventName: e.eventName ?? undefined, date: e.date.toISOString().slice(0, 10), startTime: e.startTime ?? undefined,
            location: e.location ?? undefined, sport: e.sport, targetDistance: e.targetDistance ?? undefined, targetElevation: e.targetElevation ?? undefined,
            priceCents: e.priceCents ?? undefined, requiredDocument: e.requiredDocument ?? undefined, goalTimeS: e.goalTimeS ?? undefined, bibNumber: e.bibNumber ?? undefined, notes: e.notes ?? undefined,
          }} />
        </div>
      </details>

      <DeleteRace id={e.id} name={e.name} />
    </div>
  );
}
