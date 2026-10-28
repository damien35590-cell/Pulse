import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Sans middleware : la connexion est vérifiée ici pour toutes les pages de l'app.
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  return <AppShell>{children}</AppShell>;
}
