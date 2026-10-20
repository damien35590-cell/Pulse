import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoutePlanner } from "@/lib/data/routes";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { TopBar } from "@/components/layout/top-bar";
import { Section } from "@/components/ui/section";
import { RoutePlanner } from "@/components/routes/route-planner";
import { RouteCard } from "@/components/routes/route-card";
import { sportLine } from "@/lib/routes/view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Itinéraires" };

const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

export default async function RoutesPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const d = await getRoutePlanner(s.user.id);

  return (
    <>
      <TopBar title="Itinéraires" back="/" subtitle="3 boucles au départ de chez toi, selon ton temps dispo" />
      <div className="space-y-8">
        <RoutePlanner home={d.home} run={d.run} ride={d.ride} />
        <Section title="Mes boucles gardées" action={d.saved.length ? <span className="font-num text-sm tabular-nums text-ink-mute">{d.saved.length}</span> : undefined}>
          {d.saved.length ? (
            <div className="space-y-3">
              {d.saved.map((r) => <RouteCard key={r.id} r={r} meta={`${sportLine(r)} · ${date(r.createdAt)}`} />)}
            </div>
          ) : (
            <p className={cn(ui.card, "p-4 text-sm text-ink-soft")}>Touche « Garder » sur une boucle pour la retrouver ici.</p>
          )}
        </Section>
      </div>
    </>
  );
}
