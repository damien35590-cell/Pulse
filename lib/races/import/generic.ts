import * as cheerio from "cheerio";
import { fetchHtml } from "./fetch";
import { metaDrafts, type ImportResult } from "./common";

export async function importGeneric(url: string): Promise<ImportResult> {
  return metaDrafts(cheerio.load(await fetchHtml(url)), "OTHER", url);
}
