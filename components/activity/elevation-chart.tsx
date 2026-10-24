"use client";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { Metric } from "@/components/ui/metric";
import { TraceChart } from "@/components/activity/trace-chart";
import { climb, distanceTicks, elevationAxis, spanAtLeast } from "@/lib/elevation-axis";

export type ElevationPoint = { km: number; ele: number };

const SAMPLES = 160;
const m = (v: number) => fmtNum(Math.round(v), 0);
const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");

function analyse(points: ElevationPoint[], gain?: number) {
  const total = points[points.length - 1].km - points[0].km, k0 = points[0].km, ele: number[] = [];
  // Altitude ré-échantillonnée à pas de distance constant : l'axe horizontal est linéaire en km.
  for (let j = 0, i = 0; j < SAMPLES; j++) {
    const target = k0 + (total * j) / (SAMPLES - 1);
    while (i < points.length - 2 && points[i + 1].km < target) i++;
    const a = points[i], b = points[i + 1] ?? a, f = b.km > a.km ? Math.min(1, Math.max(0, (target - a.km) / (b.km - a.km))) : 0;
    ele.push(a.ele + (b.ele - a.ele) * f);
  }
  // Pente lissée sur ±2 échantillons (seulement si le pas dépasse 5 m, sinon le bruit domine).
  const stepM = (total * 1000) / (SAMPLES - 1);
  const grade = stepM >= 5 ? ele.map((_, j) => { const a = Math.max(0, j - 2), b = Math.min(SAMPLES - 1, j + 2); return ((ele[b] - ele[a]) / ((b - a) * stepM)) * 100; }) : null;
  const raw = points.map((p) => p.ele), min = Math.min(...raw), max = Math.max(...raw), c = climb(raw);
  // D+ de l'activité quand il est connu (même chiffre que le résumé) ; D− en découle : D+ − D− = arrivée − départ.
  const up = gain ?? c.up, down = gain != null ? Math.max(0, gain - (raw[raw.length - 1] - raw[0])) : c.down;
  return { total, ele, grade, min, max, up, down, ...elevationAxis(...spanAtLeast(min, max)), xTicks: distanceTicks(total) };
}

type Props = {
  /** Distance cumulée (km) et altitude (m), dans l'ordre du parcours. */
  points: ElevationPoint[];
  /** D+ enregistré par l'appareil, s'il existe. */
  gain?: number;
  /** Distance sous le doigt (km depuis le départ), null au lâcher : la carte suit avec un point. */
  onCursor?: (km: number | null) => void;
  /** Classe text-* de la courbe (token). */
  color?: string;
  height?: number;
  className?: string;
};

/** Profil d'altitude : D+ / D− / min / max, axe en mètres sur 3 valeurs rondes (40 m d'écart au moins : le plat reste plat), repères par km, curseur au doigt. */
export function ElevationChart({ points, gain, onCursor, color = "text-brand", height = 140, className }: Props) {
  const g = useMemo(() => analyse(points, gain), [points, gain]);
  const tip = (f: number, v: number) => {
    const s = g.grade ? Math.round(g.grade[Math.round(f * (SAMPLES - 1))]) : null;
    return `${fmtNum(f * g.total, 1)} km · ${m(v)} m${s != null ? ` · ${signed(s)} %` : ""}`;
  };
  return (
    <div className={cn("space-y-4", className)}>
      <dl className="grid grid-cols-4 gap-3">
        <Metric label="D+" value={m(g.up)} unit="m" />
        <Metric label="D−" value={m(g.down)} unit="m" />
        <Metric label="Alt. min" value={m(g.min)} unit="m" />
        <Metric label="Alt. max" value={m(g.max)} unit="m" />
      </dl>
      <TraceChart
        values={g.ele}
        unit="m"
        label="Altitude"
        ariaLabel={`Profil d’altitude sur ${fmtNum(g.total, 1)} km : ${m(g.up)} m de dénivelé positif, altitude de ${m(g.min)} à ${m(g.max)} m`}
        color={color}
        height={height}
        caption={false}
        average={false}
        domain={g.domain}
        yTicks={g.ticks}
        xTicks={g.xTicks}
        format={m}
        tip={tip}
        onCursor={onCursor && ((f) => onCursor(f == null ? null : f * g.total))}
      />
    </div>
  );
}
