import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getZones } from "@/lib/data/zones";
import { SessionFlow } from "@/components/workout/session-flow";
import { buildDraftFromSession, buildDraftFromTemplate, getNextSessionSuggestion } from "@/lib/workout/queries";
import { getWarmupDefaults } from "@/lib/workout/library-db";
import type { Draft } from "@/lib/workout/types";

export const dynamic = "force-dynamic";

type SP = { from?: string; template?: string; suggest?: string; empty?: string; go?: string };

/**
 * Démarrer une séance de muscu. L'adresse dit d'où l'on part :
 * ?suggest=1 (suggestion du jour, &go=1 pour sauter la préparation) · ?from=<séance> · ?template=<modèle> · ?empty=1 ;
 * sans paramètre : reprise de la séance en cours, ou feuille « Nouvelle séance ».
 */
export default async function SessionPage({ searchParams }: { searchParams: SP }) {
  const uid = (await auth())?.user?.id;
  if (!uid) redirect("/login");

  let draft: Draft | null = null;
  if (searchParams.from) draft = await buildDraftFromSession(searchParams.from, uid);
  else if (searchParams.template) draft = await buildDraftFromTemplate(searchParams.template, uid);
  else if (searchParams.suggest) draft = (await getNextSessionSuggestion(uid)).draft;
  else if (searchParams.empty) draft = { title: "", kind: "LIBRE", templateId: null, exercises: [] };
  // Séance ou modèle introuvable (supprimé, autre compte) : retour à la feuille plutôt qu'une page vide.
  if (!draft && (searchParams.from || searchParams.template)) redirect("/record/session");

  const [{ hrMax }, warmup] = await Promise.all([getZones(uid), getWarmupDefaults(uid)]);
  return <SessionFlow key={JSON.stringify(searchParams)} draft={draft} direct={searchParams.go === "1"} hrMax={hrMax} warmup={warmup} />;
}
