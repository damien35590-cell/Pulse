"use client";
import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { celebrate, tap } from "@/lib/haptics";

const N = 28;

/** Écran d'après-sortie : l'anecdote, et une pluie de confettis orange quand c'est un record. */
export function StoryReveal({ story, record, onClose }: { story: string; record: boolean; onClose: () => void }) {
  const reduce = useReducedMotion();
  useEffect(() => { record ? celebrate() : tap(12); }, [record]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Sortie enregistrée" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
      {record && !reduce && Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2, d = 120 + (i % 5) * 45;
        return <motion.span key={i} className="absolute h-3 w-2 rounded-sm" style={{ background: i % 3 ? "#FC4C02" : "#fff" }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }} animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d + 60, opacity: 0, rotate: 260 + i * 20 }}
          transition={{ duration: 1.3 + (i % 4) * 0.15, ease: "easeOut" }} />;
      })}
      <motion.div initial={reduce ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 26 }}
        className="relative w-full max-w-sm rounded-2xl bg-surface p-6 text-center">
        <p className="font-display text-4xl font-bold leading-none text-brand">{record ? "Record battu" : "Sortie enregistrée"}</p>
        <p className="mt-4 text-lg leading-snug">{story}</p>
        <button onClick={onClose} className="mt-6 min-h-14 w-full rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink active:scale-[.98]">{record ? "Quelle journée" : "Parfait"}</button>
      </motion.div>
    </div>
  );
}
