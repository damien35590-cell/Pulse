import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Star } from "lucide-react";
import { auth } from "@/lib/auth";
import { getGear, type GearUsage } from "@/lib/data/gear";
import { GEAR_KINDS, GEAR_SPORTS } from "@/lib/gear";
import { SPORTS } from "@/lib/sports";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addGear, deleteGear, replaceGear, retireGear, setDefaultGear, updateGear } from "@/app/actions";
import { WearGauge, LEVEL_STYLE } from "@/components/gear/wear-gauge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Équipement" };
const sel = "mt-1 min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base";
const btn = "min-h-11 rounded-lg px-3 text-sm font-semibold";
const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

function Manage({ g }: { g: GearUsage }) {
  const part = g.parentId != null;
  return (
    <details className="mt-2 text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand">Gérer</summary>
      <form action={updateGear.bind(null, g.id)} className="mt-2 grid grid-cols-2 gap-3 text-ink-soft">
        <label className="col-span-2">Nom<input name="name" defaultValue={g.name} className={sel} /></label>
        <label>Km avant suivi<input name="startKm" inputMode="decimal" defaultValue={g.startKm || ""} placeholder="0" className={sel} /></label>
        <label>Seuil critique (km)<input name="limitKm" inputMode="decimal" defaultValue={g.limitKm ?? ""} placeholder="Aucun" className={sel} /></label>
        <button className={cn(btn, "col-span-2 bg-surface-2 text-ink")}>Enregistrer</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {!part && <form action={setDefaultGear.bind(null, g.id)}><button className={cn(btn, "bg-surface-2")}>{g.isDefault ? "Ne plus affecter d’office" : "Affecter d’office"}</button></form>}
        <form action={replaceGear.bind(null, g.id)}><button className={cn(btn, "bg-brand text-brand-ink")}>{part ? `Nouvelle ${GEAR_KINDS[g.kind].label.toLowerCase()} posée` : "Remplacer par un neuf"}</button></form>
        <form action={retireGear.bind(null, g.id)}><button className={cn(btn, "bg-surface-2")}>Retirer</button></form>
        <form action={deleteGear.bind(null, g.id)}><button className={cn(btn, "text-ink-soft")}>Supprimer</button></form>
      </div>
      <p className="mt-1 text-xs text-ink-soft">Retirer garde l’historique ; supprimer l’efface{part ? "" : ", composants compris"}.</p>
    </details>
  );
}

