"use client";
import { useState, useTransition } from "react";
import { updateEvent } from "@/app/actions";
import { RaceFields, toForm, formToDraft, type Form } from "./race-form";
import type { RaceDraft } from "@/types/race";

export function EditRace({ id, draft }: { id: string; draft: RaceDraft }) {
  const [f, setF] = useState<Form>(toForm(draft));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Form) => (e: { target: { value: string } }) => { setMsg(null); setF((p) => ({ ...p, [k]: e.target.value })); };

  const save = () => start(async () => {
    const r = await updateEvent(id, formToDraft(f, { url: draft.url, platform: draft.platform }));
    setMsg(r.ok ? { ok: true, text: "Modifications enregistrées." } : { ok: false, text: r.error });
  });

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <RaceFields f={f} set={set} />
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm font-semibold ${msg.ok ? "text-brand" : "text-ink"}`}>{msg.text}</p>}
      <button onClick={save} disabled={pending || !f.name.trim() || !f.date} className="mt-4 min-h-14 w-full rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink disabled:opacity-50">{pending ? "Enregistrement…" : "Enregistrer"}</button>
    </section>
  );
}
