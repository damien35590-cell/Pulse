import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { Sparkline } from "@/components/ui/sparkline";
import { Delta } from "@/components/ui/metric";

type Props = {
  icon: LucideIcon;
  label: string;
  /** Nom sous le libellé (ex. la course visée). */
  title?: string;
  value: string;
  /** "brand" : compte à rebours (J-154). */
  tone?: "default" | "brand";
  unit?: string;
  sub: string;
  delta?: { text: string; good: boolean };
  spark?: number[];
  /** 0 → 1 : barre de progression vers un objectif. */
  progress?: number;
  href?: string;
};

/** Tuile compacte (2 par ligne) : un chiffre, une tendance, une phrase. Pour la forme, une course, un record… */
export function StatTile({ icon: Icon, label, title, value, tone = "default", unit, sub, delta, spark, progress, href }: Props) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-label uppercase text-ink-mute">
        <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
        <span className="truncate">{label}</span>
      </p>
      {title && <p className="mt-1.5 truncate text-[15px] font-semibold leading-tight text-ink">{title}</p>}
      <p className={cn("flex items-baseline gap-1.5", title ? "mt-1" : "mt-2")}>
        <span className={cn("font-num text-metric-lg tabular-nums", tone === "brand" ? "text-brand" : "text-ink")}>{value}</span>
        {unit && <span className="text-sm font-medium text-ink-soft">{unit}</span>}
        {delta && <Delta good={delta.good}>{delta.text}</Delta>}
      </p>
      {spark && <Sparkline values={spark} className="mt-2 text-brand" />}
      {progress != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      )}
      <p className="mt-auto pt-2 text-xs leading-snug text-ink-soft">{sub}</p>
    </>
  );
  const cls = cn(ui.card, "flex min-h-[9.5rem] flex-col p-3.5");
  return href ? <Link href={href} className={cn(cls, ui.pressCard)}>{body}</Link> : <div className={cls}>{body}</div>;
}
