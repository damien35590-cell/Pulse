"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Trophy } from "lucide-react";
import { acknowledgeBadge } from "@/app/actions";
import type { BadgeItem } from "@/lib/badges";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Confetti } from "@/components/ui/confetti";
import { celebrate, chime, stamp, tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { DISC_LABEL, HOLO_COLORS, ICONS, TIER_COLORS } from "./badge-meta";
import { TIER_TEXT, TierMedal } from "./tier-medal";

type View = { key: string; read: boolean };
/** sealed : médaille retournée à révéler · open : révélée, à valider · stamped : tampon « Validé » en cours */
type Phase = "sealed" | "open" | "stamped";

const HOLD_MS = 650;
const STAMP_MS = 900;
const TIER_LINES = [
  "Premier pas, et pas des moindres.",
  "Ça commence à devenir sérieux.",
  "De l'or. Peu de gens vont jusque-là.",
  "Diamant. Il n'y a rien au-dessus.",
];

const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(iso));

/**
 * État partagé de la validation des badges (grille, carte d'accueil) : paliers à valider, mise à jour optimiste,
 * et la feuille de célébration à rendre une fois dans le composant (`sheet`).
 * Parcours : médaille retournée → tap pour la révéler (confettis, carillon) → appui long pour valider (tampon)
 * → badge suivant, puis écran final quand tout est validé.
 */
export function useBadgeReview(items: BadgeItem[]) {
  const [acked, setAcked] = useState<ReadonlySet<string>>(new Set());
  const [view, setView] = useState<View | null>(null);
  const [phase, setPhase] = useState<Phase>("sealed");
  const [done, setDone] = useState(0); // validés pendant cette série
  const [finale, setFinale] = useState(false);
  const [burst, setBurst] = useState(0);
  const medal = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const all = useMemo(() => items.map((i) => (acked.has(i.key) ? { ...i, acknowledged: true } : i)), [items, acked]);
  const pending = useMemo(() => all.filter((i) => !i.acknowledged), [all]); // déjà triés du plus ancien au plus récent

  const openPending = useCallback((key?: string) => {
    const first = key ?? pending[0]?.key;
    if (!first) return;
    setDone(0); setFinale(false); setPhase("sealed"); setView({ key: first, read: false });
  }, [pending]);
  const openRead = useCallback((key: string) => { setFinale(false); setPhase("open"); setView({ key, read: true }); }, []);
  const close = useCallback(() => { clearTimeout(timer.current); setView(null); setFinale(false); setPhase("sealed"); }, []);

  const item = view ? all.find((i) => i.key === view.key) ?? null : null;

  const reveal = useCallback(() => {
    if (!item || phase !== "sealed") return;
    setPhase("open");
    setBurst((b) => b + 1);
    celebrate();
    chime(item.tier);
  }, [item, phase]);

  const validate = useCallback(() => {
    if (!item || phase !== "open") return;
    const key = item.key;
    setPhase("stamped");
    stamp();
    // Le suivant est figé maintenant : le rafraîchissement serveur pendant l'animation ne le change pas.
    const next = pending.find((p) => p.key !== key);
    acknowledgeBadge(key)
      .then((r) => { if (!r.ok) throw new Error(r.error); })
      .catch((e) => { console.error("[badges] validation", e); setAcked((s) => { const n = new Set(s); n.delete(key); return n; }); });
    timer.current = setTimeout(() => {
      setAcked((s) => new Set(s).add(key));
      setDone((n) => n + 1);
      if (next) { setPhase("sealed"); setView({ key: next.key, read: false }); }
      else { setView(null); setFinale(true); setBurst((b) => b + 1); celebrate(); chime(4); }
    }, STAMP_MS);
  }, [item, phase, pending]);

  const remaining = view && !view.read ? pending.filter((p) => p.key !== view.key).length : 0;
  const colors = useMemo(() => (item ? (item.tier === 4 ? [...HOLO_COLORS, "#ffffff"] : [TIER_COLORS[item.tier - 1], "#ffffff"]) : [...TIER_COLORS]), [item]);
  const open = !!item || finale;

  const sheet = (
    <BottomSheet open={open} onClose={close} className="pt-0">
      <Confetti burst={burst} origin={medal} colors={colors} count={finale ? 180 : item?.tier === 4 ? 160 : 100} />
      {finale ? (
        <Finale n={done} medalRef={medal} onClose={close} />
      ) : item && view ? (
        <Celebration
          item={item} read={view.read} phase={phase} done={done} remaining={remaining}
          medalRef={medal} onReveal={reveal} onValidate={validate}
        />
      ) : null}
    </BottomSheet>
  );

  return { all, pending, openPending, openRead, sheet };
}

