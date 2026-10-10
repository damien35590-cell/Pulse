import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivityCard } from "@/components/dashboard/activity-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activités" };
const TZ = "Europe/Paris";

export default async function ActivitiesPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const acts = await prisma.activity.findMany({
    where: { userId: s.user.id }, orderBy: { startedAt: "desc" }, take: 150,
    select: { id: true, type: true, title: true, story: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true, polyline: true },
  });
  const fmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: TZ });
  const groups = new Map<string, typeof acts>();
  for (const a of acts) { const k = fmt.format(a.startedAt); groups.set(k, [...(groups.get(k) ?? []), a]); }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold leading-none">Activités</h1>
      {acts.length === 0 && (
        <p className="rounded-xl border border-line bg-surface p-5 text-ink-soft">Rien ici pour l’instant. <Link href="/record" className="font-semibold text-brand">Enregistrez une sortie</Link> ou <Link href="/import" className="font-semibold text-brand">importez vos fichiers</Link>.</p>
      )}
      {[...groups].map(([month, list]) => (
        <section key={month} className="space-y-2.5">
          <h2 className="font-display text-lg font-bold capitalize">{month} <span className="font-medium text-ink-soft">({list.length})</span></h2>
          {list.map((a) => <ActivityCard key={a.id} a={a} />)}
        </section>
      ))}
    </div>
  );
}
