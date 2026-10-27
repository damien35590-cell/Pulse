"use client";
import { useId, useState } from "react";
import { GROUPS, heatColor, type Group, type MuscleLoad } from "@/lib/muscles";

/** Moitié gauche du corps (x < 100) ; la moitié droite est le même dessin en miroir. g = null : muscle décoratif, non suivi. */
type Shape = { g: Group | null; d: string };
// Morphologie athlétique en V : épaules larges, dorsaux évasés, taille fine, cuisses et mollets galbés
const SILHOUETTE = "M100.5 6 C88.5 6 81 15 81 29 C81 42 85 51 91 56 L90 61C80 63 66 66 52 70 C36 74 26 86 25 104 C24 120 24 138 26 152 C26 160 24 168 22 178 C19 194 18 212 18 230 C17 240 20 248 26 248 C31 248 33 242 32 232 C33 216 36 198 39 184 C41 176 42 168 43 160 C45 146 46 132 48 120 C50 126 52 134 54 142 C58 160 64 178 66 196 C67 204 65 212 63 220 C57 240 56 270 61 296 C63 306 64 316 63 326 C60 340 60 360 64 378 C66 390 67 400 66 408 C65 415 72 418 82 417 C88 416 90 412 89 406 C88 398 87 390 88 380 C90 362 92 344 92 330 C92 318 94 306 95 294 C96 276 98 256 100.5 240 Z";
const DELT = "M56 70 C40 70 28 82 27 102 C30 112 38 114 44 108 C48 98 54 88 62 80 C61 75 59 72 56 70 Z";
const FOREARM = "M28 166 C22 182 20 202 21 220 C24 226 29 224 31 216 C34 200 38 184 40 170 Z";
const FRONT: Shape[] = [
  { g: "épaules", d: DELT },
  { g: "pectoraux", d: "M99 84 C86 79 70 79 60 84 C52 92 50 106 56 118 C66 128 86 130 99 124 Z" },
  { g: "biceps", d: "M40 108 C29 116 26 136 29 152 C33 162 42 162 46 152 C49 140 48 122 44 110 Z" },
  { g: null, d: FOREARM },
  { g: "abdominaux", d: "M99 132 C93 131 89 132 87 134 C86 156 86 178 88 200 C92 210 96 214 99 216 Z" }, // grand droit
  { g: "abdominaux", d: "M84 134 C74 138 64 148 58 160 C62 178 70 196 84 204 C82 182 82 158 84 134 Z" }, // obliques
  { g: "quadriceps", d: "M64 224 C57 248 57 278 65 304 C70 310 76 310 78 300 C78 276 78 248 76 228 C72 225 68 224 64 224 Z" }, // vaste externe
  { g: "quadriceps", d: "M78 228 C82 250 82 280 80 300 C82 312 88 310 90 302 C95 282 96 258 94 238 C88 232 84 229 78 228 Z" }, // droit fémoral, vaste interne
  { g: "mollets", d: "M64 332 C59 348 60 370 67 386 C72 390 78 388 80 380 C83 362 81 344 74 332 Z" },
];
const BACK: Shape[] = [
  { g: "dorsaux", d: "M100 54 C94 58 80 64 62 72 C76 80 90 96 100 122 Z" }, // trapèzes
  { g: "épaules", d: DELT },
  { g: "triceps", d: "M42 106 C30 114 26 134 29 152 C33 162 42 162 46 152 C49 138 48 120 45 108 Z" },
  { g: null, d: FOREARM },
  { g: "dorsaux", d: "M60 88 C50 104 52 130 60 156 C68 176 82 190 99 186 L99 124 C88 112 74 98 60 88 Z" }, // grand dorsal
  { g: "dorsaux", d: "M99 190 C93 192 88 200 88 210 C92 214 96 214 99 214 Z" }, // lombaires
  { g: null, d: "M99 216 C88 214 72 216 63 224 C59 238 63 254 77 258 C89 260 96 256 99 250 Z" }, // fessiers
  { g: "ischio-jambiers", d: "M62 262 C58 278 60 296 66 310 C70 314 75 314 77 308 C78 292 78 274 77 262 C72 261 66 261 62 262 Z" }, // biceps fémoral
  { g: "ischio-jambiers", d: "M79 262 C80 276 80 294 79 308 C82 316 88 312 90 306 C94 292 96 276 95 264 C90 262 84 262 79 262 Z" }, // semi-tendineux
  { g: "mollets", d: "M63 330 C56 346 58 368 66 382 C70 386 74 384 75 376 C76 358 75 340 70 330 Z" }, // jumeau externe
  { g: "mollets", d: "M74 330 C82 338 86 356 84 374 C83 384 78 388 76 384 C77 366 78 346 74 330 Z" }, // jumeau interne
];
const SPINE = "M100.5 124 V214";
const ABS_LINES = "M87.5 151 H99 M87 169 H99 M88 187 H99"; // séparations des abdominaux
const MIRROR = "translate(200 0) scale(-1 1)";
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const fmtKg = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} kg`;

type Props = { data: Record<Group, MuscleLoad>; ref0: number; active: Group | null; setActive: (g: Group) => void };

function Body({ title, shapes, front, data, ref0, active, setActive }: Props & { title: string; shapes: Shape[]; front?: boolean }) {
  const id = useId().replace(/:/g, ""), sheen = `sheen-${id}`, body = `body-${id}`;
  const half = (
    <>
      <path d={SILHOUETTE} fill={`url(#${body})`} />
      {shapes.map((s, i) => {
        if (!s.g) return <path key={i} d={s.d} fill="rgb(var(--ink) / 0.07)" />;
        const g = s.g, l = data[g], r = l.tonnage / ref0, on = g === active, color = r > 0 ? heatColor(r) : "rgb(var(--ink) / 0.12)";
        return (
          <g key={i}>
            <path
              d={s.d} fill={color} stroke={on ? "rgb(var(--ink))" : "rgb(var(--surface))"} strokeWidth={on ? 1.6 : 0.8} strokeLinejoin="round"
              style={{ cursor: "pointer", transition: "fill .4s, filter .4s", filter: r > 0.35 ? `drop-shadow(0 0 ${2 + r * 4}px ${color})` : undefined, outline: "none" }}
              tabIndex={0} role="button" aria-label={`${cap(g)} : ${fmtKg(l.tonnage)}`}
              onPointerEnter={() => setActive(g)} onClick={() => setActive(g)} onFocus={() => setActive(g)}
            ><title>{`${cap(g)} : ${fmtKg(l.tonnage)}`}</title></path>
            <path d={s.d} fill={`url(#${sheen})`} pointerEvents="none" />
          </g>
        );
      })}
      {front && <path d={ABS_LINES} stroke="rgb(var(--surface))" strokeOpacity={0.7} strokeWidth={1.2} strokeLinecap="round" pointerEvents="none" />}
    </>
  );
  return (
    <figure className="flex-1">
      <svg viewBox="8 2 184 422" className="mx-auto block max-h-[360px] w-full" role="group" aria-label={title}>
        <defs>
          <linearGradient id={body} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--surface-2))" /><stop offset="1" stopColor="rgb(var(--surface-2))" stopOpacity={0.55} /></linearGradient>
          <linearGradient id={sheen} x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={0.32} /><stop offset="0.55" stopColor="#fff" stopOpacity={0} /></linearGradient>
        </defs>
        <g>{half}</g>
        <g transform={MIRROR}>{half}</g>
        {!front && <path d={SPINE} stroke="rgb(var(--surface))" strokeOpacity={0.8} strokeWidth={1.4} strokeLinecap="round" pointerEvents="none" />}
      </svg>
      <figcaption className="mt-1 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{title}</figcaption>
    </figure>
  );
}

