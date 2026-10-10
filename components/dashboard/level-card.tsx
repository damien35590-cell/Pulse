import { rank } from "@/lib/xp";

export function LevelCard({ n, xp, need, weekXp }: { n: number; xp: number; need: number; weekXp: number }) {
  const r = 27, c = 2 * Math.PI * r;
  return (
    <section className="flex items-center gap-3.5 rounded-xl border border-line bg-surface p-3.5" aria-label="Niveau">
      <div className="relative h-[68px] w-[68px] shrink-0">
        <svg viewBox="0 0 68 68" className="-rotate-90"><circle cx="34" cy="34" r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth="7" /><circle cx="34" cy="34" r={r} fill="none" stroke="rgb(var(--brand))" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - xp / need)} /></svg>
        <span className="absolute inset-0 grid place-items-center font-display text-2xl font-extrabold">{n}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2"><b className="text-lg">{rank(n)}</b><span className="text-xs font-bold text-brand">+{weekXp.toLocaleString("fr-FR")} XP cette semaine</span></div>
        <div className="my-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${(xp / need) * 100}%` }} /></div>
        <p className="text-[13px] text-ink-soft">Niveau {n} : {Math.round(xp).toLocaleString("fr-FR")} / {need.toLocaleString("fr-FR")} XP</p>
      </div>
    </section>
  );
}
