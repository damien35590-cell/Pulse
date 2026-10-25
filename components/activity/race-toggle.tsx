"use client";
import { useState, useTransition } from "react";
import { setRace } from "@/app/actions";
import { Switch } from "@/components/ui/switch";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** « Compétition » : marque la sortie comme une course (pastille dans le fil et l'en-tête). Enregistrement immédiat, retour arrière si l'écriture échoue. */
export function RaceToggle({ id, isRace }: { id: string; isRace: boolean }) {
  const [value, setValue] = useState(isRace);
  const [, start] = useTransition();
  return (
    <section aria-label="Compétition" className={cn(ui.card, "px-4")}>
      <Switch
        checked={value}
        label="Compétition"
        description="Cette sortie était une course."
        onChange={(v) => { setValue(v); start(async () => { const r = await setRace(id, v); if (!r.ok) setValue(!v); }); }}
      />
    </section>
  );
}
