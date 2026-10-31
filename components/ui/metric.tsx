import { cn } from "@/lib/utils";
import { CountUpText, type CountUpMode } from "@/components/ui/count-up";

/** Écart de départ entre deux chiffres animés d'un même écran (calculé ici : un serveur ne peut pas appeler une fonction d'un module client). */
const STAGGER_MS = 70;

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
  /** Le chiffre se pose au montage : de 70 % à 100 % de la valeur, fondu + montée de 6 px (chiffres héros seulement : pas dans les listes ni le fil). Sans effet si `value` n'est pas un nombre ou un texte numérique. */
  animate?: boolean;
  /** « fade » : apparition sans compter. Par défaut « count », sauf unité en « /km » (allures) : « fade ». */
  animateMode?: CountUpMode;
  /** Rang parmi les chiffres animés de l'écran (héros = 0) : chaque rang démarre 70 ms après le précédent. */
  animateIndex?: number;
  /** Identifiant stable (ex. `activity:<id>`) : l'animation ne se joue qu'une fois par session pour lui. */
  animateKey?: string;
};

/**
 * Une mesure : libellé (capitales, gris) au-dessus, valeur en chiffres tabulaires, unité plus petite et plus claire.
 * À placer dans un <dl> (ex. <dl className="grid grid-cols-3 gap-3">).
 */
export function Metric({ label, value, unit, size = "md", tone = "default", hint, align = "start", className, animate, animateMode, animateIndex, animateKey }: Props) {
  const justify = align === "center" ? "justify-center" : align === "end" ? "justify-end" : "";
  return (
    <div className={cn("min-w-0", align === "center" && "text-center", align === "end" && "text-right", className)}>
      <dt className="truncate text-label uppercase text-ink-mute">{label}</dt>
      <dd className={cn("mt-1 flex items-baseline gap-1 whitespace-nowrap font-num tabular-nums", justify, VALUE[size], TONE[tone])}>
        <span>
          {animate && (typeof value === "string" || typeof value === "number")
            ? <CountUpText text={String(value)} mode={animateMode ?? (unit?.endsWith("/km") ? "fade" : "count")} delay={(animateIndex ?? 0) * STAGGER_MS} storageKey={animateKey ? `${animateKey}:${label}` : undefined} />
            : value}
        </span>
        {unit && <span className={cn("font-sans font-medium tracking-normal text-ink-soft", UNIT[size])}>{unit}</span>}
      </dd>
      {hint && <dd className={cn("mt-1 truncate text-xs text-ink-soft", justify && "w-full")}>{hint}</dd>}
    </div>
  );
}

const DELTA = { good: "bg-good/15 text-good", warn: "bg-warn/15 text-warn", bad: "bg-bad/15 text-bad", neutral: "bg-surface-2 text-ink-soft" } as const;

/**
 * Petit écart chiffré (+12 s/km, −3 bpm…) : vert si c'est mieux, rouge si c'est moins bien.
 * `tone` affine : « warn » (à surveiller, sans être une baisse), « neutral » (dans la moyenne).
 */
export function Delta({ children, good, tone }: { children: React.ReactNode; good?: boolean; tone?: keyof typeof DELTA }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-1.5 font-num text-xs font-semibold tabular-nums", DELTA[tone ?? (good ? "good" : "bad")])}>
      {children}
    </span>
  );
}
