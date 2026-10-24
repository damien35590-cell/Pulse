import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CloudRain, Equal, Flag, Thermometer, TrendingDown, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decodePolyline } from "@/lib/polyline";
import { SPORTS } from "@/lib/sports";
import { activityStyle } from "@/lib/activity-style";
import { fmtClock, fmtKm, fmtNum, fmtPace, fmtWhenShort } from "@/lib/format";
import { ActivityHero } from "@/components/activity/activity-hero";
import { Delta, Metric } from "@/components/ui/metric";
import { getActivityInsight } from "@/lib/data/activity-insight";
import type { PaceInsight } from "@/lib/activity/comparables";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { TimeInZones } from "@/components/activity/time-in-zones";
import { getZones } from "@/lib/data/zones";
import { bounds, HR_PCT, POWER_PCT, timeInZones } from "@/lib/zones";
import { detectIntervals } from "@/lib/detect-intervals";
import type { StreamData } from "@/lib/stream";
import { PowerChart } from "@/components/activity/power-chart";
import { FeelNote } from "@/components/activity/feelnote";
import { BikeTypeSwitch } from "@/components/activity/bike-type-switch";
import { GearPicker } from "@/components/gear/gear-picker";
import { SaveTemplateButton } from "@/components/workout/save-template";
import { getGear } from "@/lib/data/gear";
import { selectableGear } from "@/lib/gear";

export const dynamic = "force-dynamic";
const TZ = "Europe/Paris";
type TP = { lat?: number; lng?: number; ele?: number; t: number; hr?: number; power?: number; cad?: number };

