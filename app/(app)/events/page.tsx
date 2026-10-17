import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCountdown } from "@/lib/races/time";
import { toRaceView } from "@/lib/races/view";
import { ImportRace } from "@/components/events/import-race";
import { NextRaceHero } from "@/components/events/next-race-hero";
import { RaceList } from "@/components/events/race-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Courses" };

/** Ligne d'arrivée stylisée pour l'état vide. */
function FinishIllustration() {
  return (
    <svg viewBox="0 0 160 96" className="mx-auto h-24 w-40" aria-hidden>
      <path d="M8 84 Q60 70 152 84" fill="none" stroke="rgb(var(--line))" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 84 C40 60 54 66 70 48 S104 26 120 30" fill="none" stroke="rgb(var(--brand))" strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round" />
      <line x1="120" y1="84" x2="120" y2="14" stroke="rgb(var(--ink-soft))" strokeWidth="3" strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => [0, 1].map((j) => <rect key={`${i}${j}`} x={122 + i * 7} y={14 + j * 7} width="7" height="7" fill={(i + j) % 2 ? "rgb(var(--surface))" : "rgb(var(--brand))"} />))}
      <rect x="122" y="14" width="28" height="14" fill="none" stroke="rgb(var(--brand))" strokeWidth="1.5" />
      <circle cx="24" cy="84" r="5" fill="rgb(var(--brand))" />
    </svg>
  );
}

export default async function RacesPage({ searchParams }: { searchParams: { import?: string } }) {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const now = new Date();
  const races = (await prisma.raceEvent.findMany({ where: { userId: s.user.id }, orderBy: [{ date: "asc" }, { startTime: "asc" }] })).map(toRaceView);
  // La « prochaine » : première course à venir où l'on est encore inscrit.
  const next = races.find((r) => r.status === "REGISTERED" && !getCountdown(r, now).isPast);
  const autoOpen = searchParams.import === "1";

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Accueil</Link>
      <h1 className="font-display text-3xl font-bold leading-none">Courses</h1>

      {races.length === 0 ? (
        <section className="rounded-2xl border border-line bg-surface p-6 text-center">
          <FinishIllustration />
          <h2 className="mt-3 font-display text-xl font-bold">Pas encore de course au programme</h2>
          <p className="mt-1 text-sm text-ink-soft">Colle le lien NextRun ou Klikego de ta prochaine course : Pulse affichera le compte à rebours et ta préparation.</p>
          <div className="mt-5"><ImportRace label="Importer une course depuis un lien" primary autoOpen={autoOpen} /></div>
        </section>
      ) : (
        <>
          {next && <NextRaceHero race={next} now={now.toISOString()} />}
          <ImportRace autoOpen={autoOpen} />
          <RaceList races={races} now={now.toISOString()} />
        </>
      )}
    </div>
  );
}
