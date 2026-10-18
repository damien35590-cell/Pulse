import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { GearUsage } from "@/lib/data/gear";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";

/** Bandeau d'accueil : matériel au-delà de son seuil critique (rouge) ou qui s'en approche (orange). */
export function GearAlert({ gear }: { gear: GearUsage[] }) {
  if (!gear.length) return null;
  const critical = gear.some((g) => g.level === "critical");
  return (
    <Link href="/gear" role="alert"
      className={cn(ui.card, ui.pressCard, "flex items-start gap-3 p-4")}>
      <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", critical ? "text-bad" : "text-warn")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{critical ? "Matériel à remplacer" : "Matériel à surveiller"}</p>
        <ul className="mt-0.5 text-sm text-ink-soft">
          {gear.slice(0, 3).map((g) => <li key={g.id}>{g.name} : <b className="font-num tabular-nums text-ink">{fmtNum(g.km, 0)}</b> / {fmtNum(g.limitKm ?? 0, 0)} km</li>)}
        </ul>
      </div>
      <ChevronRight className="mt-0.5 size-5 shrink-0 text-ink-mute" aria-hidden />
    </Link>
  );
}
