"use client";
import { useEffect, useRef, useState } from "react";
import { Check, MessageCircleQuestion } from "lucide-react";
import { tap } from "@/lib/haptics";
import { sessionRpe } from "@/lib/load";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { Section } from "@/components/ui/section";
import { Metric } from "@/components/ui/metric";
import { RpePicker } from "./rpe-picker";
import { FeelPicker } from "./feel-picker";

/** Ancre de la section, et événement émis quand ressenti + effort sont remplis (la pastille du haut disparaît). */
export const FEEL_ANCHOR = "ressenti";
const FILLED_EVENT = "pulse:feel-filled";

type Props = {
  activityId: string;
  /** Durée en mouvement : charge ressentie = RPE × minutes. */
  movingTimeS: number;
  initialFeel: number | null;
  initialComment: string | null;
  initialRpe?: number | null;
};

/** Ressenti (humeur), effort 1-10 et notes : enregistrement automatique à chaque choix, retour haptique, charge ressentie dès que l'effort est noté. */
export function FeelNote({ activityId, movingTimeS, initialFeel, initialComment, initialRpe = null }: Props) {
  const [feel, setFeel] = useState(initialFeel);
  const [comment, setComment] = useState(initialComment ?? "");
  const [rpe, setRpe] = useState(initialRpe);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const load = sessionRpe(rpe, movingTimeS);

  useEffect(() => { window.dispatchEvent(new CustomEvent(FILLED_EVENT, { detail: feel != null && rpe != null })); }, [feel, rpe]);

  async function save(body: { feel?: number | null; comment?: string | null; rpe?: number | null }) {
    setStatus("saving");
    try {
      const r = await fetch(`/api/activities/${activityId}/note`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setStatus(r.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  function pickFeel(v: number) {
    const next = feel === v ? null : v;
    tap();
    setFeel(next);
    save({ feel: next });
  }

  function pickRpe(v: number | null) {
    setRpe(v);
    save({ rpe: v });
  }

  function onComment(text: string) {
    setComment(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save({ comment: text || null }), 800);
  }

  return (
    <Section
      id={FEEL_ANCHOR}
      title="Ressenti"
      className="scroll-mt-24"
      action={
        <span aria-live="polite" className="inline-flex items-center gap-1 text-xs text-ink-mute">
          {status === "saving" && "Enregistrement…"}
          {status === "saved" && <><Check className="size-3.5 text-good" aria-hidden />Enregistré</>}
          {status === "error" && <span className="text-bad">Échec de l’enregistrement</span>}
        </span>
      }
    >
      <div className={cn(ui.card, "space-y-5 p-4")}>
        <FeelPicker value={feel} onChange={pickFeel} />

        <RpePicker value={rpe} onChange={pickRpe} />

        {load != null && (
          <dl>
            <Metric size="md" label="Charge" value={load} hint="Effort × minutes (sRPE)" />
          </dl>
        )}

        <textarea
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          placeholder="Notes sur la séance : jambes, météo, sensations…"
          rows={3}
          aria-label="Notes sur la séance"
          className="w-full resize-none rounded-tile bg-surface-2 p-3 text-base text-ink placeholder:text-ink-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
        />
      </div>
    </Section>
  );
}

/** Pastille « Comment c'était ? » en tête de fiche, tant que ressenti ou effort manquent ; un appui fait défiler jusqu'à la section. */
export function FeelPrompt({ filled: initial }: { filled: boolean }) {
  const [filled, setFilled] = useState(initial);
  useEffect(() => {
    const on = (e: Event) => setFilled((e as CustomEvent<boolean>).detail);
    window.addEventListener(FILLED_EVENT, on);
    return () => window.removeEventListener(FILLED_EVENT, on);
  }, []);
  if (filled) return null;
  return (
    <button
      type="button"
      onClick={() => { tap(); document.getElementById(FEEL_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
      className={cn(ui.chip, "h-12 px-4 text-sm text-ink active:scale-[0.97] transition duration-150 ease-snappy")}
    >
      <MessageCircleQuestion className="size-4 text-ink-soft" aria-hidden />
      Comment c’était ?
    </button>
  );
}
