"use client";
import { ArrowUp, Cloud, CloudMoon, CloudRain, CloudSun, Moon, Sun, TriangleAlert, Wind } from "lucide-react";
import type { RideWeather } from "@/lib/weather/open-meteo";
import type { WeatherAlert } from "@/lib/weather/rules";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { Metric } from "@/components/ui/metric";

const COMPASS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];
const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8];
const time = (ms: number) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(ms));

/** Pictogramme du ciel : pluie, vent fort, nuages, jour ou nuit. */
export function WeatherIcon({ w, className }: { w: RideWeather; className?: string }) {
  const Icon = w.rainProbMax >= 60 ? CloudRain
    : w.windKmh >= 30 ? Wind
    : w.cloudMean >= 75 ? Cloud
    : w.cloudMean >= 30 ? (w.isDay ? CloudSun : CloudMoon)
    : w.isDay ? Sun : Moon;
  return <Icon className={className} aria-hidden />;
}

/** Flèche dans le sens où souffle le vent (le vent du nord pousse vers le sud). */
export function WindArrow({ fromDeg, className }: { fromDeg: number; className?: string }) {
  return <ArrowUp className={cn("inline size-3.5 shrink-0 self-center", className)} style={{ transform: `rotate(${fromDeg + 180}deg)` }} aria-label={`vent du ${compass(fromDeg)}`} />;
}

const feels = (w: RideWeather) => {
  const a = Math.round(w.feelsMin), b = Math.round(w.feelsMax);
  return a === b ? String(a) : `${a}…${b}`;
};

/**
 * Bandeau météo au-dessus du bouton principal : ressenti, pluie, vent, coucher du soleil sur la fenêtre de la sortie.
 * `w === null` : Open-Meteo n'a pas répondu, les boucles restent disponibles.
 */
export function WeatherBanner({ w, loading, className }: { w: RideWeather | null | undefined; loading?: boolean; className?: string }) {
  if (loading && !w)
    return <div aria-hidden className={cn(ui.card, "h-16 animate-pulse shadow-pop", className)} />;
  if (!w)
    return <p className={cn(ui.card, "px-4 py-3 text-sm text-ink-soft shadow-pop", className)}>Météo indisponible pour l&apos;instant : les boucles seront classées sans elle.</p>;
  return (
    <div className={cn(ui.card, "flex items-center gap-3 px-3 py-2.5 shadow-pop transition-opacity", loading && "opacity-60", className)} aria-live="polite">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink"><WeatherIcon w={w} className="size-5" /></span>
      <dl className="grid min-w-0 flex-1 grid-cols-4 gap-2">
        <Metric size="sm" label="Ressenti" value={feels(w)} unit="°C" />
        <Metric size="sm" label="Pluie" value={w.rainProbMax} unit="%" tone={w.rainProbMax >= 60 ? "bad" : "default"} />
        <Metric size="sm" label="Vent" value={<span className="inline-flex items-center gap-0.5">{Math.round(w.windKmh)}<WindArrow fromDeg={w.windFromDeg} className="text-ink-soft" /></span>} unit="km/h" />
        <Metric size="sm" label="Coucher" value={w.sunset != null ? time(w.sunset) : "—"} />
      </dl>
    </div>
  );
}

/** Alertes météo d'une boucle (vigilance en ambre, danger en rouge). `max` : nombre affiché sur une carte. */
export function WeatherAlerts({ alerts, max, className }: { alerts: WeatherAlert[]; max?: number; className?: string }) {
  const shown = max ? alerts.filter((a) => a.tone === "bad").concat(alerts.filter((a) => a.tone !== "bad")).slice(0, max) : alerts;
  if (!shown.length) return null;
  return (
    <ul className={cn("space-y-1.5", className)}>
      {shown.map((a, i) => (
        <li key={i} className={cn("flex gap-2 rounded-tile px-2.5 py-1.5 text-xs leading-snug", a.tone === "bad" ? "bg-bad/10 text-bad" : "bg-warn/10 text-warn")}>
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          <span className={cn(max && "line-clamp-1")}>{a.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Crédit demandé par la licence CC BY 4.0 d'Open-Meteo. */
export function WeatherCredit({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-ink-mute", className)}>
      Météo : <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2">Open-Meteo</a> (CC BY 4.0)
    </p>
  );
}
