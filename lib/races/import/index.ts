import type { RaceDraft } from "../../../types/race";
import { parseHttpUrl } from "./fetch";
import { importNextRun } from "./nextrun";
import { importKlikego } from "./klikego";
import { importGeneric } from "./generic";

const onDomain = (host: string, d: string) => host === d || host.endsWith(`.${d}`);

/** Lit une page d'inscription (NextRun, Klikego ou autre) et renvoie les épreuves trouvées. Lève une Error lisible en cas d'échec. */
export async function importRaceFromUrl(url: string): Promise<{ event: { eventName?: string; location?: string; date?: string }; races: RaceDraft[] }> {
  const u = parseHttpUrl(url);
  // Les paramètres de suivi (utm_*) ne servent à rien et casseraient l'unicité (userId, url).
  for (const k of [...u.searchParams.keys()]) if (k.toLowerCase().startsWith("utm_")) u.searchParams.delete(k);
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (onDomain(host, "nextrun.fr")) return importNextRun(u.href);
  if (onDomain(host, "klikego.com")) return importKlikego(u.href);
  return importGeneric(u.href);
}
