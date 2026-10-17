import type { Prisma, RaceEvent } from "@prisma/client";

type Draftable = Omit<RaceEvent, "id" | "userId" | "url" | "date" | "activityId">;

// Ce que renvoie l'import par lien (NextRun, Klikego…) : seule l'URL est garantie, champ absent = non trouvé (jamais null).
// `date` est une chaîne ISO « AAAA-MM-JJ » car le brouillon transite en JSON ; `startTime` ("HH:mm", Europe/Paris) vient de RaceEvent.
// Distance et dénivelé suivent RaceEvent : `targetDistance` en km, `targetElevation` en m D+.
export type RaceDraft = { [K in keyof Draftable]?: NonNullable<Draftable[K]> } & {
  url: string;
  date?: string;
  /** Source dont la date/l'heure est peu fiable (Klikego) : l'interface demande de vérifier sur la page d'origine. */
  needsDateCheck?: boolean;
};

export type RaceEventWithActivity = Prisma.RaceEventGetPayload<{ include: { activity: true } }>;
