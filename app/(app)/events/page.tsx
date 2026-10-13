import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addEvent, deleteEvent } from "@/app/actions";
import { SPORTS, MY_SPORTS } from "@/lib/sports";

export const dynamic = "force-dynamic";
export const metadata = { title: "Échéances" };
const sel = "mt-1 min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base";

export default async function EventsPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const events = await prisma.raceEvent.findMany({ where: { userId: s.user.id }, orderBy: { date: "asc" } });
  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Accueil</Link>
      <h1 className="font-display text-3xl font-bold leading-none">Échéances</h1>
      {events.length === 0 && <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">Aucune échéance. Ajoutez une course : l’accueil affichera le compte à rebours et votre préparation.</p>}
      <ul className="space-y-2.5">
        {events.map((e) => (
          <li key={e.id} className="flex items-start justify-between gap-2 rounded-xl border border-line bg-surface p-4">
            <div><p className="font-bold">{e.name}</p><p className="text-sm text-ink-soft">{e.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}, {SPORTS[e.sport]?.label}{e.targetDistance ? `, ${e.targetDistance} km` : ""}{e.targetElevation ? `, ${e.targetElevation} m D+` : ""}</p></div>
            <form action={deleteEvent.bind(null, e.id)}><button className="min-h-11 px-2 text-sm text-ink-soft">Retirer</button></form>
          </li>
        ))}
      </ul>
      <form action={addEvent} className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Nouvelle échéance</h2>
        <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">
          <label className="col-span-2">Nom<input name="name" required className={sel} placeholder="Ex. Trail des Falaises" /></label>
          <label>Date<input name="date" type="date" required className={sel} /></label>
          <label>Sport<select name="sport" className={sel}>{MY_SPORTS.map((k) => <option key={k} value={k}>{SPORTS[k].label}</option>)}</select></label>
          <label>Distance (km)<input name="distance" inputMode="decimal" className={sel} placeholder="Facultatif" /></label>
          <label>Dénivelé + (m)<input name="elevation" inputMode="numeric" className={sel} placeholder="Facultatif" /></label>
        </div>
        <button className="mt-4 min-h-14 w-full rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink">Ajouter l’échéance</button>
      </form>
    </div>
  );
}
