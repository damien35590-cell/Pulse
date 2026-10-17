const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;

/** Refuse les hôtes locaux ou privés (garde-fou SSRF : le serveur ne doit pas aller chercher une page interne). */
function isPublicHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (h.includes(":")) return false; // IPv6 littérale
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
  }
  return true;
}

export function parseHttpUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new Error("Lien invalide."); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Seuls les liens http(s) sont acceptés.");
  if (!isPublicHost(u.hostname)) throw new Error("Ce lien n’est pas accessible.");
  return u;
}

/** Télécharge une page HTML : timeout 10 s, 3 Mo max, redirections revérifiées une à une. */
export async function fetchHtml(raw: string): Promise<string> {
  let url = parseHttpUrl(raw);
  const signal = AbortSignal.timeout(10_000);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, { signal, redirect: "manual", headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "fr-FR,fr;q=0.9" } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { url = parseHttpUrl(new URL(res.headers.get("location")!, url).href); continue; }
    if (!res.ok) throw new Error(`La page a répondu ${res.status}.`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) throw new Error("Page trop volumineuse.");
    const reader = res.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = []; let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) { await reader.cancel(); throw new Error("Page trop volumineuse."); }
      chunks.push(value);
    }
    return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
  }
  throw new Error("Trop de redirections.");
}
