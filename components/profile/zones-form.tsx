import { saveZones } from "@/app/actions";

type Z = { ftp: number | null; hrMax: number | null; ftpAuto: number | null; hrAuto: number | null; ftpManual: boolean; hrManual: boolean };
const inp = "mt-1 min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base";

export function ZonesForm({ zones }: { zones: Z }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-xl font-bold">Mes seuils</h2>
      <form action={saveZones} className="rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">
          <label>FTP (watts)<input name="ftp" inputMode="numeric" defaultValue={zones.ftpManual ? (zones.ftp ?? "") : ""} placeholder={zones.ftpAuto ? `${zones.ftpAuto} (estimée)` : "Inconnue"} className={inp} /></label>
          <label>FC max (bpm)<input name="hrMax" inputMode="numeric" defaultValue={zones.hrManual ? (zones.hrMax ?? "") : ""} placeholder={zones.hrAuto ? `${zones.hrAuto} (estimée)` : "Inconnue"} className={inp} /></label>
        </div>
        <p className="mt-2 text-xs text-ink-soft">Laissez vide : Pulse estime la FTP (95 % de votre meilleur 20 min) et la FC max (la plus haute FC enregistrée). Ces estimations restent approximatives tant que vous n’avez pas fait d’effort maximal.</p>
        <button className="mt-3 min-h-12 w-full rounded-xl bg-surface-2 font-semibold">Enregistrer</button>
      </form>
    </section>
  );
}
