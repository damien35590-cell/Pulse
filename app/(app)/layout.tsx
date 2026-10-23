import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { countPendingBadges } from "@/lib/data/badges";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Sans middleware : la connexion est vérifiée ici pour toutes les pages de l'app.
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login");
  return <AppShell pendingBadges={await countPendingBadges(userId)}>{children}</AppShell>;
}
