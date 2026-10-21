import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { evaluateBadges } from "@/lib/badges";
import { loadBadgeStats } from "@/lib/data/badges";
import { BadgeGrid } from "@/components/profile/badge-grid";
import { level, rank, xpOf } from "@/lib/xp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Badges et niveau" };
const TZ = "Europe/Paris";

export default async function BadgesPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const { acts, stats } = await loadBadgeStats(s.user.id, TZ);
  const badges = evaluateBadges(stats);
  const lvl = level(acts.reduce((t, a) => t + xpOf(a), 0));

  return (
    <div className="space-y-6">
      <header>
        <Link href="/profile" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand"><ChevronLeft className="h-4 w-4" aria-hidden />Vous</Link>
        <h1 className="font-display text-3xl font-bold leading-none">Badges et niveau</h1>
        <p className="mt-1 text-ink-soft">Niveau {lvl.n} · {rank(lvl.n)}</p>
      </header>
      <BadgeGrid badges={badges} />
    </div>
  );
}
