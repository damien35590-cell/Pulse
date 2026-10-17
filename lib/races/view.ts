import type { RaceEvent } from "@prisma/client";

/** Course sérialisable (composants client) : la date devient "AAAA-MM-JJ". */
export type RaceView = Omit<RaceEvent, "userId" | "date" | "activityId"> & { date: string };

export const toRaceView = ({ userId: _u, activityId: _a, date, ...e }: RaceEvent): RaceView => ({ ...e, date: date.toISOString().slice(0, 10) });
