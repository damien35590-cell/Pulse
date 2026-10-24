"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { SettingsRow } from "@/components/ui/settings-row";
import type { AllPrefs } from "@/lib/notify/prefs";

const fmtTime = (t: string) => `${Number(t.slice(0, 2))} h ${t.slice(3)}`;

/** Ligne « Notifications » du hub : « Désactivées » tant que l'autorisation n'est pas accordée, sinon le nombre d'alertes actives. */
export function NotificationsRow({ prefs }: { prefs: AllPrefs }) {
  const [granted, setGranted] = useState<boolean | null>(null); // null : pas encore lu côté navigateur
  useEffect(() => { setGranted("Notification" in window && Notification.permission === "granted"); }, []);
  const active = [prefs.morning, prefs.reminder, prefs.weekly].filter(Boolean).length;
  const value = granted === null ? " "
    : !granted ? <span className="text-warn">Désactivées</span>
    : `${active} active${active > 1 ? "s" : ""}${prefs.morning ? ` · ${fmtTime(prefs.morningCoachTime)}` : ""}`;
  return <SettingsRow icon={<Bell aria-hidden />} title="Notifications" value={value} href="/vous/notifications" />;
}
