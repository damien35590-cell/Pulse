"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { acknowledgeBadge } from "@/app/actions";
import type { BadgeItem } from "@/lib/badges";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { DISC_LABEL, ICONS, TIER_COLORS } from "./badge-meta";

type View = { key: string; read: boolean };

const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(iso));

/**
 * État partagé de la validation des badges (grille, carte d'accueil) : paliers à valider, mise à jour optimiste,
 * et la feuille de célébration à rendre une fois dans le composant (`sheet`).
 */
export function useBadgeReview(items: BadgeItem[]) {
  const [acked, setAcked] = useState<ReadonlySet<string>>(new Set());
  const [view, setView] = useState<View | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const all = useMemo(() => items.map((i) => (acked.has(i.key) ? { ...i, acknowledged: true } : i)), [items, acked]);
  const pending = useMemo(() => all.filter((i) => !i.acknowledged), [all]); // déjà triés du plus ancien au plus récent

  const openPending = useCallback((key?: string) => {
    const first = key ?? pending[0]?.key;
    if (first) setView({ key: first, read: false });
  }, [pending]);
  const openRead = useCallback((key: string) => setView({ key, read: true }), []);
  const close = useCallback(() => { clearTimeout(timer.current); setCelebrating(false); setView(null); }, []);

  const validate = useCallback((key: string) => {
    if (celebrating) return;
    tap(24);
    setCelebrating(true);
    // Le suivant est figé maintenant : le rafraîchissement serveur pendant l'animation ne le change pas.
    const next = pending.find((p) => p.key !== key);
    acknowledgeBadge(key)
      .then((r) => { if (!r.ok) throw new Error(r.error); })
      .catch((e) => { console.error("[badges] validation", e); setAcked((s) => { const n = new Set(s); n.delete(key); return n; }); });
    timer.current = setTimeout(() => {
      setAcked((s) => new Set(s).add(key));
      setCelebrating(false);
      setView(next ? { key: next.key, read: false } : null);
    }, 380);
  }, [celebrating, pending]);

  const item = view ? all.find((i) => i.key === view.key) ?? null : null;
  const remaining = view && !view.read ? pending.filter((p) => p.key !== view.key).length : 0;
  const sheet = (
    <BottomSheet open={!!item} onClose={close} className="pt-0">
      {item && view && <Celebration item={item} read={view.read} remaining={remaining} busy={celebrating} onValidate={() => validate(item.key)} />}
    </BottomSheet>
  );

  return { all, pending, openPending, openRead, sheet };
}

function Celebration({ item, read, remaining, busy, onValidate }: {
  item: BadgeItem; read: boolean; remaining: number; busy: boolean; onValidate: () => void;
}) {
  const reduce = useReducedMotion();
  const Icon = ICONS[item.icon];
  const color = TIER_COLORS[item.tier - 1];
  return (
    <div className="flex flex-col items-center pb-2 text-center" aria-live="polite">
      <motion.div
        key={item.key}
        initial={reduce ? false : { scale: 0.5, opacity: 0, rotate: -12 }}
        animate={reduce ? undefined : busy ? { scale: [1, 1.18, 0.9], rotate: [0, 8, 0] } : { scale: 1, opacity: 1, rotate: 0 }}
        transition={busy ? { duration: 0.38 } : { type: "spring", stiffness: 260, damping: 16 }}
        className="relative mt-2 grid size-28 place-items-center rounded-full bg-brand text-brand-ink shadow-glow"
        style={{ boxShadow: `0 0 0 5px ${color}` }}
      >
        <Icon className="size-14" strokeWidth={2} aria-hidden />
        {busy && <Check className="absolute -bottom-1 -right-1 size-9 rounded-full bg-good p-1.5 text-brand-ink" strokeWidth={3} aria-hidden />}
      </motion.div>

      <p className={cn(ui.label, "mt-5")}>{DISC_LABEL[item.discipline]} · {item.tierName}</p>
      <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight">{item.name}</h2>
      <p className="mt-1 text-sm text-ink-mute">Obtenu le {dateFr(item.earnedAt)}</p>

      <div className={cn(ui.card, "mt-5 w-full bg-surface-3 p-4 text-left")}>
        <p className={ui.label}>Critère</p>
        <p className="mt-1 font-num text-metric-md tabular-nums">{item.criterion}</p>
        <p className="mt-1 text-sm text-ink-soft">{item.desc}</p>
      </div>

      {!read && (
        <div className="mt-6 w-full">
          <button type="button" onClick={onValidate} disabled={busy} className={cn(ui.btnPrimary, "w-full")}>Valider</button>
          {remaining > 0 && <p className="mt-3 text-sm text-ink-mute">Encore {remaining} à valider ensuite</p>}
        </div>
      )}
    </div>
  );
}
