"use client";
import { useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { saveWarmupDefaults } from "@/app/(app)/record/session/actions";
import { WARMUP_MAX_ITEMS, WARMUP_MAX_MIN, WARMUP_NAME_MAX, type WarmupItem } from "@/lib/workout/warmup";

type Row = WarmupItem & { key: number };
let seq = 0;
const rows = (l: WarmupItem[]): Row[] => l.map((x) => ({ ...x, key: seq++ }));
const same = (a: WarmupItem[], b: WarmupItem[]) => JSON.stringify(a.map(({ name, min }) => ({ name: name.trim(), min }))) === JSON.stringify(b.map(({ name, min }) => ({ name: name.trim(), min })));

/** « Échauffement » : ce qui est proposé avant le premier exercice de chaque séance de muscu (nom + minutes visées). Liste vide = pas d'échauffement. */
export function WarmupSettings({ initial }: { initial: WarmupItem[] }) {
  const [saved, setSaved] = useState(initial);
  const [list, setList] = useState(() => rows(initial));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const patch = (key: number, p: Partial<WarmupItem>) => { setMsg(null); setList((l) => l.map((x) => (x.key === key ? { ...x, ...p } : x))); };
  const valid = list.every((x) => x.name.trim());
  const dirty = !same(list, saved);

  async function save() {
    if (busy || !valid) return;
    tap(12);
    setBusy(true);
    try {
      const out = await saveWarmupDefaults(list.map(({ name, min }) => ({ name: name.trim(), min })));
      setSaved(out);
      setList(rows(out));
      setMsg({ ok: true, text: "Enregistré : la prochaine séance commencera ainsi." });
    } catch {
      setMsg({ ok: false, text: "Pas enregistré : vérifie ta connexion." });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className={cn(ui.card, "p-4")}>
        <p className="font-display text-lg font-bold">Avant le premier exercice</p>
        <p className="text-sm text-ink-soft">Proposé au début de chaque séance de muscu, avec un chrono par élément. Hors séries, répétitions et progression ; compté dans la durée.</p>
        <ul className="mt-3 divide-y divide-surface-2">
          {list.map((x) => (
            <li key={x.key} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-1">
                <input
                  value={x.name}
                  onChange={(e) => patch(x.key, { name: e.target.value })}
                  maxLength={WARMUP_NAME_MAX}
                  aria-label="Nom de l’élément"
                  placeholder="Rameur, vélo…"
                  autoComplete="off"
                  enterKeyHint="done"
                  className="h-12 min-w-0 flex-1 rounded-tile bg-surface-2 px-3 text-base font-semibold text-ink caret-brand outline-none placeholder:font-normal placeholder:text-ink-mute focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand"
                />
                <button type="button" onClick={() => { tap(8); setMsg(null); setList((l) => l.filter((y) => y.key !== x.key)); }} aria-label={`Retirer ${x.name || "l’élément"}`} className={cn(ui.iconBtn, "text-ink-soft")}>
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex-1 text-sm text-ink-soft">Durée visée</span>
                <button type="button" aria-label="Une minute de moins" disabled={x.min <= 1} onClick={() => { tap(6); patch(x.key, { min: x.min - 1 }); }} className={cn(ui.iconBtn, "bg-surface-2 disabled:opacity-30")}>
                  <Minus className="size-5" aria-hidden />
                </button>
                <span className="w-16 text-center font-num text-metric-sm tabular-nums">{x.min}<span className="ml-1 font-sans text-xs font-medium text-ink-soft">min</span></span>
                <button type="button" aria-label="Une minute de plus" disabled={x.min >= WARMUP_MAX_MIN} onClick={() => { tap(6); patch(x.key, { min: x.min + 1 }); }} className={cn(ui.iconBtn, "bg-surface-2 disabled:opacity-30")}>
                  <Plus className="size-5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {list.length === 0 && <p className="mt-3 text-sm text-ink-mute">Pas d’échauffement : la séance commence directement par le premier exercice.</p>}
        {list.length < WARMUP_MAX_ITEMS && (
          <button type="button" onClick={() => { tap(6); setMsg(null); setList((l) => [...l, ...rows([{ name: "", min: 3 }])]); }} className={cn(ui.btnSecondary, "mt-4 w-full")}>
            <Plus className="size-5" aria-hidden />Ajouter un élément
          </button>
        )}
      </div>
      <button type="button" disabled={!dirty || !valid || busy} onClick={save} className={cn(ui.btnPrimary, "w-full")}>
        {busy ? "Enregistrement…" : "Enregistrer"}
      </button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={cn("flex items-center justify-center gap-1.5 text-sm", msg.ok ? "text-good" : "text-bad")}>
          {msg.ok && <Check className="size-4" aria-hidden />}{msg.text}
        </p>
      )}
    </div>
  );
}
