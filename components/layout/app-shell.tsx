import { BottomNav } from "./bottom-nav";

/** Coque mobile : contenu + bottom nav, safe areas gérées. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <main className="px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
