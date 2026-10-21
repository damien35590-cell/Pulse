import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRideWeather, parseStart } from "@/lib/weather/open-meteo";

export const dynamic = "force-dynamic";

/** Bandeau météo d'Itinéraires : ?lat&lng&minutes&start (ISO, facultatif). { weather: null } si Open-Meteo ne répond pas. */
export async function GET(req: Request) {
  if (!(await auth())?.user?.id) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat")), lng = Number(q.get("lng")), minutes = Math.round(Number(q.get("minutes")));
  if (!(Math.abs(lat) <= 90) || !(Math.abs(lng) <= 180) || !(minutes >= 15 && minutes <= 300)) return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  const start = parseStart(q.get("start"));
  if (start === false) return NextResponse.json({ error: "Heure de départ entre maintenant et demain soir." }, { status: 400 });
  const weather = await getRideWeather(lat, lng, start ?? new Date().toISOString(), minutes);
  return NextResponse.json({ weather });
}
