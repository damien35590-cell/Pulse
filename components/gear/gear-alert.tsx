import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { GearUsage } from "@/lib/data/gear";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Bandeau d'accueil : matériel au-delà de son seuil critique (rouge) ou qui s'en approche (orange). */
export function GearAlert({ gear }: { gear: GearUsage[] }) {
  if (!gear.length) return null;
  const critical = gear.some((g) => g.level === "critical");
  return (
    <Link href="/gear" role="alert"
      className={cn("flex items-start gap-3 rounded-xl border p-4 active:scale-[.99]", critical ? "border-red-600/40 bg-red-600/10" : "border-amber-500/40 bg-amber-500/10")}>
      <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", critical ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{critical ? "Matériel à remplacer" : "Matériel à surveiller"}</p>
        <ul className="mt-0.5 text-sm">
          {gear.slice(0, 3).map((g) => <li key={g.id}>{g.name} : <b className="tabular-nums">{fmtNum(g.km, 0)}</b> / {fmtNum(g.limitKm ?? 0, 0)} km</li>)}
        </ul>
      </div>
      <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
    </Link>
  );
}
