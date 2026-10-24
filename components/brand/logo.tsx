import { cn } from "@/lib/utils";

/** Marque Pulse : battement de cœur Volt sur fond noir. Même tracé que assets/brand/pulse-mark.svg. */
export function PulseMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} role="img" aria-label="Pulse" className={cn("shrink-0 rounded-[22.5%] bg-bg", className)}>
      <path d="M96 272H184L220 184L268 352L308 152L340 272H416" fill="none" className="stroke-brand" strokeWidth={40} strokeLinecap="round" strokeLinejoin="round" />
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
