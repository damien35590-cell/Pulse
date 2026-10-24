import Link from "next/link";
import { redirect } from "next/navigation";
import type { ActivityType, Prisma } from "@prisma/client";
import { ChevronDown, Leaf } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn, uniqueById } from "@/lib/utils";
import { fmtDuration, fmtKm } from "@/lib/format";
import { ui } from "@/lib/ui";
import { SPORTS, SPORT_ORDER, isSoft } from "@/lib/sports";
import { activityStyle } from "@/lib/activity-style";
import { ActivityCard } from "@/components/dashboard/activity-card";
import { SoftRow } from "@/components/activity/soft-row";
import { FilterSheet } from "@/components/activity/filter-sheet";
import { TopBar } from "@/components/layout/top-bar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activités" };
const TZ = "Europe/Paris";
const PAGE = 20;

type Sp = { t?: string; sort?: string; m?: string; n?: string; soft?: string; p?: string };
const SPORT_TYPES = ["WORKOUT", "RUN", "RIDE", "HIKE"] as const;
const SORTS: Record<string, { label: string; orderBy: Prisma.ActivityOrderByWithRelationInput }> = {
  recent: { label: "Plus récentes", orderBy: { startedAt: "desc" } },
  old: { label: "Plus anciennes", orderBy: { startedAt: "asc" } },
  time: { label: "Plus longues", orderBy: { movingTimeS: "desc" } },
  dist: { label: "Plus de distance", orderBy: { distanceM: "desc" } },
};
const PERIODS: Record<string, string> = { all: "Tout", "30": "30 derniers jours", "90": "3 derniers mois", year: "Cette année" };
const FULL = {
  id: true, type: true, title: true, story: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true, polyline: true, avgHr: true, avgPower: true,
  exercises: { select: { sets: true, reps: true, loadKg: true } },
} satisfies Prisma.ActivitySelect;
type Full = Prisma.ActivityGetPayload<{ select: typeof FULL }>;
type Lite = { id: string; type: string; startedAt: Date; distanceM: number; movingTimeS: number };

