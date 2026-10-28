import { cn } from "@/lib/utils";

/** Marque Pulse « live trace » : amorce atténuée, pic Volt, point de fin (position GPS en direct). Même tracé que assets/brand/pulse-mark.svg. */
export function PulseMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} role="img" aria-label="Pulse" className={cn("shrink-0 rounded-[22.5%] bg-bg", className)}>
      <g fill="none" strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" className="stroke-brand">
        <path d="M64 264H149L179 213" strokeOpacity={0.4} />
        <path d="M179 213L222 350L269 154L311 264H363" />
      </g>
      <circle cx={410} cy={264} r={15} fill="none" strokeWidth={30} className="stroke-brand" />
    </svg>
  );
}

/** Marque + mot-symbole « Pulse ». */
export function PulseLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <PulseMark size={size} />
      <span className="font-num font-semibold leading-none text-ink" style={{ fontSize: size * 0.75 }}>Pulse</span>
    </span>
  );
}
