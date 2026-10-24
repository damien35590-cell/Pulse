/** Type de séance : choix manuel (Activity.sessionType, jamais écrasé par un recalcul) ou, à défaut, détection (Activity.isInterval). */
export type SessionType = "interval" | "easy" | "race";
export const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: "interval", label: "Fractionné" },
  { value: "easy", label: "Footing" },
  { value: "race", label: "Compétition" },
];
export const isSessionType = (v: unknown): v is SessionType => v === "interval" || v === "easy" || v === "race";
export const detectedSessionType = (isInterval: boolean | null | undefined): SessionType => (isInterval ? "interval" : "easy");
export const effectiveSessionType = (a: { sessionType?: string | null; isInterval?: boolean | null }): SessionType =>
  isSessionType(a.sessionType) ? a.sessionType : detectedSessionType(a.isInterval);
