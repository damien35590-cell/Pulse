import { cn } from "@/lib/utils";

/** Bloc de page : petit titre en capitales (discret, laisse la place aux chiffres) + action à droite. */
export function Section({ title, action, children, className, id }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("space-y-3", className)}>
      <header className="flex min-h-6 items-end justify-between gap-3 px-1">
        <h2 className="text-label uppercase text-ink-soft">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
