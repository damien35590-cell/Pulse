import Link from "next/link";
import { ArrowUpRight, CalendarDays, HeartPulse, Target, Users, type LucideIcon } from "lucide-react";
import { zone } from "@/lib/fitness";

type Tile = { href: string; Icon: LucideIcon; label: string; value: string | number; sub: string; big?: boolean };

export function Shortcuts({ ctl, form, goals }: { ctl: number; form: number; goals: number }) {
  const tiles: Tile[] = [
    { href: "/fitness", Icon: HeartPulse, label: "Forme physique", value: Math.round(ctl), sub: zone(form).label, big: true },
    { href: "/plan", Icon: CalendarDays, label: "Programme", value: "Mon plan", sub: "Muscu, running, vélo, rando" },
    { href: "/goals", Icon: Target, label: "Objectifs", value: goals, sub: goals ? `en cours · gérer` : "en définir un", big: true },
    { href: "/bench", Icon: Users, label: "Profils similaires", value: "Se comparer", sub: "par âge et sexe" },
  ];
  return (
    <section aria-label="Pour progresser"><h2 className="mb-3 font-display text-xl font-bold">Pour progresser</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map(({ href, Icon, label, value, sub, big }) => (
          <Link key={href} href={href}
            className="group flex flex-col rounded-xl border border-line bg-surface p-3.5 transition hover:border-brand/40 hover:shadow-sm active:scale-[.98] active:bg-surface-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand"><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
              <ArrowUpRight className="h-4 w-4 text-ink-soft transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
            </div>
            <p className="text-[13px] text-ink-soft">{label}</p>
            <p className={big ? "font-display text-3xl font-bold leading-tight tabular-nums" : "font-display text-xl font-bold leading-tight"}>{value}</p>
            <p className="mt-auto pt-0.5 text-[12px] text-ink-soft">{sub}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
