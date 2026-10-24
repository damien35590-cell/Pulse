// Applique les migrations Prisma pendant le build, uniquement pour la production Vercel.
// Previews et builds locaux : rien, pour qu'une migration de branche n'atteigne jamais la base de prod.
// Appliquer à la main sur la base du .env : npm run db:deploy
import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log(`migrate deploy ignoré (VERCEL_ENV=${process.env.VERCEL_ENV ?? "non défini"})`);
  process.exit(0);
}

const r = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
