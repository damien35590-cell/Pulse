import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Section } from "@/components/ui/section";
import { CoachNotes } from "@/components/analysis/coach-notes";
import { AiDebrief } from "@/components/analysis/ai-debrief";
import type { CoachNote } from "@/lib/analytics/coach-notes";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";

type Ai = Parameters<typeof AiDebrief>[0];

/** Bloc « Coach » de la page Analyse : 3 commentaires au plus (les plus importants), puis l'analyse IA et la question au coach, dans une seule carte. */
export function CoachCard({ notes, ai }: { notes: CoachNote[]; /** Absent : pas d'analyse IA pour ce sport. */ ai?: Ai | null }) {
  return (
    <Section title="Coach">
      <div className={cn(ui.card, "p-4")}>
        <CoachNotes notes={notes} className={ai ? "mb-4 border-b border-surface-2 pb-1" : undefined} />
        {ai && <AiDebrief {...ai} />}
        {!notes.length && !ai && <p className="text-sm text-ink-soft">Rien à signaler sur cette période.</p>}
        <Link href="/coach" className="-mb-2 mt-2 flex min-h-12 items-center gap-2 text-sm font-semibold text-brand active:opacity-60">
          <MessageCircle className="size-4" aria-hidden />Poser une question au coach
        </Link>
      </div>
    </Section>
  );
}
