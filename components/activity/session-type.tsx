"use client";
import { useState, useTransition } from "react";
import { setSessionType } from "@/app/actions";
import { sessionTypesFor, sessionTypeFor, type SessionType } from "@/lib/art/session-type";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * « Type de séance » : options propres au sport, en pastilles qui passent à la ligne (jamais de libellé tronqué).
 * Montre la valeur détectée par défaut ; la changer fixe un choix manuel, revenir à la détectée le retire (retour à l'auto).
 */
export function SessionTypeControl({ id, type, detected, current }: { id: string; type: string; detected: SessionType; current: string | null }) {
  const options = sessionTypesFor(type);
  const [value, setValue] = useState<SessionType>(sessionTypeFor(type, current) ?? detected);
  const [pending, start] = useTransition();
  if (options.length === 0) return null;
  const pick = (v: SessionType) => {
    if (v === value) return;
    tap(10);
    const prev = value;
    setValue(v);
    start(async () => { const r = await setSessionType(id, v === detected ? null : v); if (!r.ok) setValue(prev); });
  };
  return (
    <section aria-label="Type de séance">
      <p className="mb-2 text-label uppercase text-ink-soft">Type de séance</p>
      <div role="radiogroup" aria-label="Type de séance" className={cn("flex flex-wrap gap-2", pending && "opacity-60")}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => pick(o.value)}
            className={cn("inline-flex h-11 items-center rounded-full px-4 text-sm font-medium select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.97]", value === o.value ? "bg-ink text-bg" : "bg-surface-2 text-ink-soft")}>
            {o.label}
          </button>
        ))}
      </div>
      {current == null && <p className="mt-1 text-xs text-ink-soft">Détecté automatiquement.</p>}
    </section>
  );
}
