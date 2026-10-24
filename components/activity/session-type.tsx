"use client";
import { useState, useTransition } from "react";
import { setSessionType } from "@/app/actions";
import { Segmented } from "@/components/ui/segmented";
import { SESSION_TYPES, type SessionType } from "@/lib/art/session-type";

/** « Type de séance » : montre la valeur détectée par défaut ; la changer fixe un choix manuel, revenir à la détectée le retire (retour à l'auto). */
export function SessionTypeControl({ id, detected, current }: { id: string; detected: SessionType; current: SessionType | null }) {
  const [value, setValue] = useState<SessionType>(current ?? detected);
  const [pending, start] = useTransition();
  return (
    <section aria-label="Type de séance">
      <p className="mb-2 text-label uppercase text-ink-soft">Type de séance</p>
      <Segmented
        className={pending ? "opacity-60" : undefined}
        options={SESSION_TYPES.map((o) => ({ value: o.value, label: o.label }))}
        value={value}
        onChange={(v) => { const prev = value; setValue(v); start(async () => { const r = await setSessionType(id, v === detected ? null : v); if (!r.ok) setValue(prev); }); }}
      />
      {current == null && <p className="mt-1 text-xs text-ink-soft">Détecté automatiquement.</p>}
    </section>
  );
}
