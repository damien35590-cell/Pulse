"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Flame, Target } from "lucide-react";
import { SPORTS } from "@/lib/sports";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

export function GoalCard({ km, goalKm, sport, streak }: { km: number; goalKm: number; sport: string | null; streak: number }) {
  const S = sport ? SPORTS[sport] : null, Icon = S?.icon ?? Target, label = S?.label ?? "Tous sports";
  const real = (km / goalKm) * 100, pct = Math.min(100, real), over = real > 100, left = Math.max(0, goalKm - km);
  return (
    <Link href="/goals" aria-label={`Objectif ${label} de ${fmtNum(goalKm, 0)} km cette semaine : modifier`}
      className="group block rounded-xl border border-line bg-surface p-4 transition hover:border-brand/40 hover:shadow-sm active:scale-[.99] active:bg-surface-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft"><Icon className="h-3.5 w-3.5" aria-hidden />{label} · cette semaine</p>
        <span className="flex items-center text-xs font-semibold text-brand">Modifier<ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden /></span>
      </div>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold">Objectif de {fmtNum(goalKm, 0)} km</h2>
        {/* Pourcentage RÉEL : 142 km sur 30 km = 473 % */}
        <span className={cn("font-display text-2xl font-bold tabular-nums", over && "text-good")}>{Math.round(real).toLocaleString("fr-FR")} %</span>
      </div>
      <div className="my-3 h-3 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className={cn("h-full rounded-full", over ? "bg-good" : "bg-brand")}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </div>
      <p className="text-sm text-ink-soft">
        {over ? <>Objectif dépassé de <b className="text-ink">{fmtNum(km - goalKm)} km</b>. Belle semaine.</> : left > 0 ? `Plus que ${fmtNum(left)} km. Pas de pression, juste une belle sortie.` : "Objectif atteint. Le reste de la semaine est du bonus."}
      </p>
      {streak > 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <Flame className="h-5 w-5 text-brand" aria-hidden />
          <span><b className="font-semibold">{streak} semaine{streak > 1 ? "s" : ""} d’affilée.</b> <span className="text-ink-soft">Les jours de repos comptent aussi.</span></span>
        </p>
      )}
    </Link>
  );
}
