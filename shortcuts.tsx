import Link from "next/link";
import { zone } from "@/lib/fitness";

export function Shortcuts({ ctl, form, goals }: { ctl: number; form: number; goals: number }) {
  const t = "block rounded-xl border border-line bg-surface p-3.5 active:bg-surface-2", l = "text-sm text-ink-soft";
  return (
    <section aria-label="Pour progresser"><h2 className="mb-3 font-display text-xl font-bold">Pour progresser</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/fitness" className={t}><p className={l}>Forme physique</p><p className="font-display text-3xl font-bold tabular-nums">{Math.round(ctl)}</p><p className="text-[13px] text-ink-soft">{zone(form).label}</p></Link>
        <Link href="/plan" className={t}><p className={l}>Programme</p><p className="font-display text-2xl font-bold">Mon plan</p><p className="text-[13px] text-ink-soft">Course, vélo, rando, muscu</p></Link>
        <Link href="/goals" className={t}><p className={l}>Objectifs</p><p className="font-display text-3xl font-bold tabular-nums">{goals}</p><p className="text-[13px] text-ink-soft">en cours</p></Link>
        <Link href="/bench" className={t}><p className={l}>Profils similaires</p><p className="font-display text-2xl font-bold">Se comparer</p><p className="text-[13px] text-ink-soft">par âge et sexe</p></Link>
      </div>
    </section>
  );
}
