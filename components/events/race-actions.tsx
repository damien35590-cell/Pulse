"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteEvent, saveRaceResult, setRaceStatus, type RaceStatusKey } from "@/app/actions";
import { STATUS_LABEL } from "@/lib/races/format";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";
import { field, goalToText, parseGoal } from "./race-form";

export function RaceStatusPicker({ id, status }: { id: string; status: RaceStatusKey }) {
  const [cur, setCur] = useState(status);
  const [pending, start] = useTransition();
  const pick = (s: RaceStatusKey) => { if (s === cur) return; tap(6); const prev = cur; setCur(s); start(async () => { if (!(await setRaceStatus(id, s)).ok) setCur(prev); }); };
  return (
    <div role="radiogroup" aria-label="Statut" className={cn("grid grid-cols-2 gap-1.5 rounded-xl bg-surface-2 p-1.5 min-[400px]:grid-cols-4", pending && "opacity-80")}>
      {(Object.keys(STATUS_LABEL) as RaceStatusKey[]).map((s) => (
        <button key={s} role="radio" aria-checked={cur === s} onClick={() => pick(s)}
          className={cn("min-h-11 whitespace-nowrap rounded-lg px-1 text-[13px] font-semibold transition", cur === s ? "bg-brand text-brand-ink shadow-sm" : "text-ink-soft active:bg-surface")}>
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

type Result = { resultTimeS: number | null; rankOverall: number | null; rankCategory: number | null; participants: number | null };
const int = (s: string) => { const n = parseInt(s.replace(/\s/g, ""), 10); return Number.isFinite(n) && n > 0 ? n : undefined; };
/** Temps de course : "1:12:45" (h:mm:ss) ou "45:30" (mm:ss, contrairement à l'objectif où "1:15" = 1 h 15). */
const parseResult = (s: string) => { const p = s.trim().split(":"); return p.length === 2 && p.every((x) => /^\d+$/.test(x)) && +p[1] < 60 ? (+p[0] * 60 + +p[1] || undefined) : parseGoal(s); };

export function RaceResultForm({ id, initial }: { id: string; initial: Result }) {
  const [f, setF] = useState({ time: goalToText(initial.resultTimeS ?? undefined), overall: initial.rankOverall?.toString() ?? "", cat: initial.rankCategory?.toString() ?? "", of: initial.participants?.toString() ?? "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setMsg(null); setF((p) => ({ ...p, [k]: e.target.value })); };
  const badTime = f.time.trim() !== "" && parseResult(f.time) === undefined;
  const save = () => start(async () => {
    const r = await saveRaceResult(id, { resultTimeS: parseResult(f.time), rankOverall: int(f.overall), rankCategory: int(f.cat), participants: int(f.of) });
    setMsg(r.ok ? { ok: true, text: "Résultat enregistré." } : { ok: false, text: r.error });
  });
  return (
    <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">
      <label className="col-span-2">Temps (h:mm:ss)<input value={f.time} onChange={set("time")} inputMode="numeric" placeholder="1:12:45" className={field} aria-invalid={badTime} /></label>
      <label>Classement général<input value={f.overall} onChange={set("overall")} inputMode="numeric" className={field} /></label>
      <label>Sur (participants)<input value={f.of} onChange={set("of")} inputMode="numeric" className={field} /></label>
      <label className="col-span-2">Classement catégorie<input value={f.cat} onChange={set("cat")} inputMode="numeric" className={field} /></label>
      {badTime && <p role="alert" className="col-span-2 font-semibold text-ink">Format attendu : 1:12:45 ou 45:30.</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={cn("col-span-2 font-semibold", msg.ok ? "text-brand" : "text-ink")}>{msg.text}</p>}
      <button onClick={save} disabled={pending || badTime} className="col-span-2 min-h-12 rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-50">{pending ? "Enregistrement…" : "Enregistrer le résultat"}</button>
    </div>
  );
}

export function DeleteRace({ id, name }: { id: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!confirm) return <button onClick={() => setConfirm(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-ink-soft active:bg-surface-2"><Trash2 className="h-4 w-4" aria-hidden />Supprimer la course</button>;
  return (
    <div role="alertdialog" aria-label="Confirmer la suppression" className="rounded-xl border border-brand/40 bg-surface p-4">
      <p className="font-semibold">Supprimer « {name} » ?</p>
      <p className="text-sm text-ink-soft">Cette action est définitive.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => setConfirm(false)} className="min-h-12 rounded-xl border border-line font-semibold">Annuler</button>
        <button disabled={pending} onClick={() => start(async () => { await deleteEvent(id); router.replace("/events"); })} className="min-h-12 rounded-xl bg-brand font-semibold text-brand-ink disabled:opacity-50">{pending ? "Suppression…" : "Supprimer"}</button>
      </div>
    </div>
  );
}
