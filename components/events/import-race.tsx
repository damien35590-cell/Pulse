"use client";
import { useEffect, useState, useTransition } from "react";
import { Link2, X, Check } from "lucide-react";
import { previewRaceImport, saveImportedRace } from "@/app/actions";
import { RaceFields, field, toForm, formToDraft, type Form } from "./race-form";
import type { RaceDraft } from "@/types/race";

const fmtDate = (d?: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "date inconnue");
const eur = (c?: number) => (c === undefined ? "" : `${(c / 100).toFixed(2).replace(".", ",")} €`);


export function ImportRace({ label = "Importer depuis un lien", primary = false, autoOpen = false }: { label?: string; primary?: boolean; autoOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"url" | "pick" | "form">("url");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [races, setRaces] = useState<RaceDraft[]>([]);
  const [base, setBase] = useState<RaceDraft | null>(null);
  const [f, setF] = useState<Form>(toForm({ url: "" }));
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Arrivée depuis « Ajoute ta prochaine course » (/events?import=1) : la fenêtre s'ouvre d'elle-même.
  useEffect(() => { if (autoOpen) setOpen(true); }, [autoOpen]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  const reset = () => { setStep("url"); setUrl(""); setError(null); setRaces([]); setBase(null); setF(toForm({ url: "" })); };
  const openModal = () => { reset(); setOpen(true); };
  const choose = (d: RaceDraft) => { setBase(d); setF(toForm(d)); setStep("form"); };
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const fetchRaces = () => {
    setError(null);
    start(async () => {
      const link = url.trim();
      const r = await previewRaceImport(link);
      if (!r.ok) {
        // Échec : formulaire vide, lien conservé, saisie à la main.
        setError(`${r.error} Vous pouvez saisir la course à la main.`);
        setBase({ url: link, platform: "OTHER" }); setF(toForm({ url: link })); setStep("form");
      } else if (r.races.length === 1) choose(r.races[0]);
      else { setRaces(r.races); setStep("pick"); }
    });
  };

  const save = () => {
    setError(null);
    const draft = formToDraft(f, { url: base?.url || url.trim(), platform: base?.platform });
    start(async () => {
      const r = await saveImportedRace(draft);
      if (!r.ok) { setError(r.error); return; }
      setOpen(false);
      setToast(r.updated ? "Course mise à jour." : "Course enregistrée.");
    });
  };

  return (
    <>
      <button onClick={openModal} className={primary ? "flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand font-display text-lg font-semibold text-brand-ink" : "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface font-semibold text-brand"}>
        <Link2 className="h-5 w-5" aria-hidden /> {label}
      </button>

      {toast && <div role="status" className="fixed inset-x-4 bottom-24 z-[60] mx-auto flex max-w-sm items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-bg shadow-lg"><Check className="h-4 w-4 text-brand" aria-hidden />{toast}</div>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Importer une course" className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-line bg-bg sm:rounded-3xl">
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 className="font-display text-xl font-bold">{step === "url" ? "Importer une course" : step === "pick" ? "Choisissez votre épreuve" : "Vérifiez et enregistrez"}</h2>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center text-ink-soft"><X className="h-5 w-5" /></button>
            </div>

            <div className="overflow-y-auto px-5 pb-5">
              {error && <p role="alert" className="mb-3 rounded-xl border border-brand/40 bg-surface p-3 text-sm text-ink">{error}</p>}

              {step === "url" && (
                <div className="space-y-3">
                  <label className="block text-sm text-ink-soft">Lien NextRun, Klikego ou autre
                    <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoFocus placeholder="https://nextrun.fr/events/…" className={field} />
                  </label>
                  <button onClick={fetchRaces} disabled={pending || !url.trim()} className="min-h-14 w-full rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink disabled:opacity-50">{pending ? "Récupération…" : "Récupérer"}</button>
                  <button onClick={() => { setBase({ url: url.trim(), platform: "OTHER" }); setF(toForm({ url: url.trim() })); setStep("form"); }} className="min-h-11 w-full text-sm text-ink-soft">Saisir à la main</button>
                </div>
              )}

              {step === "pick" && (
                <ul className="space-y-2.5">
                  {races.map((r) => (
                    <li key={r.url}>
                      <button onClick={() => choose(r)} className="w-full rounded-xl border border-line bg-surface p-4 text-left active:border-brand">
                        <p className="font-bold">{r.name}</p>
                        <p className="text-sm text-ink-soft">{fmtDate(r.date)}{r.startTime ? ` à ${r.startTime}` : ""}{r.targetDistance ? `, ${String(r.targetDistance).replace(".", ",")} km` : ""}{r.priceCents !== undefined ? `, ${eur(r.priceCents)}` : ""}</p>
                      </button>
                    </li>
                  ))}
                  <li><button onClick={() => setStep("url")} className="min-h-11 w-full text-sm text-ink-soft">‹ Changer de lien</button></li>
                </ul>
              )}

              {step === "form" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">
                  <RaceFields f={f} set={set} dateCheck={base?.needsDateCheck} />
                  </div>
                  <button onClick={save} disabled={pending || !f.name.trim() || !f.date} className="min-h-14 w-full rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink disabled:opacity-50">{pending ? "Enregistrement…" : "Enregistrer"}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
