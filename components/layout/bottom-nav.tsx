"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Activity, BarChart3, User, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";

const items = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/activities", label: "Activités", icon: Activity },
  { href: "/record", label: "Enregistrer", icon: Circle, record: true },
  { href: "/analysis", label: "Analyse", icon: BarChart3 },
  { href: "/profile", label: "Vous", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {items.map((item) => {
          const { href, label, icon: Icon } = item, active = isActive(href), record = "record" in item;
          return (
            <li key={href} className="flex justify-center">
              <Link
                href={href}
                prefetch={true}
                onPointerDown={() => tap(6)}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className="flex min-h-14 min-w-14 flex-col items-center justify-center gap-0.5"
              >
                {record ? (
                  <span className="grid h-14 w-14 -translate-y-2.5 place-items-center rounded-full bg-brand text-brand-ink shadow-md ring-4 ring-surface transition-transform active:scale-95">
                    <Icon className="h-6 w-6" fill="currentColor" aria-hidden />
                  </span>
                ) : (
                  <>
                    <Icon className={cn("h-6 w-6", active ? "text-brand" : "text-ink-soft")} strokeWidth={active ? 2.6 : 2} aria-hidden />
                    <span className={cn("text-[11px] leading-none", active ? "font-semibold text-brand" : "font-medium text-ink-soft")}>{label}</span>
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