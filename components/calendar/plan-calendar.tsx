import { dayKey, shiftDay } from "@/lib/dates";
import { getCalendar } from "@/lib/data/calendar";
import { CalendarView } from "./calendar-view";

/** Fenêtre chargée d'un coup (≈ 6 mois avant, 7 après) ; la navigation se fait côté client dans cette plage. */
export async function PlanCalendar({ userId }: { userId: string }) {
  const today = dayKey(new Date(), "Europe/Paris");
  const monthStart = `${today.slice(0, 7)}-01`;
  const data = await getCalendar(userId, shiftDay(monthStart, -183), shiftDay(monthStart, 215));
  return <CalendarView data={data} today={today} />;
}
