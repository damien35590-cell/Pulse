import Link from "next/link";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";

type Props = {
  program: string;
  title: string;
  exercises: string[];
  sets: number;
  estMin: number;
  /** Lien (page réelle) ou action (démo). */
  href?: string;
  onStart?: () => void;
};

/** Carte « Aujourd'hui » : LA séance du jour en tête d'accueil, avec un seul bouton. Rien à chercher avant de s'entraîner. */
export function TodayCard({ program, title, exercises, sets, estMin, href, onStart }: Props) {
  const cta = (
    <>
      <Play className="size-5" fill="currentColor" aria-hidden />
      Démarrer la séance
    </>
  );
  return (
    <section aria-label="Séance du jour" className={cn(ui.card, "relative overflow-hidden p-4")}>
      {/* halo discret : la carte la plus importante de l'écran se repère sans cri */}
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-brand/20 blur-3xl" />
      <p className="relative text-label uppercase text-brand">Aujourd’hui · {program}</p>
      <h2 className="relative mt-1.5 text-[28px] font-bold leading-tight tracking-tight">{title}</h2>
      <p className="relative mt-1 font-num text-base tabular-nums text-ink-soft">
        {exercises.length} exercices · {sets} séries · ≈ {estMin} min
      </p>
      <ul className="relative mt-3 flex flex-wrap gap-1.5">
        {exercises.map((e) => <li key={e} className={ui.chip}>{e}</li>)}
      </ul>
      {href ? (
        <Link href={href} className={cn(ui.btnPrimary, "relative mt-5 w-full")}>{cta}</Link>
      ) : (
        <button type="button" onClick={onStart} className={cn(ui.btnPrimary, "relative mt-5 w-full")}>{cta}</button>
      )}
    </section>
  );
}
