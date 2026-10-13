"use client";
import { useState } from "react";
import { GROUPS, heatColor, type Group, type MuscleLoad } from "@/lib/muscles";

type Shape = { g: Group; cx: number; cy: number; rx: number; ry: number } | { g: Group; d: string };
const SH: Shape[] = [{ g: "épaules", cx: 60, cy: 84, rx: 17, ry: 13 }, { g: "épaules", cx: 140, cy: 84, rx: 17, ry: 13 }, { g: "bras", cx: 42, cy: 136, rx: 10, ry: 30 }, { g: "bras", cx: 158, cy: 136, rx: 10, ry: 30 }, { g: "mollets", cx: 80, cy: 356, rx: 12, ry: 36 }, { g: "mollets", cx: 120, cy: 356, rx: 12, ry: 36 }];
const FRONT: Shape[] = [...SH, { g: "pectoraux", cx: 82, cy: 112, rx: 20, ry: 17 }, { g: "pectoraux", cx: 118, cy: 112, rx: 20, ry: 17 }, { g: "quadriceps", cx: 82, cy: 262, rx: 19, ry: 62 }, { g: "quadriceps", cx: 118, cy: 262, rx: 19, ry: 62 }];
const BACK: Shape[] = [...SH, { g: "dorsaux", d: "M72 98 L128 98 L120 182 L80 182 Z" }, { g: "ischio-jambiers", cx: 82, cy: 262, rx: 19, ry: 58 }, { g: "ischio-jambiers", cx: 118, cy: 262, rx: 19, ry: 58 }];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function Body({ title, shapes, data, ref0, active, setActive }: { title: string; shapes: Shape[]; data: Record<Group, MuscleLoad>; ref0: number; active: Group | null; setActive: (g: Group) => void }) {
  const base = { fill: "rgb(var(--surface-2))", stroke: "rgb(var(--line))", strokeWidth: 1.5 };
  return (
    <figure className="flex-1">
      <svg viewBox="0 0 200 410" className="mx-auto block max-h-[340px] w-full" role="group" aria-label={title}>
        <circle cx="100" cy="36" r="19" {...base} />
        <path d="M66 78 Q100 64 134 78 L128 192 Q100 202 72 192 Z" {...base} />
        <rect x="28" y="90" width="28" height="94" rx="14" {...base} /><rect x="144" y="90" width="28" height="94" rx="14" {...base} />
        <rect x="64" y="196" width="34" height="196" rx="17" {...base} /><rect x="102" y="196" width="34" height="196" rx="17" {...base} />
        {shapes.map((s, i) => {
          const l = data[s.g], common = {
            fill: heatColor(l.tonnage / ref0), stroke: s.g === active ? "rgb(var(--ink))" : "rgb(var(--surface))", strokeWidth: s.g === active ? 2.5 : 1.5, style: { cursor: "pointer", transition: "fill .3s" },
            tabIndex: 0, role: "button", "aria-label": `${cap(s.g)} : ${Math.round(l.tonnage)} kg`, onPointerEnter: () => setActive(s.g), onClick: () => setActive(s.g), onFocus: () => setActive(s.g),
          };
          return "d" in s ? <path key={i} d={s.d} {...common}><title>{`${cap(s.g)} : ${Math.round(l.tonnage)} kg`}</title></path> : <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common}><title>{`${cap(s.g)} : ${Math.round(l.tonnage)} kg`}</title></ellipse>;
        })}
      </svg>
      <figcaption className="text-center text-xs text-ink-soft">{title}</figcaption>
    </figure>
  );
}

/** Carte musculaire : couleur du gris sombre au rouge vif selon le tonnage des 7 derniers jours. Survol ou toucher pour le détail. */
export function AnatomyHeatmap({ data, hasData }: { data: Record<Group, MuscleLoad>; hasData: boolean }) {
  const [active, setActive] = useState<Group | null>(null);
  const ref0 = Math.max(6000, ...GROUPS.map((g) => data[g].tonnage)), a = active ? data[active] : null;
  return (
    <div>
      <div className="flex gap-2"><Body title="Face" shapes={FRONT} data={data} ref0={ref0} active={active} setActive={setActive} /><Body title="Dos" shapes={BACK} data={data} ref0={ref0} active={active} setActive={setActive} /></div>
      <p className="mt-2 min-h-[44px] text-center text-sm" aria-live="polite">
        {a && active ? <><b>{cap(active)}</b> : {Math.round(a.tonnage).toLocaleString("fr-FR")} kg, {a.sets.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} séries sur 7 jours</> : <span className="text-ink-soft">{hasData ? "Touchez un muscle pour voir son volume." : "Aucune séance de musculation ces 7 derniers jours."}</span>}
      </p>
      <div className="flex items-center gap-2 text-xs text-ink-soft"><span>Repos</span><i className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})` }} /><span>Très sollicité</span></div>
      <p className="mt-2 text-xs text-ink-soft">Volume = séries × répétitions × charge, réparti entre muscles principaux et secondaires d’après le nom de l’exercice (estimation). Sans charge, 60 % du poids du corps sont comptés (70 kg par défaut).</p>
    </div>
  );
}
