// Diagnostic lecture seule : les 10 dernières séances de muscu, leur modèle, leur moitié et leur comparable.
import { prisma } from "../lib/prisma";
import { resolveName } from "../lib/workout/catalog";
async function main() {
  const acts = await prisma.activity.findMany({ where: { type: "WORKOUT" }, orderBy: { startedAt: "desc" }, take: 10, select: { id: true, startedAt: true, kind: true, templateId: true, exercises: { orderBy: { position: "asc" }, select: { name: true } } } });
  for (const a of acts) console.log(a.startedAt.toISOString().slice(0, 10), a.id.slice(-6), "tpl=", a.templateId?.slice(-6) ?? null, "kind=", a.kind, "|", a.exercises.map((e) => `${e.name}→${resolveName(e.name).code}`).join(" ; "));
}
main().finally(() => prisma.$disconnect());