function Head({ g, small }: { g: GearUsage; small?: boolean }) {
  const K = GEAR_KINDS[g.kind], I = K.icon;
  return (
    <div className="mb-2 flex items-start gap-3">
      <span className={cn("grid shrink-0 place-items-center rounded-lg bg-brand/10 text-brand", small ? "h-8 w-8" : "h-10 w-10")}><I className={small ? "h-4 w-4" : "h-5 w-5"} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-bold", !small && "text-lg")}>{g.name}</p>
        <p className="text-xs text-ink-soft">
          {K.label}{g.parentId ? `, posé le ${fmtDate(g.installedAt)}` : g.sports.length ? ` · ${g.sports.map((s) => SPORTS[s]?.label).join(", ")}` : ""}
          {" · "}{g.count} sortie{g.count > 1 ? "s" : ""}{g.hours >= 1 ? `, ${fmtNum(g.hours, 0)} h` : ""}
        </p>
      </div>
      {g.isDefault && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold"><Star className="h-3 w-3" aria-hidden />Par défaut</span>}
    </div>
  );
}

export default async function GearPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const all = await getGear(s.user.id);
  const active = all.filter((g) => !g.retiredAt), retired = all.filter((g) => g.retiredAt);
  const roots = active.filter((g) => !g.parentId || !active.some((p) => p.id === g.parentId));
  const partsOf = (id: string) => active.filter((g) => g.parentId === id);
  const alerts = active.filter((g) => g.level === "critical");

  return (
    <div className="space-y-5">
      <Link href="/vous" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Vous</Link>
      <h1 className="font-display text-3xl font-bold leading-none">Équipement</h1>

      {alerts.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-600/40 bg-red-600/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          <p className="text-sm"><b>{alerts.length === 1 ? "Un composant a" : `${alerts.length} composants ont`} dépassé son seuil critique</b> : {alerts.map((g) => g.name).join(", ")}. Une fois changé, touchez « Gérer » puis « Remplacer » pour repartir de zéro.</p>
        </div>
      )}

      {roots.length === 0 && <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">Aucun matériel. Ajoutez votre vélo, votre home trainer ou vos chaussures, puis leurs composants (chaîne, cassette) : chaque sortie fera avancer leurs compteurs.</p>}

      <ul className="space-y-3">
        {roots.map((g) => (
          <li key={g.id} className={cn("rounded-xl border bg-surface p-4", g.level === "critical" ? "border-red-600/60" : "border-line")}>
            <Head g={g} />
            <WearGauge km={g.km} limitKm={g.limitKm} level={g.level} name={g.name} />
            {partsOf(g.id).length > 0 && (
              <ul className="mt-3 space-y-3 border-t border-line pt-3">
                {partsOf(g.id).map((p) => (
                  <li key={p.id} className={cn("rounded-lg p-3", p.level === "critical" ? "bg-red-600/10" : "bg-surface-2/60")}>
                    <Head g={p} small />
                    <WearGauge km={p.km} limitKm={p.limitKm} level={p.level} name={p.name} />
                    <Manage g={p} />
                  </li>
                ))}
              </ul>
            )}
            <Manage g={g} />
          </li>
        ))}
      </ul>

      <form action={addGear} className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Ajouter du matériel</h2>
        <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">
          <label className="col-span-2">Nom<input name="name" required className={sel} placeholder="Ex. Genesis, Chaîne Genesis, Speedgoat 5" /></label>
          <label>Type<select name="kind" className={sel} defaultValue="BIKE">{Object.entries(GEAR_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}{v.limitKm ? ` (${fmtNum(v.limitKm, 0)} km)` : ""}</option>)}</select></label>
          <label>Monté sur<select name="parentId" className={sel} defaultValue=""><option value="">Rien (matériel principal)</option>{active.filter((g) => !g.parentId && !GEAR_KINDS[g.kind].part).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label>Km avant suivi<input name="startKm" inputMode="decimal" className={sel} placeholder="0" /></label>
          <label>Seuil critique (km)<input name="limitKm" inputMode="decimal" className={sel} placeholder="Selon le type" /></label>
          <fieldset className="col-span-2">
            <legend>Sports (matériel principal ; vide = selon le type)</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {GEAR_SPORTS.map((k) => <label key={k} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-3 text-ink"><input type="checkbox" name="sports" value={k} className="h-4 w-4 accent-[rgb(var(--brand))]" />{SPORTS[k].label}</label>)}
            </div>
          </fieldset>
          <label className="col-span-2 inline-flex min-h-11 items-center gap-2 text-ink"><input type="checkbox" name="isDefault" className="h-5 w-5 accent-[rgb(var(--brand))]" />Affecter d’office aux nouvelles sorties de ces sports</label>
        </div>
        <p className="mt-2 text-xs text-ink-soft">Un composant (chaîne, cassette, pneu) se monte sur un vélo ou un home trainer : il compte automatiquement leurs sorties. Le home trainer par défaut est affecté aux sorties vélo importées sans trace GPS.</p>
        <button className="mt-4 min-h-14 w-full rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink">Ajouter</button>
      </form>

      {retired.length > 0 && (
        <details className="rounded-xl border border-line bg-surface p-4">
          <summary className="cursor-pointer font-display text-lg font-bold">Retirés ({retired.length})</summary>
          <ul className="mt-2 divide-y divide-line">
            {retired.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0"><b className="block truncate">{g.name}</b><span className="text-xs text-ink-soft">{GEAR_KINDS[g.kind].label}, retiré le {fmtDate(g.retiredAt!)}</span></span>
                <span className={cn("shrink-0 font-semibold tabular-nums", LEVEL_STYLE[g.level].text)}>{fmtNum(g.km, 0)} km</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
