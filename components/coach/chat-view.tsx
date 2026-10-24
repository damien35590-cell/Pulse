"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, ChevronLeft, Loader2, Sparkles, SquarePen } from "lucide-react";
import { sendCoachMessage, type ChatMsg } from "@/app/(app)/coach/actions";
import { renderCoachText } from "@/lib/coach/chat-render";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";

const SUGGESTIONS = ["Que faire demain ?", "Je suis fatigué, j'adapte comment ma semaine ?", "Où j'en suis pour mon objectif course ?", "Pourquoi je bloque à mes exercices ?"];

function Bubble({ m }: { m: ChatMsg }) {
  if (m.role === "user") return <div className="ml-10 self-end whitespace-pre-line rounded-card rounded-br-md bg-brand px-4 py-2.5 text-brand-ink">{m.content}</div>;
  const blocks = renderCoachText(m.content);
  return (
    <div className="mr-6 space-y-2 self-start rounded-card rounded-bl-md bg-surface px-4 py-3 text-ink shadow-card">
      {blocks.map((b, i) => {
        const inner = b.parts.map((p, j) => (p.bold ? <strong key={j} className="font-semibold">{p.text}</strong> : <span key={j}>{p.text}</span>));
        return b.kind === "li"
          ? <p key={i} className="flex gap-2 text-base leading-relaxed"><span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink-mute" /><span>{inner}</span></p>
          : <p key={i} className="text-base leading-relaxed">{inner}</p>;
      })}
    </div>
  );
}

/** Écran de chat plein écran (au-dessus de la barre du bas) : fil des messages, suggestions, saisie dans la zone du pouce. */
export function ChatView({ chatId: initialId, initial, configured }: { chatId: string | null; initial: ChatMsg[]; configured: boolean }) {
  const [chatId, setChatId] = useState(initialId), [msgs, setMsgs] = useState(initial), [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null), [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: msgs.length > initial.length ? "smooth" : "auto" }); }, [msgs, pending, initial.length]);
  // Zone de saisie qui grandit avec le texte (5 lignes au plus)
  useEffect(() => { const t = input.current; if (t) { t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, 132)}px`; } }, [draft]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || pending || !configured) return;
    tap(8); setError(null); setDraft("");
    const temp: ChatMsg = { id: `tmp-${Date.now()}`, role: "user", content: q };
    setMsgs((l) => [...l, temp]);
    start(async () => {
      const r = await sendCoachMessage({ chatId, text: q });
      if (r.ok) { setChatId(r.chatId); setMsgs((l) => [...l.filter((m) => m.id !== temp.id), r.userMsg, r.reply]); }
      else { setError(r.error); setMsgs((l) => l.filter((m) => m.id !== temp.id)); setDraft(q); }
    });
  };
  const fresh = () => { tap(6); setChatId(null); setMsgs([]); setError(null); input.current?.focus(); };

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-bg">
      <header className="flex items-center gap-1 border-b border-line/70 px-2 pb-1 pt-[calc(env(safe-area-inset-top)_+_0.25rem)]">
        <Link href="/analysis" aria-label="Retour à l'analyse" className={ui.iconBtn}><ChevronLeft className="size-6" aria-hidden /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">Coach</h1>
          <p className="truncate text-xs text-ink-mute">Lafay · SuperPhysique · Campus Coach</p>
        </div>
        {msgs.length > 0 && <button type="button" onClick={fresh} disabled={pending} aria-label="Nouvelle conversation" className={cn(ui.iconBtn, "disabled:opacity-40")}><SquarePen className="size-5" aria-hidden /></button>}
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {msgs.length === 0 ? (
          <div className="flex min-h-full flex-col justify-end gap-4">
            <div className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand/15 text-brand"><Sparkles className="size-7" aria-hidden /></span>
              <p className="mt-3 font-semibold">Pose ta question au coach</p>
              <p className="mt-1 text-sm text-ink-soft">Il connaît tes 12 dernières semaines, tes programmes et tes séances prévues.</p>
            </div>
            <div className="grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} disabled={pending || !configured} className={cn(ui.pressCard, "min-h-12 rounded-tile bg-surface px-4 py-3 text-left text-sm font-medium shadow-card disabled:opacity-40")}>{s}</button>
              ))}
            </div>
            {!configured && <p className="text-center text-xs text-ink-mute">Pour l'activer : ajoute la clé ANTHROPIC_API_KEY dans Vercel, puis redéploie.</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {msgs.map((m) => <Bubble key={m.id} m={m} />)}
            {pending && <div className="mr-6 flex items-center gap-2 self-start rounded-card rounded-bl-md bg-surface px-4 py-3 text-sm text-ink-soft shadow-card"><Loader2 className="size-4 animate-spin" aria-hidden />Le coach réfléchit…</div>}
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-center text-sm text-bad">{error}</p>}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex items-end gap-2 border-t border-line/70 bg-bg px-3 pb-[calc(env(safe-area-inset-bottom)_+_0.5rem)] pt-2">
        <textarea
          ref={input} rows={1} value={draft} maxLength={1000} enterKeyHint="send" placeholder="Ta question…" aria-label="Ta question au coach" disabled={!configured}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }}
          className="min-h-12 flex-1 resize-none rounded-tile bg-surface px-4 py-3 text-base text-ink shadow-card outline-none placeholder:text-ink-mute focus-visible:ring-2 focus-visible:ring-brand/40"
        />
        <button type="submit" disabled={pending || !draft.trim() || !configured} aria-label="Envoyer" className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-brand-ink transition active:scale-90 disabled:opacity-40">
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ArrowUp className="size-5" strokeWidth={2.5} aria-hidden />}
        </button>
      </form>
    </div>
  );
}