/** Carte musculaire (7 jours par défaut, ou la période d'analyse) : du pêche au rouge profond selon le tonnage. Survol ou toucher pour le détail. */
export function AnatomyHeatmap({ data, hasData, span = "7 jours" }: { data: Record<Group, MuscleLoad>; hasData: boolean; span?: string }) {
  const [active, setActive] = useState<Group | null>(null);
  const ref0 = Math.max(6000, ...GROUPS.map((g) => data[g].tonnage)), a = active ? data[active] : null, props = { data, ref0, active, setActive };
  return (
    <div>
      <div className="flex gap-2 rounded-2xl bg-gradient-to-b from-surface-2/60 to-transparent px-1 pt-3"><Body title="Face" shapes={FRONT} front {...props} /><Body title="Dos" shapes={BACK} {...props} /></div>
      <p className="mt-2 min-h-[44px] text-center text-sm" aria-live="polite">
        {a && active ? <><b>{cap(active)}</b> : {fmtKg(a.tonnage)}, {a.sets.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} séries sur {span}</> : <span className="text-ink-soft">{hasData ? "Touchez un muscle pour voir son volume." : `Aucune séance de musculation sur ${span}.`}</span>}
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
        {GROUPS.map((g) => {
          const r = data[g].tonnage / ref0;
          return (
            <li key={g}>
              <button onClick={() => setActive(g)} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-1.5 text-left text-xs ${g === active ? "bg-surface-2 font-semibold" : ""}`}>
                <span className="w-[5.5rem] shrink-0 truncate">{cap(g)}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round(Math.min(1, r) * 100)}%`, background: heatColor(r) }} /></span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-2 text-xs text-ink-soft"><span>Repos</span><i className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, rgb(var(--ink) / 0.12), ${heatColor(0.05)} 12%, ${heatColor(0.5)}, ${heatColor(1)})` }} /><span>Très sollicité</span></div>
      <p className="mt-2 text-xs text-ink-soft">Volume = séries × répétitions × charge, réparti entre muscles principaux et secondaires d’après le nom de l’exercice (estimation). Sans charge, 60 % du poids du corps sont comptés (70 kg par défaut).</p>
    </div>
  );
}
