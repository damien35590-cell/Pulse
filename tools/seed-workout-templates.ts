/**
 * Crée les modèles de séance intégrés (« Haut du corps », « Bas + abdos ») pour chaque utilisateur. Idempotent : sans effet s'ils existent.
 *
 *   node --env-file=.env.local --import tsx tools/seed-workout-templates.ts
 *
 * Pas indispensable : l'app les crée d'elle-même à la première ouverture de « Nouvelle séance » (lib/workout/builtin.ts).
 * Les variantes et reps de départ viennent de ton historique de muscu, sinon du premier niveau de chaque échelle.
 */
import { prisma } from "../lib/prisma";
import { ensureBuiltInTemplates } from "../lib/workout/builtin";

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  for (const u of users) {
    const before = await prisma.workoutTemplate.count({ where: { userId: u.id, isBuiltIn: true } });
    await ensureBuiltInTemplates(u.id);
    const after = await prisma.workoutTemplate.count({ where: { userId: u.id, isBuiltIn: true } });
    console.log(`${u.email ?? u.id} : ${after - before} modèle(s) créé(s), ${after} intégré(s) au total`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
