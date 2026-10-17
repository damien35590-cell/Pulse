"use client";
import { useRef, useState } from "react";
import { Check, Frown, Laugh, Meh, Smile, Zap, type LucideIcon } from "lucide-react";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { RpePicker } from "./rpe-picker";

// Même libellés que l'écran d'enregistrement ; couleurs alignées sur les zones.
const FEELS: { v: number; Icon: LucideIcon; label: string; color: string }[] = [
  { v: 1, Icon: Laugh, label: "Super", color: "#22C55E" },
  { v: 2, Icon: Smile, label: "Bien", color: "#84CC16" },
  { v: 3, Icon: Meh, label: "Correct", color: "#EAB308" },
  { v: 4, Icon: Frown, label: "Fatigué", color: "#F97316" },
  { v: 5, Icon: Zap, label: "Difficile", color: "#EF4444" },
];

type Props = {
  activityId: string;
  initialFeel: number | null;
  initialComment: string | null;
  initialRpe?: number | null;
};

export function FeelNote({ activityId, initialFeel, initialComment, initialRpe = null }: Props) {
  const [feel, setFeel] = useState(initialFeel);
  const [comment, setComment] = useState(initialComment ?? "");
  const [rpe, setRpe] = useState(initialRpe);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  async function save(body: { feel?: number | null; comment?: string | null; rpe?: number | null }) {
    setStatus("saving");
    try {
      const r = await fetch(`/api/activities/${activityId}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setStatus(r.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  function pickFeel(v: number) {
    const next = feel === v ? null : v;
    tap(10);
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

  const current = feel ? FEELS[feel - 1] : null;

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold">Ressenti</h2>
        <span aria-live="polite" className="inline-flex items-center gap-1 text-xs text-ink-soft">
          {status === "saving" && "Enregistrement…"}
          {status === "saved" && <><Check className="h-3.5 w-3.5" aria-hidden />Enregistré</>}
          {status === "error" && <span className="text-brand">Échec de l’enregistrement</span>}
        </span>
      </div>

      <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm text-ink-soft">
          {current ? (
            <>Séance ressentie <span className="font-display text-xl font-bold" style={{ color: current.color }}>{current.label.toLowerCase()}</span></>
          ) : (
            "Comment s’est passée la séance ?"
          )}
        </p>

        <div role="radiogroup" aria-label="Ressenti" className="grid grid-cols-5 gap-1.5">
          {FEELS.map(({ v, Icon, label, color }) => {
            const active = feel === v;
            const filled = feel != null && v <= feel;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pickFeel(v)}
                className={cn(
                  "group flex min-h-16 flex-col items-center gap-1.5 rounded-lg pt-2 transition active:scale-95",
                  active ? "bg-surface-2" : "hover:bg-surface-2/60"
                )}
              >
                <Icon
                  className={cn("h-6 w-6 transition", !active && "text-ink-soft opacity-60 group-hover:opacity-100")}
                  style={active ? { color } : undefined}
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden
                />
                <span className={cn("text-xs", active ? "font-bold text-ink" : "text-ink-soft")}>{label}</span>
                <span
                  className="h-1.5 w-full rounded-full bg-surface-2 transition-colors"
                  style={filled ? { backgroundColor: color } : undefined}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>

        <RpePicker value={rpe} onChange={pickRpe} />

        <textarea
          value={comment}
          onChange={(e) => onComment(e.target.value)}
          placeholder="Notes sur la séance : jambes, météo, sensations…"
          rows={3}
          aria-label="Notes sur la séance"
          className="w-full resize-none rounded-xl border border-line bg-bg p-3 text-base placeholder:text-ink-soft/70 focus:border-brand focus:outline-none"
        />
      </div>
    </section>
  );
}
