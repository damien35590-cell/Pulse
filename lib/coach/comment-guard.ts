/**
 * Garde-fou des commentaires de séance : refuse emoji, points d'exclamation et vocabulaire de cheerleader.
 * Fonction pure (tests : tools/test-session-verdict.ts).
 */
import type { VerdictKind } from "./session-verdict";

const BANNED = [
  "super", "incroyable", "lache rien", "genial", "top", "excellent", "parfait", "chapeau", "comme un chef", "bien joue",
  "continue comme ca", "tu as tout donne", "ne te decourage pas",
];
const RECORD_ONLY = ["bravo", "felicitations"];

/** Minuscules sans accents, pour comparer sans se soucier de la casse ni des diacritiques. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const has = (text: string, word: string) => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(text);

export type CommentCheck = { ok: boolean; reasons: string[] };

export function validateComment(text: string, kind: VerdictKind): CommentCheck {
  const reasons: string[] = [];
  if (/\p{Extended_Pictographic}/u.test(text)) reasons.push("emoji");
  if (text.includes("!")) reasons.push("point d'exclamation");
  const t = fold(text);
  for (const w of BANNED) if (has(t, w)) reasons.push(`mot interdit : ${w}`);
  if (kind !== "record") for (const w of RECORD_ONLY) if (has(t, w)) reasons.push(`mot réservé aux records : ${w}`);
  return { ok: reasons.length === 0, reasons };
}

/**
 * Texte final d'un commentaire. Sans `generate`, ou si le texte généré est refusé deux fois (1 essai + 1 régénération),
 * le gabarit déterministe est renvoyé.
 */
export async function resolveComment(kind: VerdictKind, template: string, generate?: (attempt: number) => Promise<string>): Promise<string> {
  if (generate) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = (await generate(attempt).catch(() => "")).trim();
      if (text && validateComment(text, kind).ok) return text;
    }
  }
  return template;
}
