"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Dumbbell, Library, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { BottomSheet, ConfirmSheet } from "@/components/ui/bottom-sheet";
import { Segmented } from "@/components/ui/segmented";
import { copyTemplate, removeTemplate, startOptions } from "@/app/(app)/record/session/actions";
import { LibrarySheet } from "@/components/workout/library-sheet";
import { KIND_TITLE } from "@/lib/workout/kind";
import type { RecentSession, StartOptions, TemplateItem } from "@/lib/workout/types";

type Filter = "ALL" | "HAUT" | "BAS";
const SESSION = "/record/session";
const dateTxt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" });
const sessionTitle = (s: RecentSession) => (s.kind === "LIBRE" ? s.title : KIND_TITLE[s.kind]);
const row = "flex min-h-14 w-full items-center gap-3 rounded-tile bg-surface px-4 py-2 text-left select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.985] active:bg-surface-3";

/** Bouton « Nouvelle séance » + sa feuille (page Enregistrer). */
export function NewSessionButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => { tap(12); setOpen(true); }} className={cn(ui.btnPrimary, "w-full", className)}>
        <Dumbbell className="size-5" aria-hidden />Nouvelle séance
      </button>
      <NewSessionSheet open={open} onClose={() => setOpen(false)} onNavigate={() => setOpen(false)} />
    </>
  );
}

/**
 * Démarrer une séance sans retaper les exercices : la suggestion du jour en avant, puis refaire une séance, un modèle, ou partir d'une séance vide.
 * Toutes les voies mènent à /record/session, qui construit le brouillon côté serveur.
 * `onNavigate` : appelé en partant vers la séance, pour fermer la feuille quand son parent survit à la navigation (feuille du « + ») ;
 * sinon elle restait ouverte par-dessus l'écran de préparation.
 */
