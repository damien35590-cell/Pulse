import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTemplateForEdit } from "@/lib/workout/queries";
import { TemplateEditor } from "@/components/workout/template-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modifier le modèle" };

/** Éditeur d'un modèle de séance de muscu (depuis Nouvelle séance › Modèles › Modifier). */
export default async function TemplateEditPage({ params }: { params: { id: string } }) {
  const uid = (await auth())?.user?.id;
  if (!uid) redirect("/login");
  const template = await getTemplateForEdit(params.id, uid);
  if (!template) notFound();
  return <TemplateEditor template={template} />;
}
