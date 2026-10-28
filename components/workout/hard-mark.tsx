import { Fragment } from "react";
import { cn } from "@/lib/utils";

/** Repère discret d'une série marquée « Dur » au SetLogger : petit point `warn` en exposant. */
export function HardMark({ className }: { className?: string }) {
  return (
    <span className={cn("ml-0.5 inline-block size-1.5 -translate-y-1.5 rounded-full bg-warn align-middle", className)} role="img" aria-label="dure" title="Série dure" />
  );
}

/** Séries jointes par « · », chacune suivie du repère « Dur » si besoin ; `suffix` (« à 60 kg ») à la fin. */
export function SetsLine({ items, suffix }: { items: { text: string; hard?: boolean }[]; suffix?: string }) {
  return (
    <>
      {items.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && " · "}
          {s.text}
          {s.hard && <HardMark />}
        </Fragment>
      ))}
      {suffix}
    </>
  );
}
