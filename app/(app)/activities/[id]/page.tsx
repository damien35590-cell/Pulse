import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, CloudRain, Thermometer } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decodePolyline } from "@/lib/polyline";
import { haversine } from "@/lib/geo";
import { SPORTS } from "@/lib/sports";
import { fmtDuration, fmtKm, fmtNum, fmtPace } from "@/lib/format";
import { RouteMapLazy } from "@/components/activity/route-map-lazy";
import { ElevationChart } from "@/components/activity/elevation-chart";

export const dynamic = "force-dynamic";
const TZ = "Europe/Paris";
const FEELING: Record<string, string> = { GREAT: "Super", GOOD: "Bien", OK: "Correct", TIRED: "Fatigué", HARD: "Difficile" };
type TP = { lat: number; lng: number; ele?: number; t: number };

export default async function ActivityPage({ params }: { params: { id: string } }) {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const a = await prisma.activity.findFirst({ where: { id: params.id, userId: s.user.id } });
  if (!a) notFound();

  const route = a.polyline ? decodePolyline(a.polyline) : [];
  const tp = ((a.trackPoints as TP[] | null) ?? []).filter((p) => typeof p.ele === "number");
  let km = 0;
  const full = tp.map((p, i) => { if (i) km += haversine({ ...tp[i - 1], t: 0 }, { ...p, t: 0 }) / 1000; return { km, ele: p.ele as number }; });
  const step = Math.max(1, Math.ceil(full.length / 120));
  const profile = full.filter((_, i) => i % step === 0);

  const pace = fmtPace(a.distanceM, a.movingTimeS, a.type);
  const w = a.weather as { tempC?: number | null; precipMm?: number | null } | null;
  const stats = [
    { l: "Distance", v: `${fmtKm(a.distanceM)} km` }, { l: "Durée", v: fmtDuration(a.movingTimeS) },
    pace && { l: pace.label, v: `${pace.value} ${pace.unit}` },
    a.elevationGainM > 0 && { l: "Dénivelé +", v: `${fmtNum(a.elevationGainM, 0)} m` },
    a.calories && { l: "Calories", v: `${fmtNum(a.calories, 0)} kcal` }, a.avgHr && { l: "FC moyenne", v: `${a.avgHr} bpm` },
  ].filter(Boolean) as { l: string; v: string }[];

  return (
    <article className="space-y-5">
      <Link href="/activities" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand"><ChevronLeft className="h-5 w-5" aria-hidden />Activités</Link>
      <header>
        <p className="text-sm capitalize text-ink-soft">{SPORTS[a.type]?.label}, {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(a.startedAt)}</p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-tight">{a.title}</h1>
      </header>
      {a.story && <p className="rounded-xl bg-surface-2 px-4 py-3 text-[17px] leading-snug">{a.story}</p>}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {stats.map((x) => <div key={x.l} className="bg-surface px-4 py-3"><dt className="text-xs text-ink-soft">{x.l}</dt><dd className="font-display text-2xl font-bold tabular-nums">{x.v}</dd></div>)}
      </dl>
      {route.length > 1 && <RouteMapLazy points={route} />}
      {profile.length > 5 && <section><h2 className="mb-2 font-display text-lg font-bold">Altitude</h2><ElevationChart data={profile} /></section>}
      {(w || a.feeling) && (
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
          {w?.tempC != null && <span className="inline-flex items-center gap-1.5"><Thermometer className="h-4 w-4" aria-hidden />{Math.round(w.tempC)} °C au départ</span>}
          {(w?.precipMm ?? 0) >= 1 && <span className="inline-flex items-center gap-1.5"><CloudRain className="h-4 w-4" aria-hidden />{fmtNum(w!.precipMm!, 1)} mm de pluie</span>}
          {a.feeling && <span>Ressenti : {FEELING[a.feeling]}</span>}
        </p>
      )}
      {a.notes && <p className="whitespace-pre-line rounded-xl border border-line bg-surface p-4">{a.notes}</p>}
    </article>
  );
}
