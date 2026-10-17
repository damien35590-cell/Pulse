import { SPORTS, MY_SPORTS } from "@/lib/sports";
import type { RaceDraft } from "@/types/race";

export const field = "mt-1 min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink";
const num = (s: string) => { const n = parseFloat(s.replace(",", ".")); return Number.isFinite(n) ? n : undefined; };

/** "1:05:30" | "45:00" | "1h05" → secondes */
export function parseGoal(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const parts = t.replace(/h/i, ":").split(":").map((p) => parseInt(p, 10));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return undefined;
  const sec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 3600 + parts[1] * 60 : parts[0] * 60;
  return sec > 0 ? sec : undefined;
}
export const goalToText = (s?: number) => (s ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : "");

export type Form = { name: string; eventName: string; date: string; startTime: string; location: string; sport: string; distance: string; elevation: string; price: string; doc: string; goal: string; bib: string; notes: string };

export const toForm = (d: RaceDraft): Form => ({
  name: d.name ?? "", eventName: d.eventName ?? "", date: d.date ?? "", startTime: d.startTime ?? "", location: d.location ?? "", sport: d.sport ?? "RUN",
  distance: d.targetDistance !== undefined ? String(d.targetDistance).replace(".", ",") : "", elevation: d.targetElevation !== undefined ? String(d.targetElevation) : "",
  price: d.priceCents !== undefined ? (d.priceCents / 100).toFixed(2).replace(".", ",") : "", doc: d.requiredDocument ?? "", goal: goalToText(d.goalTimeS), bib: d.bibNumber ?? "", notes: d.notes ?? "",
});

export const formToDraft = (f: Form, base: Pick<RaceDraft, "url" | "platform">): RaceDraft => ({
  url: base.url, platform: base.platform ?? "OTHER",
  name: f.name, eventName: f.eventName || undefined, date: f.date, startTime: f.startTime || undefined, location: f.location || undefined,
  sport: f.sport as RaceDraft["sport"], targetDistance: num(f.distance), targetElevation: num(f.elevation),
  priceCents: num(f.price) !== undefined ? Math.round(num(f.price)! * 100) : undefined,
  requiredDocument: f.doc || undefined, goalTimeS: parseGoal(f.goal), bibNumber: f.bib || undefined, notes: f.notes || undefined,
});

/** Champs communs à l'import et à la modification d'une échéance. */
export function RaceFields({ f, set, dateCheck }: { f: Form; set: (k: keyof Form) => (e: { target: { value: string } }) => void; dateCheck?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">
      <label className="col-span-2">Épreuve<input value={f.name} onChange={set("name")} required className={field} /></label>
      <label className="col-span-2">Événement<input value={f.eventName} onChange={set("eventName")} className={field} placeholder="Facultatif" /></label>
      {dateCheck && <p role="note" className="col-span-2 rounded-xl border border-brand bg-brand/10 px-3 py-2 font-semibold text-brand">Vérifie la date et l’heure sur la page Klikego.</p>}
      <label>Date<input type="date" value={f.date} onChange={set("date")} required className={field} /></label>
      <label>Heure<input type="time" value={f.startTime} onChange={set("startTime")} className={field} /></label>
      <label className="col-span-2">Lieu<input value={f.location} onChange={set("location")} className={field} /></label>
      <label>Sport<select value={f.sport} onChange={set("sport")} className={field}>{MY_SPORTS.map((k) => <option key={k} value={k}>{SPORTS[k].label}</option>)}</select></label>
      <label>Distance (km)<input value={f.distance} onChange={set("distance")} inputMode="decimal" className={field} /></label>
      <label>Dénivelé + (m)<input value={f.elevation} onChange={set("elevation")} inputMode="numeric" className={field} /></label>
      <label>Prix (€)<input value={f.price} onChange={set("price")} inputMode="decimal" className={field} /></label>
      <label className="col-span-2">Document requis<input value={f.doc} onChange={set("doc")} className={field} placeholder="Ex. Licence FFA ou PPS" /></label>
      <label>Objectif (h:mm:ss)<input value={f.goal} onChange={set("goal")} inputMode="numeric" className={field} placeholder="1:15:00" /></label>
      <label>N° de dossard<input value={f.bib} onChange={set("bib")} className={field} /></label>
      <label className="col-span-2">Notes<textarea value={f.notes} onChange={set("notes")} rows={2} className={`${field} py-2`} /></label>
    </div>
  );
}
