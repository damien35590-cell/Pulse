import * as cheerio from "cheerio";
import type { RaceDraft } from "../../../types/race";
import { fetchHtml } from "./fetch";
import { clean, decimal, frDate, jsonLdNodes, metaDrafts, toCents, type ImportResult } from "./common";

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slug = (s: string) => strip(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const KIDS = /\b(U1[0-9]|poussins?|benjamins?|minimes?|[ée]veils?|mini[- ]?trail|enfants?)\b/i;

type Header = { idx: number; weekday: number; day: number; month: number };
/** « Samedi 17 octobre », « Dimanche 18 octobre »… avec leur position dans le texte. */
function dayHeaders(text: string): Header[] {
  const re = new RegExp(`\\b(${DAYS.join("|")})\\s+(\\d{1,2})\\s+(${MONTHS.concat(["fevrier", "aout", "decembre"]).join("|")})`, "gi");
  return [...text.matchAll(re)].map((m) => {
    const mo = strip(m[3]);
    return { idx: m.index!, weekday: DAYS.indexOf(strip(m[1])), day: +m[2], month: MONTHS.findIndex((x) => strip(x) === mo) };
  });
}

/** Le jour de la semaine est plus fiable que le quantième (la page a des coquilles) : on le cherche entre début et fin de l'événement. */
function resolveHeader(h: Header, start: string, end: string): string | undefined {
  const s = new Date(`${start}T12:00:00Z`), e = new Date(`${end}T12:00:00Z`);
  if (isNaN(+s)) return undefined;
  for (let d = new Date(s), i = 0; d <= (isNaN(+e) ? s : e) && i < 14; d = new Date(+d + 864e5), i++) if (d.getUTCDay() === h.weekday) return d.toISOString().slice(0, 10);
  return h.month >= 0 ? frDate(String(h.day), String(h.month + 1), String(s.getUTCFullYear())) : undefined;
}

/** Heure, date corrigée et D+ d'une épreuve d'après le texte visible : première mention du nom suivie d'un « Départ à ». */
function scanText(text: string, headers: Header[], shortName: string, start: string, end: string) {
  const re = new RegExp(escRe(shortName), "gi");
  let startTime: string | undefined, date: string | undefined, dplus: number | undefined;
  for (const m of text.matchAll(re)) {
    const win = text.slice(m.index!, m.index! + 300);
    if (dplus === undefined) { const d = text.slice(m.index!, m.index! + 120).match(/(\d+)\s*m?\s*D\+/i); if (d) dplus = +d[1]; }
    if (startTime) continue;
    const dep = win.match(/D[ée]part\s*(?:[àa]\s*)?(\d{1,2})\s*h\s*(\d{2})?/i);
    const t = dep ?? win.match(/\b(\d{1,2})\s*h\s*(\d{2})\b/);
    if (!t) continue;
    startTime = `${t[1].padStart(2, "0")}:${t[2] ?? "00"}`;
    // Seul un « Départ à » du programme est rattaché à l'en-tête de jour qui le précède ; une heure nue (tableau récapitulatif) ne dit rien du jour.
    const h = dep ? headers.filter((x) => x.idx < m.index!).pop() : undefined;
    if (h) date = resolveHeader(h, start, end);
  }
  return { startTime, date, dplus };
}

function distanceKm(name: string): number | undefined {
  const sum = name.match(/(\d+(?:[.,]\d+)?)\s*\+\s*(\d+(?:[.,]\d+)?)\s*km/i); // « Défi 13 +15 km » = 28 km
  if (sum) return decimal(sum[1]) + decimal(sum[2]);
  const km = name.match(/(\d+(?:[.,]\d+)?)\s?km/i);
  if (km) return decimal(km[1]);
  const m = name.match(/(\d+)\s?m\b/);
  return m ? +m[1] / 1000 : undefined;
}

const cleanUrl = (u: string) => u.split("#")[0];

export async function importKlikego(rawUrl: string): Promise<ImportResult> {
  const pageUrl = cleanUrl(rawUrl);
  const $ = cheerio.load(await fetchHtml(pageUrl));
  const ev = jsonLdNodes($).find((n) => [n["@type"]].flat().includes("SportsEvent") && Array.isArray(n.subEvent) && n.subEvent.length > 0);
  $("script, style, noscript").remove();
  const text = clean($("body").text()) ?? "";
  if (!ev) return fallback($, text, pageUrl);

  const eventName = clean(ev.name);
  const start = String(ev.startDate ?? "").slice(0, 10), end = String(ev.endDate ?? ev.startDate ?? "").slice(0, 10);
  const headers = dayHeaders(text);
  const placeOf = (loc: any) => clean(loc?.name) ?? clean([loc?.address?.postalCode, loc?.address?.addressLocality].filter(Boolean).join(" "));
  const eventPlace = placeOf([ev.location].flat()[0]);

  const races: RaceDraft[] = (ev.subEvent as any[]).map((s) => {
    const full = clean(s.name) ?? "";
    const name = eventName && full.startsWith(`${eventName} - `) ? full.slice(eventName.length + 3) : full;
    const offer = [s.offers].flat()[0];
    const price = offer?.price !== undefined ? toCents(String(offer.price)) : undefined;
    const found = scanText(text, headers, name, start, end);
    const day = /^\d{4}-\d{2}-\d{2}/.test(String(s.startDate)) ? String(s.startDate).slice(0, 10) : start;
    return {
      url: `${pageUrl}#${slug(name)}`, platform: "KLIKEGO", eventName, name,
      // startDate des sous-épreuves non fiable (toutes au même jour à 00:00) : correction par le texte, et drapeau pour vérification.
      date: found.date ?? (day || undefined), startTime: found.startTime, needsDateCheck: true,
      location: placeOf([s.location].flat()[0]) ?? eventPlace,
      sport: /marche|rando/i.test(name) ? "HIKE" : "RUN",
      targetDistance: distanceKm(name), targetElevation: found.dplus,
      priceCents: price !== undefined && Number.isFinite(price) ? price : undefined,
    } satisfies RaceDraft;
  });
  // Les épreuves enfants passent en bas de liste (tri stable).
  races.sort((a, b) => Number(KIDS.test(a.name ?? "")) - Number(KIDS.test(b.name ?? "")));
  return { event: { eventName, location: eventPlace, date: start || undefined }, races };
}

/** Page sans SportsEvent exploitable : JSON-LD/OpenGraph générique, puis regex sur le texte pour combler les trous. */
function fallback($: cheerio.CheerioAPI, text: string, url: string): ImportResult {
  const res = metaDrafts($, "KLIKEGO", url);
  if (res.races.length === 1) {
    const r = res.races[0];
    const when = text.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s*(?:à|a|-)?\s*(\d{1,2})[:h](\d{2}))?/);
    const dist = text.match(/(\d+(?:[.,]\d+)?)\s*km\b/i);
    const price = text.match(/(\d+(?:[.,]\d{1,2})?)\s*€/);
    if (!r.date && when) r.date = frDate(when[1], when[2], when[3]);
    if (!r.startTime && when?.[4]) r.startTime = `${when[4].padStart(2, "0")}:${when[5]}`;
    if (r.targetDistance === undefined && dist) r.targetDistance = decimal(dist[1]);
    if (r.priceCents === undefined && price) r.priceCents = toCents(price[1]);
    r.needsDateCheck = true;
    if (!res.event.date) res.event.date = r.date;
  }
  return res;
}
