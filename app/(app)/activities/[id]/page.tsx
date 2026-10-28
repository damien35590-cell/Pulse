import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CloudRain, Flag, MessageSquareText, Thermometer } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decodePolyline } from "@/lib/polyline";
import { isSoftActivity, SPORTS } from "@/lib/sports";
import { activityStyle } from "@/lib/activity-style";
import { fmtClock, fmtKm, fmtNum, fmtPace, fmtWhenShort } from "@/lib/format";
import { ActivityHero } from "@/components/activity/activity-hero";
import { Delta, Metric } from "@/components/ui/metric";
import { Section } from "@/components/ui/section";
import { getActivityInsight } from "@/lib/data/activity-insight";
import { isAverageStory } from "@/lib/activity/comparables";
import { kmSplits } from "@/lib/activity/splits";
import { heartRate } from "@/lib/activity/heart";
import { cleanHrSeries, restDrop, setsOf, toSecondSeries } from "@/lib/workout/hr";
import type { SetDetail } from "@/lib/exercises";
import { getActivityNote } from "@/lib/coach/activity-note";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { INSIGHT_TONE } from "@/components/activity/insight-line";
import { Splits } from "@/components/activity/splits";
import { HeartRate } from "@/components/activity/heart-rate";
import { ShareActivity } from "@/components/activity/share-activity";
import { TimeInZones } from "@/components/activity/time-in-zones";
import { getZones } from "@/lib/data/zones";
import { bounds, POWER_PCT, timeInZones } from "@/lib/zones";
import { detectIntervals } from "@/lib/detect-intervals";
import { buildStream, type StreamData } from "@/lib/stream";
import { PowerChart } from "@/components/activity/power-chart";
import { FeelNote, FeelPrompt } from "@/components/activity/feelnote";
import { BikeTypeSwitch } from "@/components/activity/bike-type-switch";
import { SessionTypeControl } from "@/components/activity/session-type";
import { detectedSessionType } from "@/lib/art/session-type";
import { DetachSession } from "@/components/training/program-actions";
import { isVirtual } from "@/lib/art/card";
import { GearPicker } from "@/components/gear/gear-picker";
import { SaveTemplateButton } from "@/components/workout/save-template";
import { SetsLine } from "@/components/workout/hard-mark";
import { getGear } from "@/lib/data/gear";
import { selectableGear } from "@/lib/gear";
import { CompareActivity, type Comparable } from "@/components/activity/compare-activity";
import { isCommute } from "@/lib/routes/estimate";

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

/**
 * Fiche d'activité. Ordre : tête (carte, titre, chiffres, comparaison) → note du coach → allure par km → fréquence cardiaque
 * → altitude → ressenti, puis « Partager » en bas, dans la zone du pouce.
 */