const ymFmt = new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "2-digit", timeZone: TZ });
const monthKey = (d: Date) => { const p = ymFmt.formatToParts(d); return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`; };
const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: TZ });
const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;
const sum = (l: Lite[], f: (a: Lite) => number) => l.reduce((s, a) => s + f(a), 0);

export default async function ActivitiesPage({ searchParams }: { searchParams: Sp }) {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");

  const soft = searchParams.soft === "1";
  const pool: readonly string[] = soft ? SPORT_ORDER : SPORT_TYPES;
  const T = pool.includes(searchParams.t ?? "") ? searchParams.t! : null;
  const sortKey = searchParams.sort && SORTS[searchParams.sort] ? searchParams.sort : "recent";
  const period = searchParams.p && PERIODS[searchParams.p] ? searchParams.p : "all";
  const since = period === "all" ? null : period === "year" ? new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)) : new Date(Date.now() - Number(period) * 86_400_000);
  const types = T ? [T] : soft ? null : SPORT_TYPES;
  const where: Prisma.ActivityWhereInput = { userId: s.user.id, ...(types && { type: { in: types as ActivityType[] } }), ...(since && { startedAt: { gte: since } }) };
  const orderBy = [SORTS[sortKey].orderBy, { startedAt: "desc" as const }];
  const byDate = sortKey === "recent" || sortKey === "old";

  // Chronologique : années > mois repliables ; seules les cartes des mois ouverts sont chargées.
  // Autres tris : liste à plat, paginée par 20.
  let total = 0, flat: Full[] = [], hasMore = false, n = PAGE, openMonths: string[] = [];
  const years = new Map<string, Map<string, Lite[]>>(), full = new Map<string, Full>();
  if (byDate) {
    const all = await prisma.activity.findMany({ where, orderBy, select: { id: true, type: true, startedAt: true, distanceM: true, movingTimeS: true } });
    total = all.length;
    for (const a of all) {
      const mk = monthKey(a.startedAt), y = mk.slice(0, 4);
      if (!years.has(y)) years.set(y, new Map());
      const ms = years.get(y)!;
      ms.set(mk, [...(ms.get(mk) ?? []), a]);
    }
    openMonths = searchParams.m === undefined ? (all[0] ? [monthKey(all[0].startedAt)] : []) : searchParams.m.split(",").filter((k) => /^\d{4}-\d{2}$/.test(k));
    const ids = all.filter((a) => openMonths.includes(monthKey(a.startedAt))).map((a) => a.id);
    if (ids.length) for (const a of await prisma.activity.findMany({ where: { id: { in: ids } }, select: FULL })) full.set(a.id, a);
  } else {
    n = Math.min(Math.max(Number(searchParams.n) || PAGE, PAGE), 500);
    const [rows, count] = await Promise.all([prisma.activity.findMany({ where, orderBy, take: n + 1, select: FULL }), prisma.activity.count({ where })]);
    hasMore = rows.length > n;
    flat = uniqueById(rows.slice(0, n)); // filet de sécurité : jamais deux cartes pour le même id
    total = count;
  }

  const qs = (o: Sp) => {
    const v = { t: T ?? "", sort: sortKey, soft: soft ? "1" : "", p: period, m: searchParams.m ?? "", n: searchParams.n ?? "", ...o };
    const p = new URLSearchParams(Object.entries(v).filter(([k, x]) => x && !(k === "p" && x === "all") && !(k === "sort" && x === "recent")));
    return `/activities${p.size ? `?${p}` : ""}`;
  };
  const toggle = (mk: string) => { const next = openMonths.includes(mk) ? openMonths.filter((k) => k !== mk) : [...openMonths, mk]; return next.join(",") || "-"; };
  const chip = (on: boolean) => cn("inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.97]", on ? "bg-ink text-bg" : "bg-surface-2 text-ink-soft");
  const counts = (l: Lite[]) => {
    const nSoft = l.filter((a) => isSoft(a.type)).length;
    if (!soft) return `${plural(l.length, "séance")} · ${fmtDuration(sum(l, (a) => a.movingTimeS))}`;
    return nSoft && nSoft < l.length ? `${l.length - nSoft} sport. · ${nSoft} douce${nSoft > 1 ? "s" : ""}` : plural(l.length, "activité");
  };
  const filtered = T !== null || period !== "all";

  const monthBody = (lite: Lite[]) => {
    const list = lite.map((a) => full.get(a.id)).filter((a): a is Full => !!a);
    const sport = list.filter((a) => !isSoft(a.type)), softs = list.filter((a) => isSoft(a.type));
    const softRows = <div className="divide-y divide-line">{softs.map((a) => <SoftRow key={a.id} a={a} />)}</div>;
    return (
      <div className="space-y-2.5 pt-2.5">
        {sport.map((a) => <ActivityCard key={a.id} a={a} />)}
        {softs.length > 0 && (
          <details open={sport.length === 0} className="group/soft overflow-hidden rounded-xl border border-dashed border-line bg-surface/60">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-4 text-sm [&::-webkit-details-marker]:hidden">
              <Leaf className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
              <span className="font-semibold">{plural(softs.length, "activité")} douce{softs.length > 1 ? "s" : ""}</span>
              <span className="truncate text-ink-soft">{fmtKm(sum(softs, (a) => a.distanceM))} km · {fmtDuration(sum(softs, (a) => a.movingTimeS))}</span>
              <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-ink-soft transition-transform group-open/soft:rotate-180" aria-hidden />
            </summary>
            <div className="border-t border-dashed border-line">{softRows}</div>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <TopBar title="Activités" />

      <div className="space-y-3">
        <div className="sticky top-bar z-20 -mx-4 flex items-center gap-1 bg-bg/80 py-1 pl-4 pr-1 backdrop-blur-xl">
          <div className="no-scrollbar -ml-4 flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-contain pl-4 pr-2">
            <Link href={qs({ t: "", m: "", n: "" })} aria-current={T === null ? "page" : undefined} className={chip(T === null)}>Tous</Link>
            {pool.map((k) => <Link key={k} href={qs({ t: k, m: "", n: "" })} aria-current={T === k ? "page" : undefined} className={chip(T === k)}><span className={cn("size-2 shrink-0 rounded-full", activityStyle(k).dot)} aria-hidden />{SPORTS[k].label}</Link>)}
          </div>
          <FilterSheet sort={sortKey} soft={soft} period={period}
            sorts={Object.entries(SORTS).map(([k, v]) => [k, v.label])} periods={Object.entries(PERIODS)} />
        </div>
        <p className={ui.label}>{plural(total, "activité")}</p>
      </div>

      {total === 0 && (filtered
        ? <p className="rounded-xl border border-line bg-surface p-5 text-ink-soft">Aucune activité pour ce filtre. <Link href="/activities" className="font-semibold text-brand">Tout afficher</Link></p>
        : <p className="rounded-xl border border-line bg-surface p-5 text-ink-soft">Rien ici pour l’instant. <Link href="/record" className="font-semibold text-brand">Enregistrez une sortie</Link> ou <Link href="/import" className="font-semibold text-brand">importez vos fichiers</Link>.</p>
      )}

      {byDate && [...years].map(([y, months], yi) => {
        const yAll = [...months.values()].flat();
        const hasOpen = [...months.keys()].some((k) => openMonths.includes(k));
        return (
          <details key={y} open={yi === 0 || hasOpen} className="group/year">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <h2 className="font-display text-2xl font-bold tabular-nums">{y}</h2>
              <span className="flex items-center gap-2 text-sm text-ink-soft">
                {plural(yAll.length, "activité")}{sum(yAll, (a) => a.distanceM) > 0 && ` · ${fmtKm(sum(yAll, (a) => a.distanceM))} km`}
                <ChevronDown className="h-5 w-5 transition-transform group-open/year:rotate-180" aria-hidden />
              </span>
            </summary>
            <div className="mt-2 space-y-2">
              {[...months].map(([mk, list]) => {
                const open = openMonths.includes(mk);
                return (
                  <section key={mk}>
                    <Link href={qs({ m: toggle(mk) })} scroll={false} aria-expanded={open}
                      className={cn("flex min-h-12 items-center justify-between gap-3 rounded-xl px-4 transition-colors", open ? "bg-surface-2" : "bg-surface-2/60 active:bg-surface-2")}>
                      <h3 className="font-display text-lg font-bold capitalize">{monthName.format(list[0].startedAt)}</h3>
                      <span className="flex items-center gap-2 text-sm text-ink-soft">
                        {counts(list)}
                        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
                      </span>
                    </Link>
                    {open && monthBody(list)}
                  </section>
                );
              })}
            </div>
          </details>
        );
      })}

      {!byDate && flat.length > 0 && (
        <div className="space-y-2.5">
          {flat.map((a) => isSoft(a.type)
            ? <div key={a.id} className="overflow-hidden rounded-xl border border-dashed border-line bg-surface/60"><SoftRow a={a} /></div>
            : <ActivityCard key={a.id} a={a} />)}
          {hasMore && (
            <Link href={qs({ n: String(n + PAGE) })} scroll={false}
              className="flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface text-sm font-semibold text-brand">
              Voir plus <span className="ml-1 font-normal text-ink-soft">({flat.length} sur {total})</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
