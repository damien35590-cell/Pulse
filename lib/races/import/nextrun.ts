import * as cheerio from "cheerio";
import type { RaceDraft } from "../../../types/race";
import { fetchHtml } from "./fetch";
import { clean, decimal, frDate, og, toCents, type ImportResult } from "./common";

const ORIGIN = "https://nextrun.fr";
const RACE_PATH = /^\/events\/([^/]+)\/races\/([^/?#]+)/;

/** Texte de l'article, morceau par morceau (un morceau = un nœud texte, donc une « ligne » visuelle). */
function segments(el: any): string[] {
  const out: string[] = [];
  const walk = (n: any) => {
    if (n.type === "text") { const t = clean(n.data); if (t) out.push(t); }
    else if (n.children) n.children.forEach(walk);
  };
  walk(el);
  return out;
}

function parseArticle($: cheerio.CheerioAPI, el: any, eventName: string | undefined, pageHasPps: boolean): RaceDraft | null {
  const href = $(el).find('a[href*="/races/"]').first().attr("href");
  if (!href) return null;
  const segs = segments(el);
  const text = segs.join(" ");
  const when = text.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+à\s+(\d{1,2})[:h](\d{2}))?/);
  const whenIdx = segs.findIndex((s) => /\d{2}\/\d{2}\/\d{4}/.test(s));
  // Avant la date : [type, nom]. Si le type manque, tout ce qui précède est le nom.
  const before = whenIdx > 0 ? segs.slice(0, whenIdx) : [];
  const type = before.length >= 2 ? before[0] : undefined;
  const name = before.length >= 2 ? before.slice(1).join(" ") : before[0];
  // « Départ : » et le lieu sont des nœuds séparés ; au cas où la structure change, repli sur une regex.
  const depIdx = segs.findIndex((s) => /^Départ\s*:/i.test(s));
  const inline = depIdx >= 0 ? segs[depIdx].replace(/^Départ\s*:\s*/i, "") : "";
  const place = inline || (depIdx >= 0 ? segs[depIdx + 1] : undefined)
    || text.match(/Départ\s*:\s*(.+?)\s+(?:Solo|Duo|Trio|Relais|Équipe|Distance)\b/i)?.[1];
  const dist = text.match(/Distance\s+(\d+(?:[.,]\d+)?)\s*km/i);
  const dplus = text.match(/Dénivelé\s*\+\s*(\d+(?:[.,]\d+)?)\s*m\b/i);
  const price = text.match(/(\d+(?:[.,]\d{1,2})?)\s*€/);
  const walking = /randonn|marche/i.test(type ?? "");
  return {
    url: new URL(href, ORIGIN).href,
    platform: "NEXTRUN",
    name, eventName,
    date: when ? frDate(when[1], when[2], when[3]) : undefined,
    startTime: when?.[4] ? `${when[4].padStart(2, "0")}:${when[5]}` : undefined,
    location: clean(place),
    sport: walking ? "HIKE" : "RUN",
    targetDistance: dist ? decimal(dist[1]) : undefined,
    targetElevation: dplus ? decimal(dplus[1]) : undefined,
    priceCents: price ? toCents(price[1]) : undefined,
    requiredDocument: pageHasPps ? "Licence FFA ou PPS" : undefined,
  };
}

export async function importNextRun(rawUrl: string): Promise<ImportResult> {
  const u = new URL(rawUrl);
  const m = u.pathname.match(RACE_PATH);
  // Une page d'épreuve n'a ni l'année ni le prix : on passe par la page événement et on garde l'épreuve visée.
  const pageUrl = m ? `${ORIGIN}/events/${m[1]}` : rawUrl;
  const raceId = m?.[2];
  const $ = cheerio.load(await fetchHtml(pageUrl));
  const eventName = og($, "title");
  const body = $("body").text();
  const pageHasPps = /\bPPS\b/.test(body) || /licence\s+FFA/i.test(body);

  const seen = new Set<string>();
  let races: RaceDraft[] = [];
  $("article").each((_, el) => {
    const r = parseArticle($, el, eventName, pageHasPps);
    if (!r || seen.has(r.url)) return;
    seen.add(r.url); races.push(r);
  });
  if (raceId) races = races.filter((r) => r.url.includes(raceId));

  const dates = races.map((r) => r.date).filter((d): d is string => !!d).sort();
  return { event: { eventName, location: races[0]?.location, date: dates[0] }, races };
}
