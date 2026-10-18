import { cn } from "@/lib/utils";

export type MetricSize = "sm" | "md" | "lg" | "xl" | "hero";

const VALUE: Record<MetricSize, string> = {
  sm: "text-metric-sm", md: "text-metric-md", lg: "text-metric-lg", xl: "text-metric-xl", hero: "text-metric-hero",
};
// Unité ≈ 40 % de la valeur : lue en second, elle ne concurrence pas le chiffre.
const UNIT: Record<MetricSize, string> = { sm: "text-[11px]", md: "text-xs", lg: "text-sm", xl: "text-base", hero: "text-xl" };
const TONE = { default: "text-ink", brand: "text-brand", good: "text-good", bad: "text-bad", soft: "text-ink-soft" } as const;

type Props = {
  label: string;
  value: React.ReactNode;
  unit?: string;
  size?: MetricSize;
  tone?: keyof typeof TONE;
  hint?: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
};

/**
 * Une mesure : libellé (capitales, gris) au-dessus, valeur en chiffres tabulaires, unité plus petite et plus claire.
 * À placer dans un <dl> (ex. <dl className="grid grid-cols-3 gap-3">).
 */
export function Metric({ label, value, unit, size = "md", tone = "default", hint, align = "start", className }: Props) {
  const justify = align === "center" ? "justify-center" : align === "end" ? "justify-end" : "";
  return (
    <div className={cn("min-w-0", align === "center" && "text-center", align === "end" && "text-right", className)}>
      <dt className="truncate text-label uppercase text-ink-mute">{label}</dt>
      <dd className={cn("mt-1 flex items-baseline gap-1 whitespace-nowrap font-num tabular-nums", justify, VALUE[size], TONE[tone])}>
        <span>{value}</span>
        {unit && <span className={cn("font-sans font-medium tracking-normal text-ink-soft", UNIT[size])}>{unit}</span>}
      </dd>
      {hint && <dd className={cn("mt-1 truncate text-xs text-ink-soft", justify && "w-full")}>{hint}</dd>}
    </div>
  );
}

/** Petit écart chiffré (+12 s/km, −3 bpm…) : vert si c'est mieux, rouge si c'est moins bien. */
export function Delta({ children, good }: { children: React.ReactNode; good: boolean }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-1.5 font-num text-xs font-semibold tabular-nums", good ? "bg-good/15 text-good" : "bg-bad/15 text-bad")}>
      {children}
    </span>
  );
}
