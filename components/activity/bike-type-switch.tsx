"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bike, Zap } from "lucide-react";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const OPTS = [["RIDE", "Vélo musculaire", Bike], ["EBIKE", "E-bike", Zap]] as const;

/** Reclasse une sortie vélo en E-bike (activité douce) et inversement. */
export function BikeTypeSwitch({ activityId, type }: { activityId: string; type: "RIDE" | "EBIKE" }) {
  const [cur, setCur] = useState(type);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function pick(next: "RIDE" | "EBIKE") {
    if (next === cur) return;
    tap(10);
    const prev = cur;
    setCur(next);
    const r = await fetch(`/api/activities/${activityId}/note`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: next }),
    }).catch(() => null);
    if (!r?.ok) return setCur(prev);
    start(() => router.refresh());
  }

  return (
    <div role="radiogroup" aria-label="Type de sortie vélo" className={cn("flex gap-1 rounded-full bg-surface-2 p-1", pending && "opacity-70")}>
      {OPTS.map(([k, l, I]) => (
        <button key={k} type="button" role="radio" aria-checked={cur === k} onClick={() => pick(k)}
          className={cn("flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm", cur === k ? "bg-surface font-bold shadow" : "text-ink-soft")}>
          <I className="h-4 w-4" aria-hidden />{l}
        </button>
      ))}
    </div>
  );
}
