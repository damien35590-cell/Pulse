/** Météo Open-Meteo (gratuit, sans clé). Retourne null au moindre souci : l'anecdote s'en passe. */
export async function fetchWeather(lat: number, lng: number, start: Date, durS: number) {
  try {
    const age = (Date.now() - start.getTime()) / 864e5;
    const end = new Date(start.getTime() + durS * 1000);
    const url = age <= 5
      ? `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation&past_days=7&forecast_days=1&timezone=GMT`
      : `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${start.toISOString().slice(0, 10)}&end_date=${end.toISOString().slice(0, 10)}&hourly=temperature_2m,precipitation&timezone=GMT`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = await r.json();
    const h0 = Math.floor(start.getTime() / 36e5), h1 = Math.floor(end.getTime() / 36e5);
    let precip = 0, temp: number | null = null;
    (j.hourly.time as string[]).forEach((s, i) => {
      const h = Date.parse(s + "Z") / 36e5;
      if (h >= h0 && h <= h1) { precip += j.hourly.precipitation[i] ?? 0; if (h === h0) temp = j.hourly.temperature_2m[i]; }
    });
    return { tempC: temp, precipMm: Math.round(precip * 10) / 10 };
  } catch { return null; }
}
