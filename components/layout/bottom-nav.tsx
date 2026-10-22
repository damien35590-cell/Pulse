"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Home, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";

const items = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/activities", label: "Activités", icon: Activity },
  { href: "/record", label: "Enregistrer", icon: Plus, record: true },
  { href: "/analysis", label: "Analyse", icon: BarChart3 },
  { href: "/profile", label: "Vous", icon: User },
] as const;

/** Barre du bas façon Material You : pastille derrière l'icône active, fond translucide, safe area du Pixel incluse. */
export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 select-none border-t border-line/70 bg-bg/80 pb-safe-bottom backdrop-blur-xl backdrop-saturate-150"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map((item) => {
          const { href, label, icon: Icon } = item, active = isActive(href), record = "record" in item;
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch={true}
                onPointerDown={() => tap(record ? 12 : 6)}
                aria-current={active ? "page" : undefined}
                aria-label={record ? label : undefined}
                className="group flex h-full touch-manipulation flex-col items-center justify-center gap-1"
              >
                {record ? (
                  <span className="grid size-12 place-items-center rounded-2xl bg-brand text-brand-ink shadow-glow transition-transform duration-150 ease-snappy group-active:scale-90">
                    <Icon className="size-7" strokeWidth={2.5} aria-hidden />
                  </span>
                ) : (
                  <>
                    <span
                      className={cn(
                        "grid h-8 w-14 place-items-center rounded-full transition-colors duration-200",
                        active ? "bg-brand-soft text-brand" : "text-ink-mute group-active:bg-surface-2",
                      )}
                    >
                      <Icon className="size-[22px] transition-transform duration-150 group-active:scale-90" strokeWidth={active ? 2.4 : 2} aria-hidden />
                    </span>
                    <span className={cn("text-[11px] leading-none", active ? "font-semibold text-ink" : "font-medium text-ink-mute")}>{label}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
