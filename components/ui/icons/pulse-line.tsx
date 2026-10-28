import type { LucideProps } from "lucide-react";

/**
 * Trace « live » du logo Pulse (assets/brand/pulse-mark-monochrome.svg) en pictogramme de trait, même API que les icônes lucide :
 * tracé ramené de 512 à 24 unités, point de fin plein dont le rayon suit l'épaisseur du trait (comme sur le logo).
 */
export function PulseLine({ size = 24, strokeWidth = 2, className, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M1.5 12.65h4.6l1.6-2.75 2.33 7.4 2.54-10.6 2.27 5.95h2.8" />
      <circle cx="20.2" cy="12.65" r={Number(strokeWidth)} fill="currentColor" stroke="none" />
    </svg>
  );
}
