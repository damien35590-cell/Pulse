import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoutePlanner } from "@/lib/data/routes";
import { getBestSlot } from "@/lib/coach/load";
import { slotText } from "@/lib/coach/today";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { TopBar } from "@/components/layout/top-bar";
import { Section } from "@/components/ui/section";
import { RoutePlanner } from "@/components/routes/route-planner";
import { RouteCard } from "@/components/routes/route-card";
import { WeatherIcon } from "@/components/routes/weather";
import { sportLine } from "@/lib/routes/view";
import { parseSession } from "@/lib/routes/session-fit";
import Link from "next/link";
import { ChevronRight, Footprints } from "lucide-react";

export const dynamic = "force-dynamic";

/** Lien de la carte du jour : /itineraires?sport=RUN&minutes=45&session=intervals pré-remplit la recherche (séance : course seulement). */
function preset(q: { sport?: string; minutes?: string; session?: string }) {
  const minutes = Number(q.minutes), sport = q.sport === "RIDE" ? "RIDE" : q.sport === "RUN" ? "RUN" : null;
  if (!sport || !(minutes >= 15 && minutes <= 300)) return null;
  return { sport, minutes: Math.round(minutes), session: sport === "RUN" ? parseSession(q.session) : "normal" } as const;
}
export const metadata = { title: "Itinéraires" };
/** Durée du formulaire sans lien pré-rempli (même valeur par défaut que RoutePlanner). */
const DEFAULT_MINUTES = 60;

const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

export default async function RoutesPage({ searchParams }: { searchParams: { sport?: string; minutes?: string; session?: string } }) {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const pre = preset(searchParams);
  // Meilleur créneau pour la durée demandée (sinon l'heure par défaut du formulaire) : en tête, et l'heure de départ en est pré-remplie.
  const [d, best] = await Promise.all([
    getRoutePlanner(s.user.id),
    getBestSlot(s.user.id, pre?.minutes ?? DEFAULT_MINUTES).catch((e) => { console.error("[itinéraires] créneau", e); return null; }),
  ]);
  const now = Date.now();
  const [slotWhen, ...slotRest] = best ? slotText(best.slot, best.tz, now).split(" · ") : [];

  return (
    <>
      <TopBar title="Itinéraires" back="/" subtitle="3 boucles depuis le départ de ton choix, selon ton temps dispo" />
      <div className="space-y-8">
        {best && (
          <Section title={`Meilleur créneau · ${pre?.minutes ?? DEFAULT_MINUTES} min`}>
            <div className={cn(ui.card, "flex items-center gap-3 p-4")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink"><WeatherIcon w={best.weather} className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-num text-metric-sm tabular-nums text-ink first-letter:uppercase">{slotWhen}</p>
                <p className="mt-0.5 text-sm text-ink-soft first-letter:uppercase">{slotRest.join(" · ")}</p>
              </div>
            </div>
          </Section>
        )}
        <RoutePlanner home={d.home} run={d.run} ride={d.ride} habits={d.habits} preset={pre && { ...pre, startAt: best?.slot.at }}>
          <Section title="Mes habitudes">
            <Link href="/itineraires/habitudes" className={cn(ui.card, ui.pressCard, "flex items-center gap-3 p-4")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink"><Footprints className="size-5" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">Carte de chaleur, classiques, bifurcations</span>
                <span className="block text-sm text-ink-soft">
                  {d.habits.RUN || d.habits.RIDE
                    ? `${(d.habits.RUN?.classics ?? 0) + (d.habits.RIDE?.classics ?? 0)} classiques · ${(d.habits.RUN?.junctions ?? 0) + (d.habits.RIDE?.junctions ?? 0)} bifurcations`
                    : "Récupère tes traces GPS pour que Pulse apprenne tes chemins"}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-ink-mute" aria-hidden />
            </Link>
          </Section>
          <Section title="Mes boucles gardées" action={d.saved.length ? <span className="font-num text-sm tabular-nums text-ink-mute">{d.saved.length}</span> : undefined}>
            {d.saved.length ? (
              <div className="space-y-3">
                {d.saved.map((r) => <RouteCard key={r.id} r={r} meta={`${sportLine(r)} · ${date(r.createdAt)}`} />)}
              </div>
            ) : (
              <p className={cn(ui.card, "p-4 text-sm text-ink-soft")}>Touche « Garder » sur une boucle pour la retrouver ici.</p>
            )}
          </Section>
        </RoutePlanner>
      </div>
    </>
  );
}
