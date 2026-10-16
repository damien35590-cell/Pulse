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
import { TopoMapLazy } from "@/components/activity/topo-map-lazy";
import { TimeInZones } from "@/components/activity/time-in-zones";
import { getZones } from "@/lib/data/zones";
import { bounds, HR_PCT, POWER_PCT, timeInZones } from "@/lib/zones";
import { detectIntervals } from "@/lib/detect-intervals";
import type { StreamData } from "@/lib/stream";
import { ElevationChart } from "@/components/activity/elevation-chart";
import { PowerChart } from "@/components/activity/power-chart";
import { FeelNote } from "@/components/activity/feelnote";
import { BikeTypeSwitch } from "@/components/activity/bike-type-switch";

export const dynamic = "force-dynamic";
const TZ = "Europe/Paris";
type TP = { lat?: number; lng?: number; ele?: number; t: number; hr?: number; power?: number; cad?: number };

function feelingToInt(feeling: string | null): number | null {
  switch (feeling) {
    case "GREAT": return 1;
    case "GOOD": return 2;
    case "OK": return 3;
    case "TIRED": return 4;
    case "HARD": return 5;
    default: return null;
  }
}

export default async function ActivityPage({ params }: { params: { id: string } }) {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const a = await prisma.activity.findFirst({ where: { id: params.id, userId: s.user.id }, include: { exercises: { orderBy: { position: "asc" } }, stream: true } });
  if (!a) notFound();

  const route = a.polyline ? decodePolyline(a.polyline) : [];
  const raw = (a.trackPoints as TP[] | null) ?? [];
  const tp = raw.filter((p) => typeof p.ele === "number" && p.lat != null && p.lng != null);
  const t0 = raw[0]?.t ?? 0;
  const series = raw.filter((p) => p.power != null || p.hr != null).map((p) => ({ min: (p.t - t0) / 60000, power: p.power, hr: p.hr }));
  const gps = raw.filter((p) => p.lat != null && p.lng != null) as { lat: number; lng: number; ele?: number; t: number }[];
  
  const st = (a.stream?.data ?? null) as StreamData | null, zones = await getZones(s.user.id);
  const powerTiz = st?.power?.length && zones.ftp ? timeInZones(st.power, bounds(zones.ftp, POWER_PCT)) : null;
  const hrTiz = st?.hr?.length && zones.hrMax ? timeInZones(st.hr, bounds(zones.hrMax, HR_PCT), true) : null;
  const thr = zones.ftp ? Math.round(zones.ftp * 0.9) : 0;
  const intervals = st?.power?.length && thr ? detectIntervals(st.power.map((p, k) => ({ t: k, power: p, hr: st.hr[k] })), thr) : [];
  const mmss = (x: number) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, "0")}`;
  
  let km = 0;
  const full = tp.map((p, i) => { if (i) km += haversine({ lat: tp[i - 1].lat!, lng: tp[i - 1].lng!, t: 0 }, { lat: p.lat!, lng: p.lng!, t: 0 }) / 1000; return { km, ele: p.ele as number }; });
  const step = Math.max(1, Math.ceil(full.length / 120));
  const profile = full.filter((_, i) => i % step === 0);

  const pace = fmtPace(a.distanceM, a.movingTimeS, a.type);
  const w = a.weather as { tempC?: number | null; precipMm?: number | null } | null;
  const stats = [
    a.type !== "WORKOUT" && { l: "Distance", v: `${fmtKm(a.distanceM)} km` }, { l: "Durée", v: fmtDuration(a.movingTimeS) },
    pace && { l: pace.label, v: `${pace.value} ${pace.unit}` },
    a.elevationGainM > 0 && { l: "Dénivelé +", v: `${fmtNum(a.elevationGainM, 0)} m` },
    a.avgPower && { l: "Puissance moyenne", v: `${a.avgPower} W` }, a.maxPower && { l: "Puissance max", v: `${a.maxPower} W` },
    a.calories && { l: "Calories", v: `${fmtNum(a.calories, 0)} kcal` }, a.avgHr && { l: "FC moyenne", v: `${a.avgHr} bpm` },
  ].filter(Boolean) as { l: string; v: string }[];

  return (
    <article className="space-y-5">
      <Link href="/activities" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand"><ChevronLeft className="h-5 w-5" aria-hidden />Activités</Link>
      <header>
        <p className="text-sm capitalize text-ink-soft">{SPORTS[a.type]?.label}, {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(a.startedAt)}</p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-tight">{a.title}</h1>
        {(a.type === "RIDE" || a.type === "EBIKE") && <div className="mt-3"><BikeTypeSwitch activityId={a.id} type={a.type} /></div>}
      </header>
      {a.story && <p className="rounded-xl bg-surface-2 px-4 py-3 text-[17px] leading-snug">{a.story}</p>}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {stats.map((x) => <div key={x.l} className="bg-surface px-4 py-3"><dt className="text-xs text-ink-soft">{x.l}</dt><dd className="font-display text-2xl font-bold tabular-nums">{x.v}</dd></div>)}
      </dl>
      {gps.length > 1 ? <TopoMapLazy points={gps} /> : route.length > 1 && <RouteMapLazy points={route} />}
      {profile.length > 5 && <section><h2 className="mb-2 font-display text-lg font-bold">Altitude</h2><ElevationChart data={profile} /></section>}
      {series.length > 5 && <section><h2 className="mb-2 font-display text-lg font-bold">Puissance et cardio</h2><PowerChart data={series} /></section>}
      {(powerTiz || hrTiz) && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold">Temps par zone</h2>
          <TimeInZones power={powerTiz ?? undefined} hr={hrTiz ?? undefined} />
          <p className="mt-1 text-xs text-ink-soft">{zones.ftp && powerTiz ? `FTP ${zones.ftp} W${zones.ftpManual ? "" : " (estimée)"}. ` : ""}{zones.hrMax && hrTiz ? `FC max ${zones.hrMax} bpm${zones.hrManual ? "" : " (estimée)"}.` : ""} Réglable dans l’onglet Vous.</p>
        </section>
      )}
      {intervals.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold">Intervalles détectés</h2>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-ink-soft"><tr><th className="px-3 py-2 font-medium">Début</th><th className="px-3 py-2 font-medium">Durée</th><th className="px-3 py-2 font-medium">P moy.</th><th className="px-3 py-2 font-medium">PN</th><th className="px-3 py-2 font-medium">FC moy.</th></tr></thead>
              <tbody className="divide-y divide-line">{intervals.map((iv) => <tr key={iv.startTime}><td className="px-3 py-2">{mmss(iv.startTime)}</td><td className="px-3 py-2">{mmss(iv.endTime - iv.startTime + 1)}</td><td className="px-3 py-2 font-semibold">{iv.avgWatts} W</td><td className="px-3 py-2">{iv.normalizedPower} W</td><td className="px-3 py-2">{iv.avgHeartRate ? `${iv.avgHeartRate} bpm` : "–"}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-ink-soft">Blocs d’au moins 1 min au-dessus de {thr} W (90 % de la FTP{zones.ftpManual ? "" : ", estimée"}). PN : puissance normalisée.</p>
        </section>
      )}
      {st?.power?.length && !zones.ftp && <p className="text-sm text-ink-soft">Pas encore de FTP : renseignez-la dans l’onglet Vous pour voir les zones et les intervalles.</p>}
      {(w || a.feeling) && (
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
          {w?.tempC != null && <span className="inline-flex items-center gap-1.5"><Thermometer className="h-4 w-4" aria-hidden />{Math.round(w.tempC)} °C au départ</span>}
          {(w?.precipMm ?? 0) >= 1 && <span className="inline-flex items-center gap-1.5"><CloudRain className="h-4 w-4" aria-hidden />{fmtNum(w!.precipMm!, 1)} mm de pluie</span>}
        </p>
      )}
      {a.exercises.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold">Exercices</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {a.exercises.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <p className="font-semibold">{e.name}</p>
                <p className="text-sm text-ink-soft">{e.sets} × {e.reps}{e.loadKg != null ? ` à ${fmtNum(e.loadKg)} kg` : ""}{e.restS != null ? `, repos ${e.restS} s` : ""}</p>
                {e.comment && <p className="mt-1 text-sm">{e.comment}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      
      <FeelNote 
        activityId={a.id} 
        initialFeel={feelingToInt(a.feeling)} 
        initialComment={a.notes} 
      />

    </article>
  );
}