function Celebration({ item, read, phase, done, remaining, medalRef, onReveal, onValidate }: {
  item: BadgeItem; read: boolean; phase: Phase; done: number; remaining: number;
  medalRef: React.RefObject<HTMLDivElement>; onReveal: () => void; onValidate: () => void;
}) {
  const reduce = useReducedMotion();
  const Icon = ICONS[item.icon];
  const color = TIER_COLORS[item.tier - 1];
  const sealed = phase === "sealed";
  const total = done + remaining + 1;

  return (
    <div className="flex flex-col items-center pb-2 text-center" aria-live="polite">
      {!read && total > 1 && (
        <div className="mb-3 flex gap-1.5" aria-label={`Badge ${done + 1} sur ${total}`}>
          {Array.from({ length: Math.min(total, 12) }, (_, i) => (
            <span key={i} className={cn("h-1.5 rounded-full transition-all duration-300", i < done ? "w-1.5 bg-good" : i === done ? "w-5 bg-brand" : "w-1.5 bg-ink/20")} />
          ))}
        </div>
      )}

      {/* Médaille : la secousse est sur l'enveloppe, le retournement 3D à l'intérieur. */}
      <motion.div
        key={item.key}
        ref={medalRef}
        initial={reduce ? false : { y: 40, scale: 0.6, opacity: 0 }}
        animate={reduce ? undefined : phase === "stamped" ? { y: 0, scale: [1, 1.08, 0.82], opacity: 1 } : sealed ? { y: 0, scale: 1, opacity: 1, rotate: [0, -6, 6, -4, 4, 0] } : { y: 0, scale: 1, opacity: 1, rotate: 0 }}
        transition={sealed ? { rotate: { duration: 0.6, repeat: Infinity, repeatDelay: 1.4 }, default: { type: "spring", stiffness: 240, damping: 18 } } : { type: "spring", stiffness: 260, damping: 15 }}
        className="relative mt-2 size-40 [perspective:900px]"
      >
        <button
          type="button"
          onClick={sealed ? onReveal : undefined}
          disabled={!sealed}
          aria-label={sealed ? "Révéler le badge" : item.name}
          className="size-full touch-manipulation rounded-full disabled:cursor-default"
        >
          <motion.span
            animate={{ rotateY: sealed ? 0 : 180 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 14 }}
            className="relative block size-full [transform-style:preserve-3d]"
          >
            {/* Face cachée */}
            <span
              className="absolute inset-0 grid place-items-center rounded-full bg-surface-3 [backface-visibility:hidden]"
              style={{ boxShadow: `0 0 0 6px ${color}, 0 0 40px -4px ${color}` }}
            >
              <span className="font-num text-metric-hero font-semibold text-ink-soft">?</span>
            </span>
            {/* Face révélée */}
            <span
              className="absolute inset-0 rounded-full [backface-visibility:hidden] [transform:rotateY(180deg)]"
              style={{ boxShadow: `0 0 60px 0 ${color}` }}
            >
              <TierMedal tier={item.tier} icon={Icon} className={item.tier === 4 ? "size-full" : "size-full border-[6px]"} iconClassName="size-20" ring={7} />
              {!reduce && !sealed && item.tier >= 3 && <Shine />}
            </span>
          </motion.span>
        </button>

        <AnimatePresence>
          {phase === "stamped" && (
            <motion.span
              initial={reduce ? false : { scale: 2.6, opacity: 0, rotate: -24 }}
              animate={{ scale: 1, opacity: 1, rotate: -14 }}
              transition={{ type: "spring", stiffness: 520, damping: 22 }}
              className="pointer-events-none absolute left-1/2 top-1/2 -ml-[4.5rem] -mt-6 grid h-12 w-36 place-items-center rounded-tile border-4 border-good bg-surface-2/80 text-xl font-black uppercase tracking-widest text-good"
            >
              Validé
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        {sealed ? (
          <motion.div key="sealed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-6 w-full">
            <p className={ui.label}>Nouveau badge · {DISC_LABEL[item.discipline]}</p>
            <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight">Palier {item.tierName} débloqué !</h2>
            <p className="mt-2 text-sm text-ink-soft">Touche la médaille pour découvrir lequel.</p>
            <button type="button" onClick={onReveal} className={cn(ui.btnPrimary, "mt-6 w-full")}>Révéler</button>
          </motion.div>
        ) : (
          <motion.div key="open" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: read ? 0 : 0.25 }} className="mt-5 w-full">
            <p className={ui.label}>{DISC_LABEL[item.discipline]} · <span className={TIER_TEXT[item.tier - 1]}>{item.tierName}</span></p>
            <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight">{item.name}</h2>
            <p className="mt-1 text-sm text-ink-soft">{TIER_LINES[item.tier - 1]}</p>

            <div className={cn(ui.card, "mt-5 bg-surface-3 p-4 text-left")}>
              <div className="flex items-baseline justify-between gap-3">
                <p className={ui.label}>Critère</p>
                <p className="text-label text-ink-mute">Obtenu le {dateFr(item.earnedAt)}</p>
              </div>
              <p className="mt-1 font-num text-metric-lg font-semibold tabular-nums">{item.criterion}</p>
              <p className="mt-1 text-sm text-ink-soft">{item.desc}</p>
            </div>

            {!read && (
              <div className="mt-6">
                <HoldButton onDone={onValidate} disabled={phase !== "open"} />
                <p className="mt-3 text-sm text-ink-mute">{remaining > 0 ? `Encore ${remaining} à découvrir ensuite` : "C'est le dernier !"}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Reflet qui balaie la médaille (paliers Or et Diamant). */
function Shine() {
  return (
    <motion.span
      aria-hidden
      initial={{ x: "-120%" }}
      animate={{ x: "120%" }}
      transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
    >
      <span className="absolute inset-y-0 left-1/3 w-1/4 -skew-x-12 bg-white/40 blur-sm" />
    </motion.span>
  );
}

/** Appui long : le bouton se remplit, la vibration monte, et ça valide quand c'est plein. Clavier : Entrée valide direct. */
function HoldButton({ onDone, disabled }: { onDone: () => void; disabled: boolean }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const tick = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const stop = () => { cancelAnimationFrame(raf.current); setP(0); };
  const begin = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const start = performance.now();
    tick.current = 0;
    const loop = (t: number) => {
      const v = Math.min(1, (t - start) / HOLD_MS);
      setP(v);
      const k = Math.floor(v * 6);
      if (k > tick.current) { tick.current = k; tap(4 + k * 3); }
      if (v >= 1) { setP(0); onDone(); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerCancel={stop}
      onClick={(e) => { if (e.detail === 0 && !disabled) onDone(); }} // activation clavier
      onContextMenu={(e) => e.preventDefault()}
      className={cn(ui.btnPrimary, "relative w-full touch-none overflow-hidden")}
    >
      <span aria-hidden className="absolute inset-0 origin-left bg-brand-ink/25" style={{ transform: `scaleX(${p})` }} />
      <span className="relative">{p > 0 ? "Encore un peu…" : "Maintiens pour valider"}</span>
    </button>
  );
}

function Finale({ n, medalRef, onClose }: { n: number; medalRef: React.RefObject<HTMLDivElement>; onClose: () => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col items-center pb-2 text-center">
      <motion.div
        ref={medalRef}
        initial={reduce ? false : { scale: 0.3, rotate: -30, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="mt-2 grid size-32 place-items-center rounded-full bg-brand text-brand-ink shadow-glow"
      >
        <Trophy className="size-16" strokeWidth={2} aria-hidden />
      </motion.div>
      <p className={cn(ui.label, "mt-6")}>Collection à jour</p>
      <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight">Tout est validé !</h2>
      <p className="mt-2 text-ink-soft">
        <span className="font-num text-metric-md font-semibold tabular-nums text-ink">{n}</span> badge{n > 1 ? "s" : ""} ajouté{n > 1 ? "s" : ""} à ta vitrine. Prochain objectif : le suivant.
      </p>
      <button type="button" onClick={onClose} className={cn(ui.btnPrimary, "mt-6 w-full")}>Trop bien</button>
    </div>
  );
}
