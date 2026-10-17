import * as cheerio from "cheerio";
import type { RaceDraft } from "../../../types/race";

export type Platform = NonNullable<RaceDraft["platform"]>;
export type ImportResult = { event: { eventName?: string; location?: string; date?: string }; races: RaceDraft[] };

const clean = (s: string | undefined | null) => (s ? s.replace(/\s+/g, " ").trim() || undefined : undefined);
export { clean };

/** "27/03/2027" → "2027-03-27" */
export const frDate = (d: string, m: string, y: string) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
/** "7,5" → 7.5 */
export const decimal = (s: string) => parseFloat(s.replace(",", "."));
/** "18,00 €" → 1800 */
export const toCents = (s: string) => Math.round(decimal(s) * 100);

export function og($: cheerio.CheerioAPI, prop: string) {
  return clean($(`meta[property="og:${prop}"]`).attr("content") ?? $(`meta[name="og:${prop}"]`).attr("content"));
}

/** Tous les objets JSON-LD de la page (a mettre à plat : @graph, tableaux). */
export function jsonLdNodes($: cheerio.CheerioAPI): Record<string, any>[] {
  const out: Record<string, any>[] = [];
  const walk = (n: any) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === "object") { out.push(n); if (n["@graph"]) walk(n["@graph"]); }
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try { walk(JSON.parse($(el).text())); } catch { /* JSON-LD cassé : on passe */ }
  });
  return out;
}

const isEvent = (n: Record<string, any>) => [n["@type"]].flat().some((t) => typeof t === "string" && /Event$/.test(t));

/** schema.org Event → brouillon. `startDate` est lue telle quelle (heure locale), sans conversion de fuseau. */
function draftFromEvent(n: Record<string, any>, platform: Platform, url: string, eventName?: string): RaceDraft {
  const start = typeof n.startDate === "string" ? n.startDate : undefined;
  const dm = start?.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  const loc = [n.location].flat()[0];
  const place = typeof loc === "string" ? loc : clean([loc?.address?.addressLocality, loc?.name].find((x) => typeof x === "string"));
  const offer = [n.offers].flat()[0];
  const price = offer?.price ?? offer?.lowPrice;
  const priceNum = price !== undefined && price !== "" ? Number(String(price).replace(",", ".")) : NaN;
  return {
    url, platform,
    name: clean(n.name), eventName,
    date: dm?.[1], startTime: dm?.[2] && dm[2] !== "00:00" ? dm[2] : undefined,
    location: clean(place),
    priceCents: Number.isFinite(priceNum) && priceNum >= 0 ? Math.round(priceNum * 100) : undefined,
  };
}

/** JSON-LD d'abord (événement + éventuelles sous-épreuves), puis OpenGraph, puis <title>. */
export function metaDrafts($: cheerio.CheerioAPI, platform: Platform, url: string): ImportResult {
  const pageTitle = og($, "title") ?? clean($("title").first().text());
  const ev = jsonLdNodes($).find(isEvent);
  let races: RaceDraft[] = [];
  if (ev) {
    const subs = [ev.subEvent].flat().filter((s) => s && typeof s === "object");
    races = subs.length ? subs.map((s) => ({ ...draftFromEvent({ startDate: ev.startDate, location: ev.location, ...s }, platform, typeof s.url === "string" ? new URL(s.url, url).href : url, clean(ev.name)) }))
                        : [draftFromEvent(ev, platform, url)];
  } else {
    races = [{ url, platform, name: pageTitle }];
  }
  const first = races[0];
  return { event: { eventName: clean(ev?.name) ?? pageTitle, location: first?.location, date: first?.date }, races };
}
