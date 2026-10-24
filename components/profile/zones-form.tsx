import { saveZones } from "@/app/actions";
import { Section } from "@/components/ui/section";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

type Z = { ftp: number | null; hrMax: number | null; ftpAuto: number | null; hrAuto: number | null; ftpManual: boolean; hrManual: boolean };
const inp = "mt-1 min-h-12 w-full rounded-tile bg-surface-2 px-3 text-base text-ink outline-none focus:ring-2 focus:ring-brand";

export function ZonesForm({ zones }: { zones: Z }) {
  return (
    <Section title="Mes seuils">
      <form action={saveZones} className={cn(ui.card, "p-4")}>
        <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">
          <label>FTP (watts)<input name="ftp" inputMode="numeric" defaultValue={zones.ftpManual ? (zones.ftp ?? "") : ""} placeholder={zones.ftpAuto ? `${zones.ftpAuto} (estimée)` : "Inconnue"} className={inp} /></label>
          <label>FC max (bpm)<input name="hrMax" inputMode="numeric" defaultValue={zones.hrManual ? (zones.hrMax ?? "") : ""} placeholder={zones.hrAuto ? `${zones.hrAuto} (estimée)` : "Inconnue"} className={inp} /></label>
        </div>
        <p className="mt-2 text-xs text-ink-soft">Laissez vide : Pulse estime la FTP (95 % de votre meilleur 20 min) et la FC max (la plus haute FC enregistrée). Ces estimations restent approximatives tant que vous n’avez pas fait d’effort maximal.</p>
        <button className={cn(ui.btnSecondary, "mt-3 h-12 w-full")}>Enregistrer</button>
      </form>
    </Section>
  );
}
