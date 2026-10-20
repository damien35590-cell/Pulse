/** Formats d'affichage des boucles, utilisables côté serveur comme côté client. */

/** Durée pour un <Metric> : « 45 min » ou « 1:05 h ». */
export const durationMetric = (minutes: number) => {
  const m = Math.round(minutes); // arrondi d'abord : jamais « 0:60 »
  return m >= 60 ? { value: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`, unit: "h" } : { value: String(m), unit: "min" };
};

export const sportLine = (r: { sport: "RUN" | "RIDE"; variant: "road" | "trail" | null }) =>
  r.sport === "RUN" ? "Course" : r.variant === "trail" ? "Vélo · chemins" : "Vélo · route";
