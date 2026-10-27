import Link from "next/link";
import { BookOpen, Dumbbell, ListChecks } from "lucide-react";
import { SettingsRow } from "@/components/ui/settings-row";
import type { ExerciseState, ProgressRow, StrengthProgramView } from "@/lib/data/strength-program";
import { KIND_TITLE } from "@/lib/workout/kind";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

const START = "/record/session?suggest=1&go=1";
const POSTER_TITLE = { HAUT: "Haut du corps", BAS: "Bas du corps" } as const;
const GROUP_TITLE = { HAUT: "Haut du corps", BAS: "Bas du corps + abdos" } as const;
const LETTER = { HAUT: "H", BAS: "B", LIBRE: "L" } as const;
const STATE: Record<ExerciseState, { label: string; tone: string }> = {
  progress: { label: "Progrès", tone: "text-good" },
  stall1: { label: "Stagne", tone: "text-warn" },
  stall2: { label: "Stagne", tone: "text-warn" },
  new: { label: "Nouveau", tone: "text-ink-mute" },
};
const dayLabel = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

/** Affiche de la prochaine séance : art-gym-bg (règle 8), le nom de la demi-séance en géant et, derrière, répété en contour. « Démarrer » = l'action principale de l'écran. */
function Poster({ v }: { v: StrengthProgramView }) {
  const { next } = v, title = POSTER_TITLE[next.kind].toUpperCase();
  const line = [...next.exercises.map((e) => e.label), next.sets ? `${next.sets} séries` : null, next.restSec ? `${next.restSec} s` : null].filter(Boolean).join(" · ");
  return (
    <section aria-label="Prochaine séance" className="relative isolate flex h-[300px] flex-col justify-between overflow-hidden rounded-card bg-art-gym-bg p-4 shadow-card">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-9 -z-10 select-none space-y-0.5 overflow-hidden font-num text-art-poster uppercase text-transparent">
        {[0, 1, 2, 3].map((i) => (
          <p key={i} className="whitespace-nowrap" style={{ WebkitTextStroke: "1.5px rgb(var(--art-gym-fg) / 0.35)", transform: `translateX(${i % 2 ? -64 : 8}px)` }}>{title} {title}</p>
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[78%] bg-gradient-to-t from-art-gym-bg via-art-gym-bg/90 to-transparent" />
      <p className="text-label uppercase text-art-ink-soft-gym">Prochaine séance</p>
      <div className="space-y-3">
        <div>
          <h2 className="text-balance font-num text-art-poster uppercase text-art-ink">{title}</h2>
          <p className="mt-2 text-sm text-art-ink-soft-gym">{line}</p>
        </div>
        <Link href={START} className={cn(ui.btnPrimary, "w-full")}>Démarrer</Link>
      </div>
    </section>
  );
}

/** Le « programme » muscu : l'alternance haut / bas du corps et les six dernières séances (faite = pleine, prochaine = pointillés). */
function ProgrammeCard({ v }: { v: StrengthProgramView }) {
  return (
    <section aria-label="Programme muscu" className={cn(ui.card, "p-4")}>
      <h2 className="text-lg font-bold leading-tight text-ink">{v.lafay ? "Haut / bas · Lafay" : "Haut / bas"}</h2>
      <p className="mt-0.5 text-sm text-ink-soft">Une séance haut du corps, une séance bas du corps + abdos, en alternance · 2 à 3 par semaine</p>
      <p className={cn(ui.label, "mb-2 mt-4")}>{v.recent.length > 1 ? `${v.recent.length} dernières séances` : "Dernière séance"}</p>
      <ol className="flex gap-1.5">
        {v.recent.map((r) => (
          <li key={r.id} className="min-w-0 flex-1">
            <Link href={`/activities/${r.id}`} aria-label={`${KIND_TITLE[r.kind]}, ${dayLabel(r.date)}`}
              className={cn(ui.pressCard, "grid h-11 place-items-center rounded-tile bg-surface-3 font-num text-metric-sm text-ink")}>{LETTER[r.kind]}</Link>
          </li>
        ))}
        <li className="min-w-0 flex-1">
          <span aria-label={`Prochaine : ${POSTER_TITLE[v.next.kind].toLowerCase()}`} className="grid h-11 place-items-center rounded-tile border-2 border-dashed border-ink-mute font-num text-metric-sm text-ink-mute">{LETTER[v.next.kind]}</span>
        </li>
      </ol>
    </section>
  );
}

/** 4 barres : total de répétitions des 4 dernières séances, la plus récente en plus foncé. */
function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <span role="img" aria-label={`Total de répétitions sur les ${values.length} dernières séances : ${values.join(", ")}`} className="flex h-8 w-[34px] shrink-0 items-end gap-[3px]">
      {values.map((x, i) => <span key={i} className={cn("w-1.5 rounded-sm", i === values.length - 1 ? "bg-ink" : "bg-ink-mute/40")} style={{ height: Math.max(3, (x / max) * 32) }} />)}
    </span>
  );
}

function ExerciseRow({ r }: { r: ProgressRow }) {
  const st = STATE[r.state];
  return (
    <li className="flex min-h-14 items-center gap-3 py-2">
      <span className="grid size-10 shrink-0 place-items-center rounded-tile bg-surface-2 font-num text-metric-sm text-ink">{r.code}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight text-ink">{r.name}</p>
        {r.loop ? (
          <p className="mt-0.5 text-sm text-ink-soft"><span className="font-semibold text-warn">Stagne <span className="font-num tabular-nums">2/2</span> · Boucle</span> · repars à <span className="font-num tabular-nums text-ink">{r.loop}</span></p>
        ) : (
          <p className="mt-0.5 truncate text-sm text-ink-soft">Cible <span className="font-num tabular-nums">{r.target}</span> · <span className={cn("font-semibold", st.tone)}>{st.label}{r.stall && <span className="font-num tabular-nums"> {r.stall}</span>}</span></p>
        )}
      </div>
      {r.spark.length > 0 && <Spark values={r.spark} />}
      <p className="w-9 shrink-0 text-right font-num text-metric-sm tabular-nums text-ink">{r.last ?? "—"}</p>
    </li>
  );
}

/** Progression par exercice, par demi-séance : cible du jour et état d'après la règle Lafay, tendance des 4 dernières séances, dernier total. */
function Progression({ v }: { v: StrengthProgramView }) {
  return (
    <section aria-label="Progression" className={cn(ui.card, "p-4")}>
      <h2 className="text-lg font-bold leading-tight text-ink">Progression</h2>
      {v.groups.map((g) => (
        <div key={g.kind} className="mt-4">
          <p className={ui.label}>{GROUP_TITLE[g.kind]}</p>
          <ul className="divide-y divide-surface-2">{g.rows.map((r) => <ExerciseRow key={`${g.kind}-${r.code}-${r.name}`} r={r} />)}</ul>
        </div>
      ))}
      <p className="mt-3 text-xs text-ink-mute">Barres = total de répétitions des 4 dernières séances · chiffre = la dernière · deux séances sans gain : on repart plus bas (boucle)</p>
    </section>
  );
}

/** Sans historique de muscu : pas de programme à montrer, une première séance à lancer. */
function Empty() {
  return (
    <section aria-label="Aucun programme muscu" className={cn(ui.card, "space-y-4 p-4")}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft"><Dumbbell className="size-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">Pas encore de programme muscu</h2>
          <p className="mt-0.5 text-sm text-ink-soft">Fais ta première séance : le programme alterne haut et bas du corps, et ta progression exercice par exercice s’affichera ici dès la deuxième.</p>
        </div>
      </div>
      <Link href="/record/session?suggest=1" className={cn(ui.btnPrimary, "w-full")}>Commencer ma première séance</Link>
    </section>
  );
}

/** Onglet Muscu : affiche de la prochaine séance, programme, progression, puis catalogue et modèles. */
export function MuscuPanel({ v, exercises }: { v: StrengthProgramView; exercises: { total: number; toReview: number } }) {
  return (
    <div className="space-y-3">
      {v.hasHistory ? <><Poster v={v} /><ProgrammeCard v={v} /><Progression v={v} /></> : <Empty />}
      <div className={cn(ui.card, "divide-y divide-surface-2 overflow-hidden")}>
        <SettingsRow icon={<BookOpen />} title="Mes exercices" href="/plan/exercices"
          value={`${exercises.total} exercices${exercises.toReview > 0 ? ` · ${exercises.toReview} ${exercises.toReview > 1 ? "noms à vérifier" : "nom à vérifier"}` : ""}`} />
        <SettingsRow icon={<ListChecks />} title="Modèles de séance" href="/record/session" value="Tes modèles et la bibliothèque Lafay" />
      </div>
    </div>
  );
}
