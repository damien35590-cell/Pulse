"use client";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { fmtNum } from "@/lib/format";

export function GoalCard({ km, goalKm, streak }: { km: number; goalKm: number; streak: number }) {
  const pct = Math.min(100, (km / goalKm) * 100), left = Math.max(0, goalKm - km);
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold">Objectif de {fmtNum(goalKm, 0)} km</h2>
        <span className="font-display text-2xl font-bold tabular-nums">{Math.round(pct)} %</span>
      </div>
      <div className="my-3 h-3 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
      </div>
      <p className="text-sm text-ink-soft">{left > 0 ? `Plus que ${fmtNum(left)} km. Pas de pression, juste une belle sortie.` : "Objectif atteint. Le reste de la semaine est du bonus."}</p>
      {streak > 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <Flame className="h-5 w-5 text-brand" aria-hidden />
          <span><b className="font-semibold">{streak} semaine{streak > 1 ? "s" : ""} d’affilée.</b> <span className="text-ink-soft">Les jours de repos comptent aussi.</span></span>
        </p>
      )}
    </section>
  );
}
