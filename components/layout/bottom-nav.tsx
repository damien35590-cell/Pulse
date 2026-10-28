"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, CalendarDays, Home, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";
import { PlusSheet } from "@/components/record/plus-sheet";
import { PulseLine } from "@/components/ui/icons/pulse-line";

// « Vous » n'est pas un onglet : il s'ouvre depuis l'avatar de l'accueil (qui porte aussi les badges à valider).
const items = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/plan", label: "Programme", icon: CalendarDays },
  { href: "/record", label: "Ajouter", icon: Plus, record: true }, // ouvre la feuille « + » (PlusSheet)
  { href: "/activities", label: "Activités", icon: PulseLine },
  { href: "/analysis", label: "Analyse", icon: BarChart3 },
] as const;

/** Barre du bas façon Material You : pastille derrière l'icône active, fond translucide, safe area du Pixel incluse. */
export function BottomNav() {
  const pathname = usePathname();
  const [plus, setPlus] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 select-none border-t border-line/70 bg-bg/80 pb-safe-bottom backdrop-blur-xl backdrop-saturate-150"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
          {items.map((item) => {
            const { href, label, icon: Icon } = item, active = isActive(href), record = "record" in item;
            if (record) return (
              <li key={href}>
                <button
                  type="button"
                  onPointerDown={() => tap(12)}
                  onClick={() => setPlus(true)}
                  aria-label={label}
                  aria-haspopup="dialog"
                  className="group flex h-full w-full touch-manipulation flex-col items-center justify-center"
                >
                  <span className="grid size-12 place-items-center rounded-2xl bg-brand text-brand-ink shadow-glow transition-transform duration-150 ease-snappy group-active:scale-90">
                    <Icon className="size-7" strokeWidth={2.5} aria-hidden />
                  </span>
                </button>
              </li>
            );
            return (
              <li key={href}>
                <Link
                  href={href}
                  prefetch={true}
                  onPointerDown={() => tap(6)}
                  aria-current={active ? "page" : undefined}
                  className="group flex h-full touch-manipulation flex-col items-center justify-center gap-1"
                >
                  <span
                    className={cn(
                      "grid h-8 w-14 place-items-center rounded-full transition-colors duration-200",
                      active ? "bg-brand/15 text-brand" : "text-ink-mute group-active:bg-surface-2",
                    )}
                  >
                    <Icon className="size-[22px] transition-transform duration-150 group-active:scale-90" strokeWidth={active ? 2.4 : 2} aria-hidden />
                  </span>
                  <span className={cn("text-[11px] leading-none", active ? "font-semibold text-ink" : "font-medium text-ink-mute")}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <PlusSheet open={plus} onClose={() => setPlus(false)} />
    </>
  );
}