export default async function ActivityPage({ params }: { params: { id: string } }) {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const a = await prisma.activity.findFirst({ where: { id: params.id, userId: s.user.id }, include: { exercises: { orderBy: { position: "asc" } }, stream: true, gear: { select: { id: true, name: true, retiredAt: true } }, raceEvent: { select: { id: true, name: true } } } });
  if (!a) notFound();
  // Matériel : celui compatible avec le sport, plus celui déjà affecté (même si son sport a changé depuis).
  const gear = a.type === "WORKOUT" ? [] : await getGear(s.user.id);
  const gearOpts = gear.filter((g) => !g.retiredAt && !g.parentId && (selectableGear([g], a.type).length > 0 || a.gear.some((x) => x.id === g.id)))
    .map((g) => ({ id: g.id, name: g.name, kind: g.kind, km: g.km, worn: gear.filter((p) => !p.retiredAt && (p.id === g.id || p.parentId === g.id) && p.level === "critical").map((p) => p.name) }));

  // « Comparer » : même sport, distance à ±20 %, hors activités douces. Rien à comparer sans distance (muscu) ni pour une activité douce.
  const COMPARE_TOLERANCE = 0.2, COMPARE_MAX = 10;
  const comparable = (x: { id: string; title: string; type: string; startedAt: Date; distanceM: number; movingTimeS: number; elevationGainM: number; avgHr: number | null }): Comparable => ({ id: x.id, title: x.title, type: x.type, startedAt: x.startedAt.toISOString(), distanceM: x.distanceM, movingTimeS: x.movingTimeS, elevationGainM: x.elevationGainM, avgHr: x.avgHr });
  const canCompare = a.type !== "WORKOUT" && !isCommute(a) && a.distanceM >= 100;
  const candidates = canCompare
    ? (await prisma.activity.findMany({
        where: { userId: s.user.id, type: a.type, id: { not: a.id }, distanceM: { gte: a.distanceM * (1 - COMPARE_TOLERANCE), lte: a.distanceM * (1 + COMPARE_TOLERANCE) } },
        orderBy: { startedAt: "desc" }, take: 40,
        select: { id: true, title: true, type: true, source: true, dedupeKey: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true, avgHr: true },
      })).filter((x) => !isCommute(x)).slice(0, COMPARE_MAX).map(comparable)
    : [];

  // Séance du programme que cette sortie valide (bloc « Séance du programme », avec « Détacher cette sortie »).
  const planned = a.type === "RUN" ? await prisma.plannedSession.findFirst({ where: { completedActivityId: a.id, userId: s.user.id }, select: { id: true, title: true, description: true, isKeySession: true } }) : null;
  const route = a.polyline ? decodePolyline(a.polyline) : [];
  const raw = (a.trackPoints as TP[] | null) ?? [];
  const t0 = raw[0]?.t ?? 0;
  const series = raw.filter((p) => p.power != null || p.hr != null).map((p) => ({ min: (p.t - t0) / 60000, power: p.power, hr: p.hr }));
  // Carte + profil d'altitude : seulement ce dont ils ont besoin part vers le navigateur (pas la FC ni la puissance).
  const gps = raw.filter((p) => p.lat != null && p.lng != null).map((p) => ({ lat: p.lat!, lng: p.lng!, ele: p.ele, t: p.t }));

  const st = (a.stream?.data ?? null) as StreamData | null, zones = await getZones(s.user.id);
  const powerTiz = st?.power?.length && zones.ftp ? timeInZones(st.power, bounds(zones.ftp, POWER_PCT)) : null;
  const thr = zones.ftp ? Math.round(zones.ftp * 0.9) : 0;
  const intervals = st?.power?.length && thr ? detectIntervals(st.power.map((p, k) => ({ t: k, power: p, hr: st.hr[k] })), thr) : [];
  const mmss = (x: number) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, "0")}`;
  // FC : la série à 1 Hz enregistrée, sinon reconstruite depuis la trace. Section masquée sans mesure.
  const hr1hz = st?.hr?.length ? st.hr : buildStream(raw)?.hr ?? [];
  const heart = heartRate(hr1hz, zones.hrMax);
  // Muscu avec ceinture cardio : série enregistrée à la séance (Activity.hrSeries). Rien sans elle.
  const lift = a.hrSeries != null ? heartRate(toSecondSeries(cleanHrSeries(a.hrSeries)), zones.hrMax) : null;
  const drop = lift ? restDrop(setsOf(a.exercises.map((e) => e.setsDetail))) : null;
  // Allure par km : course et rando avec GPS horodaté (FC du km lue dans la trace).
  const splits = (a.type === "RUN" || a.type === "HIKE") ? kmSplits(raw.filter((p) => p.lat != null && p.lng != null) as { lat: number; lng: number; t: number; hr?: number }[]) : [];

  const { icon: SportIcon, fg: sportFg, dot: sportSolid } = activityStyle(a.type);
  const pace = fmtPace(a.distanceM, a.movingTimeS, a.type);
  const w = a.weather as { tempC?: number | null; precipMm?: number | null } | null;
  const insight = await getActivityInsight(s.user.id, a.id, TZ, zones.hrMax);
  const note = await getActivityNote(s.user.id, a.id, TZ, insight.cls).catch((e) => { console.error("[coach] note d'activité", e); return null; });
  const ins = insight.pace ? INSIGHT_TONE[insight.pace.tone] : null;
  // Anecdote en repli, sauf l'ancienne comparaison à la moyenne des 30 jours (remplacée par la comparaison ci-dessus).
  const story = a.story && !isAverageStory(a.story) ? a.story : null;
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
  const shareText = [hasDist && `${fmtKm(a.distanceM)} km`, fmtClock(a.movingTimeS), pace && `${pace.value} ${pace.unit}`].filter(Boolean).join(" · ");

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
        sections={
          <>
            {(a.type === "RUN" || a.type === "RIDE") && a.zoneRibbon != null && <SessionTypeControl id={a.id} type={a.type} detected={detectedSessionType(a.isInterval, a.type)} current={a.sessionType} />}
            {planned && (
              <Section title="Séance du programme">
                <div className={cn(ui.card, "p-4")}>
                  <p className="font-semibold text-ink">{planned.title}</p>
                  {planned.description && <p className="mt-0.5 text-sm text-ink-soft">{planned.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-x-4">
                    <Link href="/plan" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">Voir le programme</Link>
                    <DetachSession sessionId={planned.id} />
                  </div>
                </div>
              </Section>
            )}
            {note && (
              <section aria-label="Note du coach" className={cn(ui.card, "flex gap-3 p-4")}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft"><MessageSquareText className="size-4" aria-hidden /></span>
                <div className="min-w-0">
                  <p className={ui.label}>Coach</p>
                  <p className="mt-1 leading-snug text-ink">{note}</p>
                </div>
              </section>
            )}
            {a.exercises.length > 0 && (
              <Section title="Exercices">
                <ul className={cn(ui.card, "divide-y divide-line")}>
                  {a.exercises.map((e) => (
                    <li key={e.id} className="px-4 py-3">
                      <p className="font-semibold text-ink">{e.name}</p>
                      <p className="text-sm text-ink-soft">{e.sets} × {e.reps}{e.loadKg != null ? ` à ${fmtNum(e.loadKg)} kg` : ""}{e.restS != null ? `, repos ${e.restS} s` : ""}</p>
                      {Array.isArray(e.setsDetail) && <p className="font-num text-sm tabular-nums text-ink">Réel : <SetsLine items={(e.setsDetail as SetDetail[]).map((s) => ({ text: `${s.done ? "" : "✗"}${s.reps}${s.loadKg != null && s.loadKg !== e.loadKg ? ` (${fmtNum(s.loadKg)} kg)` : ""}`, hard: s.hard }))} /></p>}
                      {Array.isArray(e.setsDetail) && (e.setsDetail as SetDetail[]).some((s) => s.hrPeak != null) && (
                        <ol className="mt-0.5">
                          {(e.setsDetail as SetDetail[]).map((s, i) => s.hrPeak != null && (
                            <li key={i} className="font-num text-xs tabular-nums text-ink-mute">S{i + 1} · pic {s.hrPeak}{s.hrEndRest != null ? ` · récup ${s.hrEndRest}` : ""}</li>
                          ))}
                        </ol>
                      )}
                      {e.comment && <p className="mt-1 text-sm text-ink-soft">{e.comment}</p>}
                    </li>
                  ))}
                </ul>
                {a.type === "WORKOUT" && <SaveTemplateButton activityId={a.id} defaultName={a.title} />}
              </Section>
            )}
            {lift && (
              <HeartRate
                values={lift.values} durationS={lift.durationS} upper={lift.upper} zones={lift.zones} compact
                metrics={[
                  ...(a.avgHr ? [{ label: "FC moy.", value: a.avgHr, unit: "bpm" }] : []),
                  ...(a.maxHr ? [{ label: "FC max", value: a.maxHr, unit: "bpm" }] : []),
                  ...(drop ? [{ label: "Baisse au repos", value: `-${drop.bpm}`, unit: "bpm" }] : []),
                ]}
                note={zones.hrMax ? `FC max ${zones.hrMax} bpm${zones.hrManual ? "" : " (estimée)"}` : undefined}
              />
            )}
            {splits.length > 1 && (
              <Section title="Allure par km">
                <div className={cn(ui.card, "px-3 py-4")}><Splits splits={splits} /></div>
              </Section>
            )}
            {heart && (
              <HeartRate
                values={heart.values} durationS={heart.durationS} upper={heart.upper} zones={heart.zones}
                note={zones.hrMax ? `FC max ${zones.hrMax} bpm${zones.hrManual ? "" : " (estimée)"}` : undefined}
              />
            )}
            {series.some((p) => p.power != null) && (
              <Section title="Puissance">
                <div className={cn(ui.card, "space-y-4 p-4")}>
                  <PowerChart data={series} />
                  {powerTiz && <TimeInZones power={powerTiz} />}
                  {zones.ftp && powerTiz && <p className="text-xs text-ink-mute">FTP {zones.ftp} W{zones.ftpManual ? "" : " (estimée)"}. Réglable dans l’onglet Vous.</p>}
                </div>
              </Section>
            )}
            {intervals.length > 0 && (
              <Section title="Intervalles détectés">
                <div className={cn(ui.card, "overflow-x-auto")}>
                  <table className="w-full text-sm tabular-nums">
                    <thead className="text-left text-label uppercase text-ink-mute"><tr><th className="px-3 py-2 font-medium">Début</th><th className="px-3 py-2 font-medium">Durée</th><th className="px-3 py-2 font-medium">P moy.</th><th className="px-3 py-2 font-medium">PN</th><th className="px-3 py-2 font-medium">FC moy.</th></tr></thead>
                    <tbody className="divide-y divide-line">{intervals.map((iv) => <tr key={iv.startTime}><td className="px-3 py-2">{mmss(iv.startTime)}</td><td className="px-3 py-2">{mmss(iv.endTime - iv.startTime + 1)}</td><td className="px-3 py-2 font-semibold">{iv.avgWatts} W</td><td className="px-3 py-2">{iv.normalizedPower} W</td><td className="px-3 py-2">{iv.avgHeartRate ? `${iv.avgHeartRate} bpm` : "–"}</td></tr>)}</tbody>
                  </table>
                </div>
                <p className="px-1 text-xs text-ink-mute">Blocs d’au moins 1 min au-dessus de {thr} W (90 % de la FTP{zones.ftpManual ? "" : ", estimée"}). PN : puissance normalisée.</p>
              </Section>
            )}
            {st?.power?.length && !zones.ftp ? <p className="px-1 text-sm text-ink-soft">Pas encore de FTP : renseigne-la dans l’onglet Vous pour voir les zones et les intervalles.</p> : null}
          </>
        }
      >
        {a.sessionType === "race" && <span className={cn(ui.chip, "mt-1")}><Flag className="size-3.5" aria-hidden />Compétition</span>}
        {a.raceEvent && <Link href={`/events/${a.raceEvent.id}`} className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand/10 px-3 text-sm font-semibold text-brand"><Flag className="size-4" aria-hidden />Course · {a.raceEvent.name}</Link>}
        {(a.type === "RIDE" || a.type === "EBIKE") && !isVirtual(a) && <div className="mt-3"><BikeTypeSwitch activityId={a.id} type={a.type} /></div>}
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
        ) : story && <p className="mt-5 border-t border-line pt-4 text-sm leading-snug text-ink-soft">{story}</p>}
        {!isSoftActivity(a) && <div className="mt-4 empty:hidden"><FeelPrompt filled={a.feeling != null && a.rpe != null} /></div>}
      </ActivityHero>

      <div className="mt-8 space-y-8">
        <FeelNote activityId={a.id} movingTimeS={a.movingTimeS} initialFeel={feelingToInt(a.feeling)} initialComment={a.notes} initialRpe={a.rpe} />

        {(w?.tempC != null || (w?.precipMm ?? 0) >= 1) && (
          <p className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-ink-soft">
            {w?.tempC != null && <span className="inline-flex items-center gap-1.5"><Thermometer className="size-4" aria-hidden />{Math.round(w.tempC)} °C au départ</span>}
            {(w?.precipMm ?? 0) >= 1 && <span className="inline-flex items-center gap-1.5"><CloudRain className="size-4" aria-hidden />{fmtNum(w!.precipMm!, 1)} mm de pluie</span>}
          </p>
        )}

        {gearOpts.length > 0 && <GearPicker activityId={a.id} options={gearOpts} selected={a.gear.filter((g) => !g.retiredAt).map((g) => g.id)} retired={a.gear.filter((g) => g.retiredAt).map((g) => g.name)} />}

        {candidates.length > 0 && <CompareActivity current={comparable(a)} candidates={candidates} />}
        <ShareActivity title={a.title} summary={shareText} />
      </div>
    </article>
  );
}
