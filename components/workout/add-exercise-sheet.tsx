"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Info, Plus } from "lucide-react";
import Link from "next/link";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Segmented } from "@/components/ui/segmented";
import { exerciseForDraft, myEquipment } from "@/app/(app)/record/session/actions";
import { exerciseKey, suggestExercises, type ExerciseHistory } from "@/lib/exercises";
import { lafayCode } from "@/lib/muscles";
import { catalogExercise, catalogFor, displayLabel, doable } from "@/lib/workout/catalog";
import { ALL_EXERCISES, FAMILIES, type CatalogExercise, type Equipment, type MuscleId } from "@/lib/workout/catalog-data";
import { musclesOfName } from "@/lib/workout/body";
import type { DraftExercise } from "@/lib/workout/types";
import { CodeBadge, ExerciseDetail, ExerciseThumb, LevelBars } from "./catalog-bits";

const item = "flex min-h-14 w-full items-center gap-3 rounded-tile bg-surface px-3 py-2 text-left select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.985] active:bg-surface-3 disabled:opacity-40";
const pill = (on: boolean) => cn("h-12 shrink-0 touch-manipulation rounded-full px-4 text-sm font-semibold transition active:scale-95", on ? "bg-ink text-bg" : "bg-surface text-ink-soft");

type Source = "ALL" | "lafay" | "superphysique";
/** Filtres par groupe : un exercice y figure quand l'un de ses muscles principaux en fait partie. */
const MUSCLE_FILTERS: { label: string; muscles: MuscleId[] }[] = [
  { label: "Pectoraux", muscles: ["chest"] },
  { label: "Dos", muscles: ["lats", "upper_back", "lower_back", "traps"] },
  { label: "Épaules", muscles: ["front_delts", "side_delts", "rear_delts"] },
  { label: "Bras", muscles: ["biceps", "triceps", "forearms"] },
  { label: "Jambes", muscles: ["quads", "hamstrings", "glutes", "adductors", "calves"] },
  { label: "Abdos", muscles: ["abs", "obliques"] },
];
const BY_ID = new Map(ALL_EXERCISES.map((e) => [e.id, e]));
const searchKey = (e: CatalogExercise) => exerciseKey(`${e.code ?? ""} ${e.name} ${e.subtitle ?? ""}`);

/**
 * Ajouter un exercice à la séance en préparation : catalogue Lafay (familles → sous-catégories → variantes) et SuperPhysique,
 * filtres source / muscle / « Matériel de muscu », exercices récents, fiche détaillée, ou un nom libre. La cible du jour est calculée côté serveur.
 */
