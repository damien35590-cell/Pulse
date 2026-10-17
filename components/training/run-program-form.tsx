"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRunProgramAction } from "@/app/actions";
import { DEFAULT_VMA, isValidVma, VMA_MAX, VMA_MIN } from "@/lib/training/vma";
import { celebrate } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const seg = "grid grid-cols-2 gap-1.5 rounded-xl bg-surface-2 p-1";
const segBtn = (on: boolean) => cn("min-h-11 rounded-lg px-2 text-sm font-semibold", on ? "bg-surface shadow" : "text-ink-soft");
const fr = (n: number) => String(n).replace(".", ",");

/** Création de « Reprise & VMA ». `current` : dernière VMA connue (sinon 14,5 km/h estimée). */
export function RunProgramForm({ current, replacing }: { current: { vmaKmh: number; label: string; estimated: boolean } | null; replacing?: boolean }) {
  const [n, setN] = useState<2 | 3>(3);
  const [estimated, setEstimated] = useState(current ? current.estimated : true);
  const [vma, setVma] = useState(fr(current?.vmaKmh ?? DEFAULT_VMA.vmaKmh));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const v = parseFloat(vma.replace(",", ".")), valid = isValidVma(v);
  const hint = current ? `Ta dernière VMA (${current.label})` : `Estimée d’après 44′ sur 10 km il y a un an`;

  const submit = () => start(async () => {
    const r = await createRunProgramAction({ sessionsPerWeek: n, vmaKmh: v, estimated });
    if (!r.ok) { setErr(r.error); return; }
    celebrate(); router.refresh();
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (valid) submit(); }} className="space-y-4 rounded-xl border border-line bg-surface p-4">
      {!replacing && (
        <div>
          <h2 className="font-display text-2xl font-bold leading-none">Reprise & VMA</h2>
          <p className="mt-2 text-sm text-ink-soft">12 semaines en 3 blocs. Pas de jours imposés : tu enchaînes les séances dans l’ordre, quand ça t’arrange. Chaque 4e semaine est allégée pour assimiler.</p>
        </div>
      )}

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-semibold">Séances par semaine</legend>
        <div role="radiogroup" aria-label="Séances par semaine" className={seg}>
          {([2, 3] as const).map((k) => <button type="button" key={k} role="radio" aria-checked={n === k} onClick={() => setN(k)} className={segBtn(n === k)}>{k} séances</button>)}
        </div>
        <p className="text-xs text-ink-soft">{n === 3 ? "Qualité, footing, sortie longue" : "Qualité, sortie longue"}</p>
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-semibold">Ta VMA</legend>
        <div role="radiogroup" aria-label="Origine de la VMA" className={seg}>
          <button type="button" role="radio" aria-checked={estimated} onClick={() => setEstimated(true)} className={segBtn(estimated)}>Je l’estime</button>
          <button type="button" role="radio" aria-checked={!estimated} onClick={() => setEstimated(false)} className={segBtn(!estimated)}>Je la connais</button>
        </div>
        <label className="relative block">
          <span className="sr-only">VMA en km/h</span>
          <input value={vma} onChange={(e) => setVma(e.target.value)} inputMode="decimal" className="min-h-12 w-full rounded-xl border border-line bg-surface px-3 pr-16 font-display text-xl font-bold tabular-nums" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">km/h</span>
        </label>
        <p className="text-xs text-ink-soft">
          {!valid ? `Entre une valeur entre ${VMA_MIN} et ${VMA_MAX} km/h.` : estimated ? `${hint}. Le test de la semaine 1 l’affinera.` : "Issue d’un test récent (demi-Cooper, piste…)."}
        </p>
      </fieldset>

      {err && <p role="alert" className="text-sm font-semibold">{err}</p>}
      <button disabled={pending || !valid} className="min-h-14 w-full rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink disabled:opacity-50">
        {pending ? "Préparation…" : replacing ? "Recommencer un nouveau programme" : "Lancer mon programme"}
      </button>
      {replacing && <p className="text-center text-xs text-ink-soft">Le programme en cours sera archivé.</p>}
    </form>
  );
}
