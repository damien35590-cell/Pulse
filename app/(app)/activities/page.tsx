import Link from "next/link";
import { redirect } from "next/navigation";
import type { ActivityType, Prisma } from "@prisma/client";
import { ChevronDown, Leaf } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn, uniqueById } from "@/lib/utils";
import { fmtDuration, fmtKm } from "@/lib/format";
import { SPORTS, SPORT_ORDER, SOFT_TYPES, isSoft } from "@/lib/sports";
import { ActivityCard } from "@/components/dashboard/activity-card";
import { SoftRow } from "@/components/activity/soft-row";
import { SortMenu } from "@/components/activity/sort-menu";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activités" };
const TZ = "Europe/Paris";
const PAGE = 20;

type Sp = { c?: string; t?: string; sort?: string; m?: string; n?: string };
const CATS = [["all", "Toutes"], ["sport", "Sportives"], ["soft", "Douces"]] as const;
const SPORT_TYPES = ["WORKOUT", "RUN", "RIDE", "HIKE"] as const;
const SORTS: Record<string, { label: string; orderBy: Prisma.ActivityOrderByWithRelationInput }> = {
  recent: { label: "Plus récentes", orderBy: { startedAt: "desc" } },
  old: { label: "Plus anciennes", orderBy: { startedAt: "asc" } },
  dist: { label: "Distance", orderBy: { distanceM: "desc" } },
  time: { label: "Durée", orderBy: { movingTimeS: "desc" } },
  elev: { label: "Dénivelé", orderBy: { elevationGainM: "desc" } },
};
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

  const C = CATS.some(([k]) => k === searchParams.c) ? searchParams.c! : "all";
  const pool: readonly string[] = C === "soft" ? SOFT_TYPES : C === "sport" ? SPORT_TYPES : SPORT_ORDER;
  const T = pool.includes(searchParams.t ?? "") ? searchParams.t! : null;
  const sortKey = searchParams.sort && SORTS[searchParams.sort] ? searchParams.sort : "recent";
  const types = T ? [T] : C === "all" ? null : pool;
  const where: Prisma.ActivityWhereInput = { userId: s.user.id, ...(types && { type: { in: types as ActivityType[] } }) };
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
    const v = { c: C, t: T ?? "", sort: sortKey, m: searchParams.m ?? "", n: searchParams.n ?? "", ...o };
    const p = new URLSearchParams(Object.entries(v).filter(([k, x]) => x && !(k === "c" && x === "all") && !(k === "sort" && x === "recent")));
    return `/activities${p.size ? `?${p}` : ""}`;
  };
  const toggle = (mk: string) => { const next = openMonths.includes(mk) ? openMonths.filter((k) => k !== mk) : [...openMonths, mk]; return next.join(",") || "-"; };
  const chip = (on: boolean) => cn("inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium", on ? "bg-brand text-brand-ink" : "bg-surface-2");
  const counts = (l: Lite[]) => { const soft = l.filter((a) => isSoft(a.type)).length; return C === "all" && soft && soft < l.length ? `${l.length - soft} sport. · ${soft} douce${soft > 1 ? "s" : ""}` : plural(l.length, "activité"); };
  const filtered = C !== "all" || T !== null;

  const monthBody = (lite: Lite[]) => {
    const list = lite.map((a) => full.get(a.id)).filter((a): a is Full => !!a);
    const sport = list.filter((a) => !isSoft(a.type)), soft = list.filter((a) => isSoft(a.type));
    const softRows = <div className="divide-y divide-line">{soft.map((a) => <SoftRow key={a.id} a={a} />)}</div>;
    return (
      <div className="space-y-2.5 pt-2.5">
        {sport.map((a) => <ActivityCard key={a.id} a={a} />)}
        {soft.length > 0 && (C === "soft" ? (
          <div className="overflow-hidden rounded-xl border border-dashed border-line bg-surface/60">{softRows}</div>
        ) : (
          <details open={sport.length === 0} className="group/soft overflow-hidden rounded-xl border border-dashed border-line bg-surface/60">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-4 text-sm [&::-webkit-details-marker]:hidden">
              <Leaf className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
              <span className="font-semibold">{plural(soft.length, "activité")} douce{soft.length > 1 ? "s" : ""}</span>
              <span className="truncate text-ink-soft">{fmtKm(sum(soft, (a) => a.distanceM))} km · {fmtDuration(sum(soft, (a) => a.movingTimeS))}</span>
              <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-ink-soft transition-transform group-open/soft:rotate-180" aria-hidden />
            </summary>
            <div className="border-t border-dashed border-line">{softRows}</div>
          </details>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold leading-none">Activités</h1>

      <div className="space-y-2.5">
        <nav aria-label="Catégorie" className="flex gap-1 rounded-full bg-surface-2 p-1">
          {CATS.map(([k, l]) => (
            <Link key={k} href={qs({ c: k, t: "", m: "", n: "" })} aria-current={C === k ? "page" : undefined}
              className={cn("flex min-h-10 flex-1 items-center justify-center rounded-full text-sm", C === k ? "bg-surface font-bold shadow" : "text-ink-soft")}>{l}</Link>
          ))}
        </nav>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Link href={qs({ t: "", m: "", n: "" })} className={chip(T === null)}>Tous</Link>
          {pool.map((k) => { const I = SPORTS[k].icon; return <Link key={k} href={qs({ t: k, m: "", n: "" })} className={chip(T === k)}><I className="h-4 w-4" aria-hidden />{SPORTS[k].label}</Link>; })}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">{plural(total, "activité")}</p>
          <SortMenu value={sortKey} options={Object.entries(SORTS).map(([k, v]) => [k, v.label])} />
        </div>
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