export function AddExerciseSheet({ open, onClose, onAdd, taken }: { open: boolean; onClose: () => void; onAdd: (e: DraftExercise) => void; taken: string[] }) {
  const [q, setQ] = useState("");
  const [hist, setHist] = useState<ExerciseHistory[]>([]);
  const [equip, setEquip] = useState<Equipment[] | null>(null);
  const [source, setSource] = useState<Source>("ALL");
  const [muscle, setMuscle] = useState<number | null>(null);
  const [onlyMine, setOnlyMine] = useState(true);
  const [openFam, setOpenFam] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ(""); setErr(""); setInfo(null); setOpenFam(null);
    fetch("/api/exercises").then((r) => (r.ok ? r.json() : [])).then(setHist).catch(() => {});
    myEquipment().then(setEquip).catch(() => setEquip(null));
  }, [open]);

  const key = exerciseKey(q);
  const match = useMemo(() => {
    const ms = muscle != null ? MUSCLE_FILTERS[muscle].muscles : null;
    return (e: CatalogExercise) =>
      (source === "ALL" || (source === "lafay" ? e.source !== "superphysique" : e.source === "superphysique")) &&
      (!ms || e.muscles.primary.some((m) => ms.includes(m))) &&
      (!onlyMine || !equip || doable(e, equip)) &&
      (!key || searchKey(e).includes(key) || e.code?.toLowerCase() === q.trim().toLowerCase());
  }, [source, muscle, onlyMine, equip, key, q]);

  const families = useMemo(() => FAMILIES.map((f) => ({
    f,
    groups: f.groups.map((g) => ({ name: g.name, list: g.progression.map((id) => BY_ID.get(id)!).filter((e) => e && match(e)) })).filter((g) => g.list.length),
  })).filter((x) => x.groups.length), [match]);
  const flat = useMemo(() => (key ? ALL_EXERCISES.filter(match).slice(0, 40) : []), [key, match]);
  const recent = useMemo(() => [...hist].sort((a, b) => (b.sessions[0]?.date ?? "").localeCompare(a.sessions[0]?.date ?? "")).slice(0, 5), [hist]);
  const mine = useMemo(() => (key ? suggestExercises(q, hist.filter((h) => !lafayCode(h.name) && !catalogFor(h.name, null)), 8) : []), [q, key, hist]);
  const exact = key && (flat.some((e) => searchKey(e) === key) || mine.some((h) => h.key === key));
  const hidden = onlyMine && equip ? ALL_EXERCISES.filter((e) => !doable(e, equip)).length : 0;

  async function pick(name: string) {
    if (busy) return;
    tap(10);
    setBusy(true);
    setErr("");
    try {
      const ex = await exerciseForDraft(name);
      if (!ex) throw new Error("vide");
      onAdd(ex);
    } catch {
      setErr("Impossible d’ajouter cet exercice : réessaie.");
    }
    setBusy(false);
  }

  const row = (e: CatalogExercise) => {
    const inSession = taken.includes(e.code ?? displayLabel(e));
    return (
      <li key={e.id} className="flex items-center gap-1">
        <button type="button" disabled={busy} onClick={() => pick(displayLabel(e))} className={item}>
          <ExerciseThumb muscles={e.muscles} code={e.code} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{e.name}</span>
            {e.subtitle && <span className="block truncate text-sm text-ink-soft">{e.subtitle}</span>}
          </span>
          <LevelBars level={e.level} />
          {inSession ? <Check className="size-5 text-good" aria-label="Déjà dans la séance" /> : <Plus className="size-5 text-ink-mute" aria-hidden />}
        </button>
        <button type="button" onClick={() => { tap(6); setInfo(e.id); }} aria-label={`Fiche ${e.code ?? e.name}`} className={cn(ui.iconBtn, "text-ink-soft")}>
          <Info className="size-5" aria-hidden />
        </button>
      </li>
    );
  };

  const detail = catalogExercise(info);
  return (
    <BottomSheet open={open} onClose={onClose} title="Ajouter un exercice">
      {detail ? (
        <ExerciseDetail ex={detail} onBack={() => setInfo(null)} onOpen={setInfo} onAdd={(e) => pick(displayLabel(e))} />
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher : dips, A3, rowing…"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Chercher un exercice"
            className="mt-3 h-14 w-full rounded-tile bg-surface px-4 text-base font-semibold text-ink caret-brand outline-none ring-1 ring-inset ring-line placeholder:font-normal placeholder:text-ink-mute focus-visible:ring-brand"
          />
          <Segmented<Source> className="mt-3" value={source} onChange={setSource} options={[{ value: "ALL", label: "Tout" }, { value: "lafay", label: "Lafay" }, { value: "superphysique", label: "SuperPhysique" }]} />
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            <button type="button" aria-pressed={onlyMine} onClick={() => { tap(6); setOnlyMine((v) => !v); }} className={pill(onlyMine)}>Matériel de muscu</button>
            {MUSCLE_FILTERS.map((m, i) => (
              <button key={m.label} type="button" aria-pressed={muscle === i} onClick={() => { tap(6); setMuscle(muscle === i ? null : i); }} className={pill(muscle === i)}>{m.label}</button>
            ))}
          </div>
          {err && <p role="alert" className="mt-2 text-sm text-bad">{err}</p>}

          {!key && recent.length > 0 && (
            <section aria-label="Récents" className="mt-5">
              <h3 className={ui.label}>Récents</h3>
              <ul className="mt-2 space-y-2">
                {recent.map((h) => (
                  <li key={h.key}>
                    <button type="button" disabled={busy} onClick={() => pick(h.name)} className={item}>
                      <ExerciseThumb muscles={musclesOfName(h.name)} />
                      <span className="flex-1 truncate font-semibold">{h.name}</span>
                      <Plus className="size-5 text-ink-mute" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {key ? (
            flat.length > 0 && (
              <section aria-label="Catalogue" className="mt-5">
                <h3 className={ui.label}>Catalogue</h3>
                <ul className="mt-2 space-y-2">{flat.map(row)}</ul>
              </section>
            )
          ) : (
            <section aria-label="Catalogue" className="mt-5">
              <h3 className={ui.label}>Catalogue</h3>
              <ul className="mt-2 space-y-2">
                {families.map(({ f, groups }) => {
                  const expanded = openFam === f.id, count = groups.reduce((n, g) => n + g.list.length, 0);
                  return (
                    <li key={f.id}>
                      <button type="button" aria-expanded={expanded} onClick={() => { tap(6); setOpenFam(expanded ? null : f.id); }} className={item}>
                        <CodeBadge code={f.letter} />
                        <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                        <span className="font-num text-sm tabular-nums text-ink-mute">{count}</span>
                        <ChevronDown className={cn("size-5 text-ink-mute transition-transform", expanded && "rotate-180")} aria-hidden />
                      </button>
                      {expanded && (
                        <div className="mt-2 space-y-3 pl-3">
                          {groups.map((g) => (
                            <div key={g.name}>
                              {groups.length > 1 && <p className="mb-1.5 text-sm font-semibold text-ink-soft">{g.name}</p>}
                              <ul className="space-y-2">{g.list.map(row)}</ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {hidden > 0 && <p className="mt-3 text-sm text-ink-mute">{hidden} exercices masqués faute de matériel (réglable dans <Link href="/vous/materiel-muscu" className="font-semibold text-brand">Vous › Matériel de muscu</Link>).</p>}
            </section>
          )}

          {mine.length > 0 && (
            <section aria-label="Mes exercices" className="mt-5">
              <h3 className={ui.label}>Mes exercices</h3>
              <ul className="mt-2 space-y-2">
                {mine.map((h) => (
                  <li key={h.key}>
                    <button type="button" disabled={busy} onClick={() => pick(h.name)} className={item}>
                      <ExerciseThumb muscles={musclesOfName(h.name)} />
                      <span className="flex-1 truncate font-semibold">{h.name}</span>
                      <Plus className="size-5 text-ink-mute" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {key && flat.length === 0 && mine.length === 0 && onlyMine && <p className="mt-4 text-sm text-ink-mute">Rien avec ton matériel. Désactive « Matériel de muscu » pour tout voir.</p>}
          {q.trim() && !exact && (
            <button type="button" disabled={busy} onClick={() => pick(q)} className={cn(ui.btnSecondary, "mt-5 w-full bg-surface-3")}>
              Exercice perso : « {q.trim()} »
            </button>
          )}
        </>
      )}
    </BottomSheet>
  );
}
