import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // TODO (étape Auth) : getServerSession() → redirect("/login") si absent
  return <AppShell>{children}</AppShell>;
}
