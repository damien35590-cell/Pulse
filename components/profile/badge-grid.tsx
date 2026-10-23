"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Lock, X } from "lucide-react";
import type { BadgeItem, Discipline, EvaluatedBadge } from "@/lib/badges";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";
import { useBadgeReview } from "./badge-celebration";
import { DISC_LABEL, ICONS, TIER_COLORS } from "./badge-meta";

type Tab = "ALL" | Discipline;
const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "Tous" }, { key: "GLOBAL", label: "Général" }, { key: "RIDE", label: "Vélo" },
  { key: "RUN", label: "Running" }, { key: "HIKE", label: "Rando" }, { key: "WORKOUT", label: "Muscu" },
];
const TIER_NAMES = ["Bronze", "Argent", "Or", "Diamant"];

const fmt = (n: number, dec = 0) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: dec }).format(n);
const left = (target: number, value: number, dec: number) => {
  const k = 10 ** dec;
  return Math.max(0, Math.ceil((target - value) * k) / k);
};
/** Avancement (0 → 1) entre le palier actuel et le suivant. */
const progressToNext = (b: EvaluatedBadge) => {
  if (b.next === null) return 1;
  const lo = b.tier === 0 ? 0 : b.tiers[b.tier - 1];
  return Math.max(0, Math.min(1, (b.value - lo) / (b.next - lo)));
};

export function BadgeGrid({ badges, items }: { badges: EvaluatedBadge[]; items: BadgeItem[] }) {
  const review = useBadgeReview(items);
  const [tab, setTab] = useState<Tab>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const close = useCallback(() => setOpenId(null), []);

  // Badges à valider d'abord (tri stable : le reste garde l'ordre du catalogue).
  const pendingIds = useMemo(() => new Set(review.pending.map((p) => p.badgeId)), [review.pending]);
  const list = useMemo(() => {
    const l = tab === "ALL" ? badges : badges.filter((b) => b.discipline === tab);
    return [...l].sort((a, b) => Number(pendingIds.has(b.id)) - Number(pendingIds.has(a.id)));
  }, [badges, tab, pendingIds]);

  /** À valider → feuille de célébration au plus ancien palier en attente ; validé → lecture seule ; sinon détail. */
  const onBadge = (b: EvaluatedBadge) => {
    tap();
    const firstPending = review.pending.find((p) => p.badgeId === b.id);
    if (firstPending) return review.openPending(firstPending.key);
    const top = review.all.filter((i) => i.badgeId === b.id).sort((x, y) => y.tier - x.tier)[0];
    if (top) return review.openRead(top.key);
    setOpenId(b.id);
  };
  const earned = list.filter((b) => b.tier > 0).length;
  const medals = list.reduce((n, b) => n + b.tier, 0);
  const maxMedals = list.length * 4;
  const upcoming = useMemo(
    () => list.filter((b) => b.next !== null && b.value > 0).sort((a, b) => progressToNext(b) - progressToNext(a)).slice(0, 3),
    [list],
  );
  const open = badges.find((b) => b.id === openId) ?? null;

  return (
    <section>
      <h2 className="mb-2 font-display text-xl font-bold">
        Badges <span className="font-medium text-ink-soft">({earned}/{list.length})</span>
      </h2>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Discipline">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold ${tab === t.key ? "bg-brand text-brand-ink" : "border border-line bg-surface text-ink-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-line bg-surface p-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold">Médailles</p>
          <p className="text-sm tabular-nums text-ink-soft">{medals} / {maxMedals}</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-brand" style={{ width: `${maxMedals ? Math.round((medals / maxMedals) * 100) : 0}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-soft">
          {TIER_NAMES.map((n, i) => (
            <span key={n} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLORS[i] }} />{n}
            </span>
          ))}
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-bold text-ink-soft">Prochains paliers</h3>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {upcoming.map((b) => {
              const I = ICONS[b.icon];
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setOpenId(b.id)}
                  className="w-52 shrink-0 rounded-xl border border-line bg-surface p-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft"><I className="h-4 w-4" aria-hidden /></span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold leading-tight">{b.name}</p>
                      <p className="text-[11px] leading-tight text-ink-soft">vers {TIER_NAMES[b.tier]}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${Math.round(progressToNext(b) * 100)}%`, background: TIER_COLORS[b.tier] }} />
                  </div>
                  <p className="mt-1 text-[11px] tabular-nums text-ink-soft">
                    Encore {fmt(left(b.next as number, b.value, b.decimals), b.decimals)} {b.unit}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ul className="grid grid-cols-2 gap-2.5">
        {list.map((b) => {
          const I = ICONS[b.icon];
          const on = b.tier > 0, isNew = pendingIds.has(b.id);
          return (
            <li key={b.id} className="relative">
              <button
                type="button"
                onClick={() => onBadge(b)}
                aria-label={isNew ? `${b.name}, nouveau, à valider` : undefined}
                className={cn("min-h-12 h-full w-full rounded-xl border border-line bg-surface p-3 text-left", !on && "opacity-70", isNew && "border-brand shadow-glow")}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-full ${on ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-soft"}`}
                    style={on ? { boxShadow: `0 0 0 3px ${TIER_COLORS[b.tier - 1]}` } : undefined}
                  >
                    <I className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="flex gap-1" role="img" aria-label={on ? `Niveau ${TIER_NAMES[b.tier - 1]}` : "Verrouillé"}>
                    {b.tiers.map((_, i) => (
                      <span key={i} className="h-2 w-2 rounded-full bg-line" style={i < b.tier ? { background: TIER_COLORS[i] } : undefined} />
                    ))}
                  </span>
                </div>
                <p className="mt-2 text-[13px] font-bold leading-tight">{b.name}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-ink-soft">{b.desc}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(progressToNext(b) * 100)}%` }} />
                </div>
                <p className="mt-1 text-[11px] tabular-nums text-ink-soft">
                  {b.next === null ? "Diamant atteint" : `${fmt(b.value, b.decimals)} / ${fmt(b.next, b.decimals)} ${b.unit}`}
                </p>
              </button>
              {isNew && (
                <span className="pointer-events-none absolute -top-2 right-3 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-brand-ink">Nouveau</span>
              )}
            </li>
          );
        })}
      </ul>

      {review.sheet}
      {open && <BadgeSheet b={open} onClose={close} />}
    </section>
  );
}