export function NewSessionSheet({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate?: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<StartOptions | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [drop, setDrop] = useState<TemplateItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setFailed(false);
    setNotice("");
    startOptions().then(setData).catch(() => setFailed(true));
  }, [open]);

  const go = (query: string) => {
    if (busy) return;
    tap(12);
    setBusy(true);
    router.push(`${SESSION}${query}`);
    onNavigate?.();
  };

  const refresh = () => startOptions().then(setData).catch(() => {});
  async function duplicate(t: TemplateItem) {
    tap(8);
    const r = await copyTemplate(t.id).catch(() => ({ ok: false as const, error: "Impossible de dupliquer ce modèle : réessaie." }));
    setNotice(r.ok ? `Copie créée : « ${r.name} ».` : r.error);
    if (r.ok) refresh();
  }

  const sug = data?.suggestion;
  const recent = (data?.recent ?? []).filter((r) => filter === "ALL" || r.kind === filter).slice(0, 10);

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Nouvelle séance">
        {failed && !data && <p role="alert" className="mt-4 text-sm text-bad">Impossible de charger tes séances. Vérifie ta connexion et rouvre cette feuille.</p>}
        {!data && !failed && <p className="mt-4 text-sm text-ink-mute" role="status">Chargement…</p>}

        {sug && (
          <section aria-label="Suggestion du jour" className="mt-4 rounded-card bg-brand p-4 text-brand-ink">
            <p className="text-label uppercase opacity-70">Suggestion du jour</p>
            <p className="mt-1 text-metric-lg font-num">{sug.title}</p>
            <p className="mt-2 text-sm font-medium">{sug.draft.exercises.map((e) => e.name).join(" · ")}</p>
            <p className="mt-1 text-sm opacity-70">{sug.reason}</p>
            <button type="button" disabled={busy} onClick={() => go("?suggest=1&go=1")} className="mt-4 inline-flex h-14 w-full touch-manipulation items-center justify-center rounded-full bg-brand-ink text-base font-semibold text-brand transition duration-150 ease-snappy active:scale-[0.97] disabled:opacity-40">
              Démarrer
            </button>
            <button type="button" disabled={busy} onClick={() => go("?suggest=1")} className="mt-1 h-12 w-full touch-manipulation rounded-full text-sm font-semibold transition active:bg-brand-ink/10">
              Ajuster avant de démarrer
            </button>
          </section>
        )}

        {data && (
          <>
            <section aria-label="Refaire une séance" className="mt-6">
              <h3 className={ui.label}>Refaire une séance</h3>
              <Segmented<Filter> className="mt-2" value={filter} onChange={setFilter} options={[{ value: "ALL", label: "Tous" }, { value: "HAUT", label: "Haut" }, { value: "BAS", label: "Bas" }]} />
              {recent.length === 0 ? (
                <p className="mt-3 text-sm text-ink-mute">Aucune séance {filter === "ALL" ? "enregistrée" : "de ce type"} pour l’instant.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <button type="button" disabled={busy} onClick={() => go(`?from=${r.id}`)} className={row}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{sessionTitle(r)}</span>
                          <span className="block text-sm text-ink-mute">{dateTxt(r.date)}</span>
                        </span>
                        <span className="shrink-0 font-num text-metric-sm tabular-nums">{r.totalReps}<span className="ml-1 text-xs font-medium text-ink-soft">reps</span></span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Modèles" className="mt-6">
              <h3 className={ui.label}>Modèles</h3>
              <ul className="mt-2 space-y-2">
                {data.templates.map((t) => (
                  <li key={t.id} className="flex items-center gap-1">
                    <button type="button" disabled={busy} onClick={() => go(`?template=${t.id}`)} className={row}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{t.name}</span>
                        <span className="block text-sm text-ink-mute">{t.exercises} exercice{t.exercises > 1 ? "s" : ""}{t.isBuiltIn ? " · intégré" : ""}</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => duplicate(t)} aria-label={`Dupliquer le modèle ${t.name}`} className={cn(ui.iconBtn, "text-ink-soft")}>
                      <Copy className="size-5" aria-hidden />
                    </button>
                    {!t.isBuiltIn && (
                      <button type="button" onClick={() => { tap(6); setDrop(t); }} aria-label={`Supprimer le modèle ${t.name}`} className={cn(ui.iconBtn, "text-ink-soft")}>
                        <Trash2 className="size-5" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {notice && <p role="status" className="mt-2 text-sm text-ink-soft">{notice}</p>}
              <button type="button" onClick={() => { tap(6); setLibrary(true); }} className={cn(ui.btnSecondary, "mt-3 w-full")}>
                <Library className="size-5" aria-hidden />Bibliothèque de modèles
              </button>
            </section>
          </>
        )}

        <button type="button" disabled={busy} onClick={() => go("?empty=1")} className="mx-auto mt-6 block h-12 touch-manipulation rounded-full px-5 text-sm font-semibold text-ink-mute transition active:bg-surface-3 active:text-ink">
          Séance vide
        </button>
      </BottomSheet>

      <LibrarySheet
        open={library}
        onClose={() => setLibrary(false)}
        onAdded={(names) => { setLibrary(false); setNotice(names.length > 1 ? `${names.length} modèles ajoutés : ${names.join(", ")}.` : `Modèle ajouté : « ${names[0]} ».`); refresh(); }}
      />

      <ConfirmSheet
        open={drop != null}
        onClose={() => setDrop(null)}
        onConfirm={() => {
          const t = drop;
          if (!t) return;
          setData((d) => d && { ...d, templates: d.templates.filter((x) => x.id !== t.id) });
          removeTemplate(t.id).catch(() => startOptions().then(setData).catch(() => {}));
        }}
        title="Supprimer ce modèle ?"
        message={drop ? `« ${drop.name} » sera supprimé. Les séances déjà faites ne changent pas.` : undefined}
        confirmLabel="Supprimer"
        destructive
      />
    </>
  );
}
