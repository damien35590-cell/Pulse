import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { rank } from "@/lib/xp";

export function LevelCard({ n, xp, need, weekXp }: { n: number; xp: number; need: number; weekXp: number }) {
  const r = 27, c = 2 * Math.PI * r;
  return (
    <Link href="/vous" aria-label={`Niveau ${n}, ${rank(n)} : voir les badges`} className="group flex items-center gap-3.5 rounded-xl border border-line bg-surface p-3.5 transition hover:border-brand/40 hover:shadow-sm active:scale-[.99] active:bg-surface-2">
      <div className="relative h-[68px] w-[68px] shrink-0">
        <svg viewBox="0 0 68 68" className="-rotate-90"><circle cx="34" cy="34" r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth="7" /><circle cx="34" cy="34" r={r} fill="none" stroke="rgb(var(--brand))" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - xp / need)} /></svg>
        <span className="absolute inset-0 grid place-items-center font-display text-2xl font-extrabold">{n}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2"><b className="text-lg">{rank(n)}</b><span className="text-xs font-bold text-brand">+{weekXp.toLocaleString("fr-FR")} XP cette semaine</span></div>
        <div className="my-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${(xp / need) * 100}%` }} /></div>
        <p className="flex items-center justify-between text-[13px] text-ink-soft"><span>Niveau {n} : {Math.round(xp).toLocaleString("fr-FR")} / {need.toLocaleString("fr-FR")} XP</span><span className="flex items-center font-semibold text-brand">Badges<ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden /></span></p>
      </div>
    </Link>
  );
}