function BadgeSheet({ b, onClose }: { b: EvaluatedBadge; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const I = ICONS[b.icon];
  const on = b.tier > 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" aria-label={b.name} onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

        <div className="flex items-start gap-4">
          <span
            className={`grid h-16 w-16 shrink-0 place-items-center rounded-full ${on ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-soft"}`}
            style={on ? { boxShadow: `0 0 0 3px ${TIER_COLORS[b.tier - 1]}` } : undefined}
          >
            <I className="h-8 w-8" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{DISC_LABEL[b.discipline]}</p>
            <h3 className="font-display text-2xl font-bold leading-tight">{b.name}</h3>
            <p className="mt-0.5 text-sm text-ink-soft">{b.desc}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <p className="mt-4 font-display text-4xl font-bold tabular-nums">
          {fmt(b.value, b.decimals)} <span className="text-lg font-medium text-ink-soft">{b.unit}</span>
        </p>
        <p className="text-sm text-ink-soft">
          {b.tier === 0 ? "Aucun niveau atteint pour l’instant." : b.tier === 4 ? "Niveau Diamant atteint : sommet du badge." : `Niveau actuel : ${TIER_NAMES[b.tier - 1]}`}
        </p>

        <ol className="mt-5 space-y-4">
          {b.tiers.map((t, i) => {
            const reached = b.value >= t;
            const isNext = b.tier === i;
            const lo = i === 0 ? 0 : b.tiers[i - 1];
            const fill = reached ? 1 : Math.max(0, Math.min(1, (b.value - lo) / (t - lo)));
            return (
              <li key={i} className="flex items-start gap-3">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${reached ? "" : "bg-surface-2 text-ink-soft"}`}
                  style={reached ? { background: TIER_COLORS[i], color: "#1a1a1a" } : isNext ? { boxShadow: `inset 0 0 0 2px ${TIER_COLORS[i]}` } : undefined}
                >
                  {reached ? <Check className="h-5 w-5" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-2">
                    <b>{TIER_NAMES[i]}</b>
                    <span className="text-sm tabular-nums text-ink-soft">{fmt(t, b.decimals)} {b.unit}</span>
                  </p>
                  {reached ? (
                    <p className="text-[13px] text-ink-soft">Atteint</p>
                  ) : (
                    <>
                      {isNext && (
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full" style={{ width: `${Math.round(fill * 100)}%`, background: TIER_COLORS[i] }} />
                        </div>
                      )}
                      <p className="mt-1 text-[13px] text-ink-soft">Encore {fmt(left(t, b.value, b.decimals), b.decimals)} {b.unit}</p>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}