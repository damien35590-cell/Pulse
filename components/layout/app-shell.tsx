import { BottomNav } from "./bottom-nav";

/**
 * Coque mobile : contenu + bottom nav, safe areas gérées.
 * Le haut garde une marge de sécurité pour les pages sans <TopBar> ; <TopBar> l'annule et se colle tout en haut.
 */
export function AppShell({ children, pendingBadges = 0 }: { children: React.ReactNode; pendingBadges?: number }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md pt-safe-top">
      <main className="px-4 pb-[calc(theme(spacing.nav)_+_1.5rem)] pt-4">{children}</main>
      <BottomNav pendingBadges={pendingBadges} />
    </div>
  );
}
