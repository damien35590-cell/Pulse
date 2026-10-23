/** Rendu des réponses du coach, sans HTML brut. Pur, utilisable côté client (tests : tools/test-coach-ai.ts). */
/** Découpe la réponse en paragraphes et listes, avec le **gras** repéré (rendu sans HTML brut). */
export type Rich = { kind: "p" | "li"; parts: { text: string; bold: boolean }[] };
export function renderCoachText(text: string): Rich[] {
  const out: Rich[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const li = /^([-•*]|\d+[.)])\s+/.exec(line), body = li ? line.slice(li[0].length) : line.replace(/^#+\s*/, "");
    const parts = body.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((t) => (t.startsWith("**") && t.endsWith("**") && t.length > 4 ? { text: t.slice(2, -2), bold: true } : { text: t, bold: false }));
    out.push({ kind: li ? "li" : "p", parts });
  }
  return out;
}
