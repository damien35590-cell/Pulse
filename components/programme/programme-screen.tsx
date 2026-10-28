"use client";
import { useEffect, useState, type ReactNode } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { Segmented } from "@/components/ui/segmented";
import { ProgramMenu } from "./program-menu";

export type Tab = "run" | "gym";
const KEY = "pulse-programme-tab";
const isTab = (v: unknown): v is Tab => v === "run" || v === "gym";
const TABS = [{ value: "run", label: "Running" }, { value: "gym", label: "Muscu" }] as const;

/**
 * Page Programme (onglet de la barre du bas) : même TopBar que les autres onglets (grand titre repliable, « ⋯ » du programme running), onglets Running / Muscu.
 * L'onglet ouvert est celui de la dernière visite (localStorage, sans erreur si le stockage est indisponible) ; à la première visite, celui dont la prochaine séance est la plus proche (`defaultTab`, calculé côté serveur).
 * Les deux onglets sont rendus par le serveur : changer d'onglet n'attend aucune requête.
 */
export function ProgrammeScreen({ defaultTab, menu, run, gym }: {
  defaultTab: Tab;
  /** Programme running en cours (le menu « ⋯ » n'a de sens qu'avec lui), sinon null. */
  menu: { programId: string; paused: boolean; vma: { vmaKmh: number; label: string } } | null;
  run: ReactNode;
  gym: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  useEffect(() => {
    try { const t = localStorage.getItem(KEY); if (isTab(t)) setTab(t); } catch { /* stockage indisponible */ }
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    try { localStorage.setItem(KEY, t); } catch { /* stockage indisponible */ }
  };

  return (
    <>
      <TopBar title="Programme" actions={menu && tab === "run" ? <ProgramMenu {...menu} /> : undefined} />
      <div className="space-y-4">
        <Segmented options={TABS} value={tab} onChange={choose} size="lg" />
        <div role="tabpanel" aria-label="Running" hidden={tab !== "run"}>{run}</div>
        <div role="tabpanel" aria-label="Muscu" hidden={tab !== "gym"}>{gym}</div>
      </div>
    </>
  );
}
