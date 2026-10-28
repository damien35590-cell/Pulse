"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { Bilan } from "@/lib/races/bilan";

// Confettis déterministes (pas de Math.random : même rendu serveur et client).
const CONFETTI = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 + (i % 2) * 0.2, d = 70 + (i % 4) * 22;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d - 30, c: ["rgb(var(--brand))", "rgb(var(--good))", "rgb(var(--warn))", "rgb(var(--act-ride))"][i % 4], r: (i * 47) % 180, s: 6 + (i % 3) * 2 };
});

export function RaceBilan({ bilan }: { bilan: Bilan }) {
  const calm = useReducedMotion();
  const lines = [bilan.goal?.text, bilan.pace?.text, bilan.percentile?.text, bilan.versus?.text].filter(Boolean) as string[];
  if (!lines.length) return null;
  return (
    <section aria-label="Bilan de la course" className="relative overflow-hidden rounded-2xl border border-brand/30 bg-surface p-5">
      {bilan.beaten && !calm && (
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-10 h-0 w-0">
          {CONFETTI.map((p, i) => (
            <motion.span key={i} className="absolute rounded-sm" style={{ width: p.s, height: p.s * 0.6, background: p.c }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }} animate={{ x: p.x, y: p.y + 90, opacity: 0, rotate: p.r * 4, scale: 1 }}
              transition={{ duration: 1.6, delay: 0.1 + (i % 5) * 0.04, ease: "easeOut" }} />
          ))}
        </div>
      )}
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-soft">Bilan</h2>
      <ul className="space-y-2">
        {lines.map((t, i) => (
          <motion.li key={t} initial={calm ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}
            className={i === 0 ? "font-display text-xl font-bold leading-snug" : "text-[15px] font-semibold text-ink-soft"}>
            {t}
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