const INSIGHT: Record<PaceInsight["tone"], { icon: typeof Equal; cls: string }> = {
  good: { icon: TrendingUp, cls: "bg-good/15 text-good" },
  warn: { icon: TrendingDown, cls: "bg-warn/15 text-warn" },
  neutral: { icon: Equal, cls: "bg-surface-2 text-ink-soft" },
};

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
  const a = await prisma.activity.findFirst({ where: { id: params.id, userId: s.user.id }, include: { exercises: { orderBy: { position: "asc" } }, stream: true, gear: { select: { id: true, name: true, retiredAt: true } }, raceEvent: { select: { id: true, name: true } } } });
  if (!a) notFound();
  // Matériel : celui compatible avec le sport, plus celui déjà affecté (même si son sport a changé depuis).
  const gear = a.type === "WORKOUT" ? [] : await getGear(s.user.id);
  const gearOpts = gear.filter((g) => !g.retiredAt && !g.parentId && (selectableGear([g], a.type).length > 0 || a.gear.some((x) => x.id === g.id)))
    .map((g) => ({ id: g.id, name: g.name, kind: g.kind, km: g.km, worn: gear.filter((p) => !p.retiredAt && (p.id === g.id || p.parentId === g.id) && p.level === "critical").map((p) => p.name) }));

  const route = a.polyline ? decodePolyline(a.polyline) : [];
  const raw = (a.trackPoints as TP[] | null) ?? [];
  const t0 = raw[0]?.t ?? 0;
  const series = raw.filter((p) => p.power != null || p.hr != null).map((p) => ({ min: (p.t - t0) / 60000, power: p.power, hr: p.hr }));
  // Carte + profil d'altitude : seulement ce dont ils ont besoin part vers le navigateur (pas la FC ni la puissance).
  const gps = raw.filter((p) => p.lat != null && p.lng != null).map((p) => ({ lat: p.lat!, lng: p.lng!, ele: p.ele, t: p.t }));
  
  const st = (a.stream?.data ?? null) as StreamData | null, zones = await getZones(s.user.id);
  const powerTiz = st?.power?.length && zones.ftp ? timeInZones(st.power, bounds(zones.ftp, POWER_PCT)) : null;
  const hrTiz = st?.hr?.length && zones.hrMax ? timeInZones(st.hr, bounds(zones.hrMax, HR_PCT), true) : null;
  const thr = zones.ftp ? Math.round(zones.ftp * 0.9) : 0;
  const intervals = st?.power?.length && thr ? detectIntervals(st.power.map((p, k) => ({ t: k, power: p, hr: st.hr[k] })), thr) : [];
  const mmss = (x: number) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, "0")}`;
  

  const { icon: SportIcon, fg: sportFg, dot: sportSolid } = activityStyle(a.type);
  const pace = fmtPace(a.distanceM, a.movingTimeS, a.type);
  const w = a.weather as { tempC?: number | null; precipMm?: number | null } | null;
  const insight = await getActivityInsight(s.user.id, a.id, TZ, zones.hrMax);
  const ins = insight.pace ? INSIGHT[insight.pace.tone] : null;
  // Chiffre vedette : la distance, ou la durée pour une activité sans distance (muscu…). Puis une ligne de 3 chiffres, le reste en petit.
  const hasDist = a.type !== "WORKOUT" && a.distanceM >= 100;
  type M = { label: string; value: string; unit?: string; hint?: React.ReactNode };
  const metrics = ([
    hasDist && { label: "Durée", value: fmtClock(a.movingTimeS) },
    pace && { label: pace.label, value: pace.value, unit: pace.unit, hint: insight.pace && <Delta tone={insight.pace.tone}>{insight.pace.delta}</Delta> },
    hasDist && a.elevationGainM > 0 && { label: "D+", value: fmtNum(a.elevationGainM, 0), unit: "m" },
    a.avgHr && { label: "FC moy.", value: String(a.avgHr), unit: "bpm" },
    a.avgPower && { label: "Puiss. moy.", value: String(a.avgPower), unit: "W" },
    a.calories && { label: "Calories", value: fmtNum(a.calories, 0), unit: "kcal" },
    a.maxPower && { label: "Puiss. max", value: String(a.maxPower), unit: "W" },
  ].filter(Boolean) as M[]);
  const [row, more] = [metrics.slice(0, 3), metrics.slice(3)];
  const points = gps.length > 1 ? gps : route.map(([lat, lng]) => ({ lat, lng }));

  return (
    <article>
      <ActivityHero
        id={a.id}
        title={a.title}
        points={points}
        gain={a.elevationGainM > 0 ? a.elevationGainM : undefined}
        elevationColor={sportFg}
        meta={
          <div className="flex items-center gap-3">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-tile text-bg", sportSolid)}><SportIcon className="size-5" strokeWidth={2.2} aria-hidden /></span>
            <p className="min-w-0 truncate text-sm text-ink-soft">{SPORTS[a.type]?.label} · {fmtWhenShort(a.startedAt, TZ)}</p>
          </div>
        }
      >
        {a.raceEvent && <Link href={`/events/${a.raceEvent.id}`} className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand/10 px-3 text-sm font-semibold text-brand"><Flag className="size-4" aria-hidden />Course · {a.raceEvent.name}</Link>}
        {(a.type === "RIDE" || a.type === "EBIKE") && <div className="mt-3"><BikeTypeSwitch activityId={a.id} type={a.type} /></div>}
        <dl className="mt-5">
          {hasDist
            ? <Metric size="hero" label="Distance" value={fmtKm(a.distanceM)} unit="km" />
            : <Metric size="hero" label="Durée" value={fmtClock(a.movingTimeS)} />}
        </dl>
        {row.length > 0 && (
          <dl className="mt-5 grid grid-cols-3 gap-3">
            {row.map((m) => <Metric key={m.label} size="lg" label={m.label} value={m.value} unit={m.unit} hint={m.hint} />)}
          </dl>
        )}
        {more.length > 0 && (
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {more.map((m) => <Metric key={m.label} size="sm" label={m.label} value={m.value} unit={m.unit} />)}
          </dl>
        )}
        {insight.pace || insight.chips.length > 0 ? (
          <div className="mt-5 space-y-3 border-t border-line pt-4">
            {insight.pace && ins && (
              <div className="flex items-start gap-3">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", ins.cls)}><ins.icon className="size-4" aria-hidden /></span>
                <div className="min-w-0">
                  <p className="font-semibold leading-snug text-ink">{insight.pace.text}</p>
                  <p className="mt-0.5 text-sm text-ink-mute">{insight.pace.basis}</p>
                </div>
              </div>
            )}
            {insight.chips.length > 0 && (
              <ul className="flex flex-wrap gap-2">{insight.chips.map((c) => <li key={c} className={ui.chip}>{c}</li>)}</ul>
            )}
          </div>
        ) : a.story && <p className="mt-5 border-t border-line pt-4 text-sm leading-snug text-ink-soft">{a.story}</p>}
      </ActivityHero>
      <div className="mt-8 space-y-5">
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
                {Array.isArray(e.setsDetail) && <p className="text-sm tabular-nums">Réel : {(e.setsDetail as { reps: number; loadKg: number | null; done: boolean }[]).map((s) => `${s.done ? "" : "✗"}${s.reps}${s.loadKg != null && s.loadKg !== e.loadKg ? ` (${fmtNum(s.loadKg)} kg)` : ""}`).join(" · ")}</p>}
                {e.comment && <p className="mt-1 text-sm">{e.comment}</p>}
              </li>
            ))}
          </ul>
          {a.type === "WORKOUT" && <div className="mt-3"><SaveTemplateButton activityId={a.id} defaultName={a.title} /></div>}
        </section>
      )}
      
      {gearOpts.length > 0 && <GearPicker activityId={a.id} options={gearOpts} selected={a.gear.filter((g) => !g.retiredAt).map((g) => g.id)} retired={a.gear.filter((g) => g.retiredAt).map((g) => g.name)} />}

      <FeelNote 
        activityId={a.id} 
        initialFeel={feelingToInt(a.feeling)} 
        initialComment={a.notes}
        initialRpe={a.rpe}
      />
      </div>
    </article>
  );
}