/** Type de séance : choix manuel (Activity.sessionType, jamais écrasé par un recalcul) ou, à défaut, détection (Activity.isInterval). */
export type SessionType = "interval" | "easy" | "long" | "race" | "recovery" | "endurance";
type Option = { value: SessionType; label: string };
const LABEL: Record<SessionType, string> = { interval: "Fractionné", easy: "Footing", long: "Sortie longue", race: "Compétition", recovery: "Récup", endurance: "Endurance" };
const opt = (...v: SessionType[]): Option[] => v.map((value) => ({ value, label: LABEL[value] }));
/** Tous les types connus (validation de l'écriture) ; l'écran n'en propose que ceux du sport (sessionTypesFor). */
export const SESSION_TYPES: Option[] = opt("interval", "easy", "long", "race", "recovery", "endurance");
const RUN_TYPES = opt("easy", "interval", "long", "race");
const RIDE_TYPES = opt("recovery", "endurance", "interval", "long", "race");
/** Options par sport : course → Footing, Fractionné, Sortie longue, Compétition ; vélo (virtuel compris) → Récup, Endurance, Fractionné, Sortie longue, Compétition ; rando → aucune. */
export const sessionTypesFor = (type: string): Option[] => (type === "RUN" ? RUN_TYPES : type === "RIDE" ? RIDE_TYPES : []);
export const isSessionType = (v: unknown): v is SessionType => typeof v === "string" && v in LABEL;
/** Valeur détectée par défaut : fractionné, sinon l'allure de base du sport (footing à pied, endurance à vélo). */
export const detectedSessionType = (isInterval: boolean | null | undefined, type = "RUN"): SessionType => (isInterval ? "interval" : type === "RIDE" ? "endurance" : "easy");
/** Un choix d'un autre sport (ex. « footing » posé avant ce découpage sur une sortie vélo) est ramené à son équivalent. */
export const sessionTypeFor = (type: string, v: string | null | undefined): SessionType | null =>
  !isSessionType(v) ? null : sessionTypesFor(type).some((o) => o.value === v) ? v : v === "easy" && type === "RIDE" ? "endurance" : v === "endurance" && type === "RUN" ? "easy" : null;
export const effectiveSessionType = (a: { type?: string; sessionType?: string | null; isInterval?: boolean | null }): SessionType =>
  (a.type ? sessionTypeFor(a.type, a.sessionType) : isSessionType(a.sessionType) ? a.sessionType : null) ?? detectedSessionType(a.isInterval, a.type);
