"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getCountdown, raceDayKey } from "@/lib/races/time";
import { datePill, fmtHms, fmtRaceDistance, fmtRank, monthLabel, STATUS_LABEL } from "@/lib/races/format";
import type { RaceView } from "@/lib/races/view";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";

type Tab = "upcoming" | "past";

function Badge({ children, tone = "soft" }: { children: React.ReactNode; tone?: "brand" | "soft" }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold", tone === "brand" ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-soft")}>{children}</span>;
}

function Row({ r, now, past }: { r: RaceView; now: Date; past: boolean }) {
  const p = datePill(r.date), c = getCountdown(r, now);
  const result = r.resultTimeS || r.rankOverall;
  return (
    <li>
      <Link href={`/events/${r.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition hover:border-brand/40 active:scale-[.99] active:bg-surface-2">
        <span className={cn("grid h-14 w-14 shrink-0 place-content-center rounded-xl text-center leading-none", past ? "bg-surface-2 text-ink-soft" : "bg-brand-soft text-brand")}>
          <span className="font-display text-xl font-bold">{p.d}</span><span className="mt-0.5 text-[10px] font-bold tracking-wide">{p.m}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{r.name}</span>
          <span className="block truncate text-sm text-ink-soft">
            {[r.targetDistance ? fmtRaceDistance(r.targetDistance) : null, r.location].filter(Boolean).join(" · ") || " "}
          </span>
          {past && (
            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
              {result ? <span className="font-semibold tabular-nums">{[r.resultTimeS ? fmtHms(r.resultTimeS) : null, r.rankOverall ? fmtRank(r.rankOverall, r.participants) : null].filter(Boolean).join(" · ")}</span>
                : r.status === "REGISTERED" ? <Badge tone="brand">Résultat à saisir</Badge> : null}
              {(r.status === "DNS" || r.status === "DNF") && <Badge>{STATUS_LABEL[r.status]}</Badge>}
            </span>
          )}
        </span>
        {!past && <span className={cn("shrink-0 font-display text-lg font-bold", c.isToday || c.days <= 7 ? "text-brand" : "text-ink")}>{c.short}</span>}
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
      </Link>
    </li>
  );
}

const WEEK = ["L", "M", "M", "J", "V", "S", "D"];

/** Mini calendrier mensuel : une pastille par jour de course, tap = détail de la course. */
function MonthCalendar({ races, todayKey, initial }: { races: RaceView[]; todayKey: string; initial: string }) {
  const [ym, setYm] = useState(initial.slice(0, 7));
  const byDay = useMemo(() => { const m = new Map<string, RaceView>(); for (const r of races) if (!m.has(r.date)) m.set(r.date, r); return m; }, [races]);
  const [y, mo] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1)), lead = (first.getUTCDay() + 6) % 7, len = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const shift = (n: number) => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); setYm(d.toISOString().slice(0, 7)); };
  const count = races.filter((r) => r.date.startsWith(ym)).length;
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => shift(-1)} aria-label="Mois précédent" className="grid h-11 w-11 place-items-center rounded-lg text-ink-soft active:bg-surface-2"><ChevronLeft className="h-5 w-5" /></button>
        <p className="font-semibold">{monthLabel(`${ym}-01`)}<span className="ml-1.5 text-sm font-normal text-ink-soft">{count ? `· ${count} course${count > 1 ? "s" : ""}` : ""}</span></p>
        <button onClick={() => shift(1)} aria-label="Mois suivant" className="grid h-11 w-11 place-items-center rounded-lg text-ink-soft active:bg-surface-2"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
        {WEEK.map((d, i) => <span key={i} className="pb-1 text-[11px] font-semibold text-ink-soft">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: len }, (_, i) => {
          const key = `${ym}-${String(i + 1).padStart(2, "0")}`, r = byDay.get(key), today = key === todayKey, past = key < todayKey;
          const cls = cn("mx-auto grid h-10 w-10 place-items-center rounded-full tabular-nums", today && "ring-2 ring-brand/60", r ? (past ? "bg-surface-2 font-bold text-ink" : "bg-brand font-bold text-brand-ink") : past ? "text-ink-soft/60" : "text-ink");
          return r ? <Link key={key} href={`/events/${r.id}`} aria-label={`${r.name}, ${i + 1}`} className={cls}>{i + 1}</Link> : <span key={key} className={cls}>{i + 1}</span>;
        })}
      </div>
    </div>
  );
}

export function RaceList({ races, now: nowIso }: { races: RaceView[]; now: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const todayKey = raceDayKey(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now));
  const upcoming = races.filter((r) => !getCountdown(r, now).isPast);
  const past = races.filter((r) => getCountdown(r, now).isPast).reverse();
  const toFill = past.filter((r) => r.status === "REGISTERED").length;
  const [tab, setTab] = useState<Tab>(upcoming.length || !past.length ? "upcoming" : "past");
  const [cal, setCal] = useState(false);
  const list = tab === "upcoming" ? upcoming : past;

  const groups: { label: string; items: RaceView[] }[] = [];
  for (const r of list) { const label = monthLabel(r.date); const g = groups.at(-1); if (g?.label === label) g.items.push(r); else groups.push({ label, items: [r] }); }

  return (
    <section aria-label="Toutes les courses" className="space-y-3">
      <div role="tablist" className="grid grid-cols-2 rounded-xl bg-surface-2 p-1">
        {([["upcoming", "À venir", upcoming.length], ["past", "Passées", past.length]] as const).map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { tap(6); setTab(k); }}
            className={cn("relative min-h-11 rounded-lg text-sm font-semibold transition", tab === k ? "bg-surface text-ink shadow-sm" : "text-ink-soft")}>
            {l} <span className="tabular-nums text-ink-soft">{n}</span>
            {k === "past" && toFill > 0 && <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-brand" aria-label={`${toFill} résultat(s) à saisir`} />}
          </button>
        ))}
      </div>

      <button onClick={() => setCal((v) => !v)} aria-expanded={cal} className="flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-sm font-semibold text-ink-soft">
        Calendrier<ChevronDown className={cn("h-4 w-4 transition", cal && "rotate-180")} aria-hidden />
      </button>
      {cal && <MonthCalendar races={races} todayKey={todayKey} initial={(tab === "upcoming" ? upcoming[0]?.date : past[0]?.date) ?? todayKey} />}

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-ink-soft">{tab === "upcoming" ? "Aucune course à venir." : "Aucune course passée pour l’instant."}</p>
      ) : groups.map((g) => (
        <div key={g.label} className="space-y-2">
          <h3 className="px-1 pt-1 text-xs font-bold uppercase tracking-wider text-ink-soft">{g.label}</h3>
          <ul className="space-y-2">{g.items.map((r) => <Row key={r.id} r={r} now={now} past={tab === "past"} />)}</ul>
        </div>
      ))}
    </section>
  );
}
