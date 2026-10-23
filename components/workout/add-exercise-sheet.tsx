"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { exerciseForDraft } from "@/app/(app)/record/session/actions";
import { exerciseKey, suggestExercises, type ExerciseHistory } from "@/lib/exercises";
import { lafayCode } from "@/lib/muscles";
import { LAFAY_LABEL, lafayLetters } from "@/lib/workout/catalog";
import type { DraftExercise } from "@/lib/workout/types";

const item = "flex min-h-14 w-full items-center gap-3 rounded-tile bg-surface px-4 py-2 text-left select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.985] active:bg-surface-3 disabled:opacity-40";

/** Ajouter un exercice à la séance en préparation : exercices Lafay, mes exercices passés, ou un nom libre. La cible du jour est calculée côté serveur. */
export function AddExerciseSheet({ open, onClose, onAdd, taken }: { open: boolean; onClose: () => void; onAdd: (e: DraftExercise) => void; taken: string[] }) {
  const [q, setQ] = useState("");
  const [hist, setHist] = useState<ExerciseHistory[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
    setErr("");
    fetch("/api/exercises").then((r) => (r.ok ? r.json() : [])).then(setHist).catch(() => {});
  }, [open]);

  const key = exerciseKey(q);
  // Les exercices Lafay déjà dans la séance ne se proposent plus ; l'historique des codes Lafay (« B2 - dips ») est couvert par la liste Lafay.
  const lafay = useMemo(() => lafayLetters.filter((l) => !taken.includes(l.toUpperCase()) && (!key || exerciseKey(`${l} ${LAFAY_LABEL[l]}`).includes(key))), [key, taken]);
  const mine = useMemo(() => suggestExercises(q, hist.filter((h) => !lafayCode(h.name) && !taken.includes(h.name)), 12), [q, hist, taken]);
  const exact = key && (mine.some((h) => h.key === key) || taken.includes(q.trim()));

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

  return (
    <BottomSheet open={open} onClose={onClose} title="Ajouter un exercice">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Chercher ou saisir un exercice"
        autoComplete="off"
        enterKeyHint="search"
        aria-label="Chercher un exercice"
        className="mt-3 h-14 w-full rounded-tile bg-surface px-4 text-base font-semibold text-ink caret-brand outline-none ring-1 ring-inset ring-line placeholder:font-normal placeholder:text-ink-mute focus:ring-brand"
      />
      {err && <p role="alert" className="mt-2 text-sm text-bad">{err}</p>}

      {lafay.length > 0 && (
        <section aria-label="Exercices Lafay" className="mt-5">
          <h3 className={ui.label}>Lafay</h3>
          <ul className="mt-2 space-y-2">
            {lafay.map((l) => (
              <li key={l}>
                <button type="button" disabled={busy} onClick={() => pick(l.toUpperCase())} className={item}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 font-num text-sm font-semibold">{l.toUpperCase()}</span>
                  <span className="flex-1 font-semibold">{LAFAY_LABEL[l]}</span>
                  <Plus className="size-5 text-ink-mute" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mine.length > 0 && (
        <section aria-label="Mes exercices" className="mt-5">
          <h3 className={ui.label}>Mes exercices</h3>
          <ul className="mt-2 space-y-2">
            {mine.map((h) => (
              <li key={h.key}>
                <button type="button" disabled={busy} onClick={() => pick(h.name)} className={item}>
                  <span className="flex-1 truncate font-semibold">{h.name}</span>
                  <Plus className="size-5 text-ink-mute" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {q.trim() && !exact && (
        <button type="button" disabled={busy} onClick={() => pick(q)} className={cn(ui.btnSecondary, "mt-5 w-full bg-surface-3")}>
          Nouvel exercice : « {q.trim()} »
        </button>
      )}
    </BottomSheet>
  );
}
