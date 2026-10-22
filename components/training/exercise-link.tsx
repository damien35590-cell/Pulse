"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Plus, RefreshCw, Search } from "lucide-react";
import type { Equipment, LoadType } from "@prisma/client";
import { createCustomExerciseAction, linkExerciseNameAction, updateExerciseCatalog } from "@/app/actions";
import type { CatalogSyncResult, ExerciseOption, UnlinkedName } from "@/lib/data/exercises-catalog";
import { exerciseKey } from "@/lib/exercises";
import { searchRank } from "@/lib/training/match-exercise";
import { EQUIPMENT_LABELS, LOAD_TYPE_LABELS } from "@/lib/training/catalog/exercises";
import { celebrate, tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const btn = "flex min-h-12 items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:opacity-50";
const input = "min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-base";
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const shortDate = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(iso));

/** « Mettre à jour le catalogue » : synchro + rattrapage, puis le compteur du résultat. */
export function CatalogUpdateButton() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<CatalogSyncResult | null>(null), [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const go = () => { tap(); start(async () => {
    const r = await updateExerciseCatalog();
    if (!r.ok) return setErr(r.error);
    setErr(null); setRes(r.result); if (r.result.linked) celebrate(); router.refresh();
  }); };
  return (
    <div className="space-y-2">
      <button disabled={pending} onClick={go} className={cn(btn, "w-full border border-line bg-surface-2")}>
        <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} aria-hidden />{pending ? "Mise à jour…" : "Mettre à jour le catalogue"}
      </button>
      {res && (
        <p role="status" className="text-sm">
          <b>{plural(res.linked, "exercice rattaché", "exercices rattachés")}</b>, {res.toReview} à vérifier
          {res.linkedRows > 0 && <span className="text-ink-soft"> ({plural(res.linkedRows, "ligne", "lignes")} de séances)</span>}
          {res.toReview > 0 && <> · <Link href="/plan/exercices" className="font-semibold text-brand">Vérifier</Link></>}
        </p>
      )}
      {err && <p role="alert" className="text-sm font-semibold">{err}</p>}
    </div>
  );
}

/** Recherche dans le catalogue + mes exercices perso : nom ou alias, tolérant aux fautes de frappe. */
function filterOptions(options: ExerciseOption[], query: string) {
  const q = exerciseKey(query);
  if (!q) return options;
  return options.map((o) => ({ o, r: searchRank(q, [o.name, ...o.aliases]) })).filter((x) => x.r >= 0).sort((a, b) => a.r - b.r).map((x) => x.o);
}

function UnlinkedRow({ item, options }: { item: UnlinkedName; options: ExerciseOption[] }) {
  const [mode, setMode] = useState<"link" | "custom" | null>(null);
  const [q, setQ] = useState("");
  const [name, setName] = useState(item.name), [equipment, setEquipment] = useState<Equipment>("BODYWEIGHT"), [loadType, setLoadType] = useState<LoadType>("BODYWEIGHT");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const run = (f: () => Promise<{ ok: boolean; error?: string }>) => { tap(); start(async () => {
    const r = await f();
    if (!r.ok) setErr(r.error ?? "Action impossible."); else { setErr(null); celebrate(); router.refresh(); }
  }); };
  const list = useMemo(() => filterOptions(options, q).slice(0, 40), [options, q]);
  const others = item.spellings.slice(1);
  return (
    <li className="space-y-3 px-3 py-3">
      <div>
        <p className="font-semibold leading-tight">{item.name}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{plural(item.sessions, "séance", "séances")} · dernière le {shortDate(item.lastAt)}</p>
        {others.length > 0 && <p className="mt-0.5 text-xs text-ink-soft">Aussi écrit : {others.slice(0, 4).join(", ")}{others.length > 4 ? "…" : ""}</p>}
      </div>
      {item.suggestion && mode === null && (
        <button disabled={pending} onClick={() => run(() => linkExerciseNameAction(item.key, item.suggestion!.id))} className={cn(btn, "w-full bg-brand px-3 text-brand-ink")}>
          <Link2 className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">Rattacher à « {item.suggestion.name} »</span>
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button aria-expanded={mode === "link"} onClick={() => { tap(); setMode(mode === "link" ? null : "link"); }} className={cn(btn, "border px-2 text-sm", mode === "link" ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface")}>
          <Search className="h-4 w-4" aria-hidden />Rattacher à…
        </button>
        <button aria-expanded={mode === "custom"} onClick={() => { tap(); setMode(mode === "custom" ? null : "custom"); }} className={cn(btn, "border px-2 text-sm", mode === "custom" ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface")}>
          <Plus className="h-4 w-4" aria-hidden />Exercice perso
        </button>
      </div>

      {mode === "link" && (
        <div className="space-y-2">
          <label className="relative block">
            <span className="sr-only">Rechercher un exercice</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Pompes, DC, tractions…" className={cn(input, "pl-9")} />
          </label>
          <ul className="max-h-72 divide-y divide-line overflow-auto rounded-xl border border-line">
            {list.map((o) => (
              <li key={o.id}>
                <button disabled={pending} onClick={() => run(() => linkExerciseNameAction(item.key, o.id))} className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left disabled:opacity-50">
                  <span className="font-semibold leading-tight">{o.name}</span>
                  <span className="shrink-0 text-xs text-ink-soft">{o.isCustom ? "Perso" : EQUIPMENT_LABELS[o.equipment]}{o.difficulty ? ` · ${o.difficulty}/10` : ""}</span>
                </button>
              </li>
            ))}
            {!list.length && <li className="px-3 py-3 text-sm text-ink-soft">Rien de proche dans le catalogue : crée plutôt un exercice perso.</li>}
          </ul>
        </div>
      )}

      {mode === "custom" && (
        <form onSubmit={(e) => { e.preventDefault(); run(() => createCustomExerciseAction(item.key, { name, equipment, loadType })); }} className="space-y-2">
          <label className="block text-sm text-ink-soft">Nom<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={cn(input, "mt-1 font-semibold text-ink")} /></label>
          <label className="block text-sm text-ink-soft">Matériel
            <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)} className={cn(input, "mt-1 text-ink")}>
              {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((k) => <option key={k} value={k}>{EQUIPMENT_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="block text-sm text-ink-soft">Type de charge
            <select value={loadType} onChange={(e) => setLoadType(e.target.value as LoadType)} className={cn(input, "mt-1 text-ink")}>
              {(Object.keys(LOAD_TYPE_LABELS) as LoadType[]).map((k) => <option key={k} value={k}>{LOAD_TYPE_LABELS[k]}</option>)}
            </select>
          </label>
          <button disabled={pending || !name.trim()} className={cn(btn, "w-full bg-brand text-brand-ink")}>{pending ? "…" : "Créer et rattacher"}</button>
        </form>
      )}
      {err && <p role="alert" className="text-sm font-semibold">{err}</p>}
    </li>
  );
}

/** Noms de mon historique sans exercice : un rattachement s'applique à toutes les séances portant ce nom, et aux prochaines. */
export function UnlinkedList({ items, options }: { items: UnlinkedName[]; options: ExerciseOption[] }) {
  return <ul className="divide-y divide-line rounded-xl border border-line bg-surface">{items.map((i) => <UnlinkedRow key={i.key} item={i} options={options} />)}</ul>;
}
