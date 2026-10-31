"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { addLibraryTemplate, myEquipment } from "@/app/(app)/record/session/actions";
import { EQUIPMENT_LABELS, missingEquipment } from "@/lib/workout/catalog";
import { PROGRAM_TEMPLATES, type Equipment, type ProgramTemplate } from "@/lib/workout/catalog-data";
import { SOURCE_LABEL, exerciseLabel, libraryTemplate, prescription } from "@/lib/workout/library";

const ORDER: ProgramTemplate["source"][] = ["perso", "lafay", "lafay-turbo", "renfo", "superphysique"];
const restTxt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60}` : ""}` : `${s} s`);

/**
 * Bibliothèque de modèles (Lafay T1/T2, mes programmes, SuperPhysique) : aperçu, puis « Ajouter à mes modèles »
 * crée un modèle de séance par séance, modifiable ensuite comme n'importe quel modèle.
 */
export function LibrarySheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (names: string[]) => void }) {
  const [equip, setEquip] = useState<Equipment[] | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setView(null); setErr(""); setBusy(false);
    myEquipment().then(setEquip).catch(() => setEquip(null));
  }, [open]);

  const groups = useMemo(() => ORDER.map((src) => ({ src, list: PROGRAM_TEMPLATES.filter((t) => t.source === src) })).filter((g) => g.list.length), []);
  const t = view ? libraryTemplate(view) : undefined;
  const missing = (x: ProgramTemplate) => (equip ? missingEquipment(x.requires, equip) : []);

  async function add(id: string) {
    if (busy) return;
    tap(12);
    setBusy(true);
    setErr("");
    const r = await addLibraryTemplate(id).catch(() => ({ ok: false as const, error: "Impossible d'ajouter ce modèle : réessaie." }));
    setBusy(false);
    if (r.ok) onAdded(r.names); else setErr(r.error);
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t ? t.name : "Bibliothèque de modèles"}>
      {t ? (
        <div className="mt-2 space-y-4">
          <button type="button" onClick={() => { tap(6); setView(null); }} className="-ml-2 inline-flex h-12 items-center gap-1 rounded-full px-2 text-sm font-semibold text-ink-soft active:bg-surface-2">
            <ArrowLeft className="size-5" aria-hidden />Bibliothèque
          </button>
          <div className="flex flex-wrap gap-2">
            <span className={ui.chip}>{SOURCE_LABEL[t.source]}</span>
            {t.inspired && <span className={ui.chip}>inspiré de</span>}
            {t.bookRef && <span className={ui.chip}>{t.bookRef}</span>}
          </div>
          <p className="text-sm text-ink-soft"><b className="font-semibold text-ink">{t.frequency}.</b> {t.progression}</p>
          {missing(t).length > 0 && <p className="text-sm text-warn">Matériel manquant : {missing(t).map((m) => EQUIPMENT_LABELS[m as Exclude<Equipment, "aucun">]).join(", ")}.</p>}
          {t.sessions.map((s) => (
            <section key={s.name} className={cn(ui.card, "p-4")}>
              <h3 className={ui.label}>{s.name}</h3>
              <ul className="mt-2 divide-y divide-line/60">
                {s.exercises.map((x, i) => (
                  <li key={i} className="py-2">
                    <div className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate font-semibold">{exerciseLabel(x.exerciseId)}</span>
                      <span className="shrink-0 font-num text-metric-sm tabular-nums">{prescription(x)}</span>
                    </div>
                    <p className="text-sm text-ink-mute">
                      repos {restTxt(x.restSec)}{x.alternatives?.length ? ` · ou ${x.alternatives.join(", ")}` : ""}{x.note ? ` · ${x.note}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {t.source === "lafay" && (
            <Link href="/plan/test/nouveau" className={cn(ui.btnSecondary, "w-full")}>
              <ClipboardCheck className="size-5" aria-hidden />Pas sûr du niveau ? Faire le test
            </Link>
          )}
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
          <button type="button" disabled={busy} onClick={() => add(t.id)} className={cn(ui.btnPrimary, "w-full")}>
            {busy ? "Ajout…" : t.sessions.length > 1 ? `Ajouter les ${t.sessions.length} séances à mes modèles` : "Ajouter à mes modèles"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-6">
          {groups.map((g) => (
            <section key={g.src} aria-label={SOURCE_LABEL[g.src]}>
              <h3 className={ui.label}>{SOURCE_LABEL[g.src]}</h3>
              <ul className="mt-2 space-y-2">
                {g.list.map((x) => {
                  const miss = missing(x).length > 0;
                  return (
                    <li key={x.id}>
                      <button type="button" onClick={() => { tap(6); setView(x.id); }} className={cn("flex min-h-14 w-full items-center gap-3 rounded-tile bg-surface px-4 py-2 text-left select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.985] active:bg-surface-3", miss && "opacity-60")}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{x.name}</span>
                          <span className="block truncate text-sm text-ink-mute">
                            {x.sessions.length} séance{x.sessions.length > 1 ? "s" : ""}{x.inspired ? " · inspiré de" : ""}{miss ? " · matériel manquant" : ""}
                          </span>
                        </span>
                        <ChevronRight className="size-5 shrink-0 text-ink-mute" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
