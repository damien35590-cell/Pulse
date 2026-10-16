"use client";
import { useState, useRef } from "react";

const FEELS = [
  { v: 1, emoji: "🤩", label: "Super" },
  { v: 2, emoji: "🙂", label: "Bien" },
  { v: 3, emoji: "😐", label: "Normal" },
  { v: 4, emoji: "😕", label: "Difficile" },
  { v: 5, emoji: "🥵", label: "Épuisé" },
];

type Props = {
  activityId: string;
  initialFeel: number | null;
  initialComment: string | null;
};

export function FeelNote({ activityId, initialFeel, initialComment }: Props) {
  const [feel, setFeel] = useState(initialFeel);
  const [comment, setComment] = useState(initialComment ?? "");
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  async function save(body: { feel?: number | null; comment?: string | null }) {
    setSaving(true);
    try {
      await fetch(`/api/activities/${activityId}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      setSaving(false);
    }
  }

  function pickFeel(v: number) {
    const next = feel === v ? null : v;
    setFeel(next);
    save({ feel: next });
    navigator.vibrate?.(10);
  }

  function onComment(text: string) {
    setComment(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save({ comment: text || null }), 800);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ressenti</h3>
        <span className="text-xs text-muted-foreground">
          {saving ? "Enregistrement…" : feel ? FEELS[feel - 1].label : ""}
        </span>
      </div>

      <div className="flex justify-between gap-2">
        {FEELS.map(({ v, emoji, label }) => (
          <button
            key={v}
            onClick={() => pickFeel(v)}
            aria-label={label}
            aria-pressed={feel === v}
            className={`flex-1 rounded-xl py-3 text-2xl transition active:scale-90 ${
              feel === v
                ? "bg-orange-500/15 ring-2 ring-orange-500 scale-105"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => onComment(e.target.value)}
        placeholder="Notes sur la séance : jambes, météo, sensations…"
        rows={3}
        className="w-full resize-none rounded-xl border bg-background p-3 text-sm"
      />
    </section>
  );
}