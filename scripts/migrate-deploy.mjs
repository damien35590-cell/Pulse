// Applique les migrations Prisma pendant le build : production Vercel, ou preview avec base isolée
// (branche Neon par déploiement, PREVIEW_DB_ISOLATED=true). Sinon rien, pour qu'une migration de
// branche n'atteigne jamais la base de prod. Appliquer à la main sur la base du .env : npm run db:deploy
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
const isolatedPreview = env === "preview" && process.env.PREVIEW_DB_ISOLATED === "true";

if (env !== "production" && !isolatedPreview) {
  console.log(`migrate deploy ignoré (VERCEL_ENV=${env ?? "non défini"})`);
  process.exit(0);
}

const childEnv = { ...process.env };
if (isolatedPreview) {
  if (!childEnv.DIRECT_URL) childEnv.DIRECT_URL = childEnv.DATABASE_URL_UNPOOLED;
  if (!childEnv.DIRECT_URL || !childEnv.DATABASE_URL) {
    console.error(
      "migrate deploy impossible sur la preview : DATABASE_URL / DATABASE_URL_UNPOOLED absents (intégration Neon Vercel non active pour Preview ?)",
    );
    process.exit(1);
  }
}

const r = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", shell: true, env: childEnv });
process.exit(r.status ?? 1);
