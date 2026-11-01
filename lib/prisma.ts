import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Les previews (intégration Neon) fournissent DATABASE_URL_UNPOOLED mais pas DIRECT_URL, requis par le schéma.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL_UNPOOLED) {
  process.env.DIRECT_URL = process.env.DATABASE_URL_UNPOOLED;
}

// Client sans moteur Rust (queryCompiler) : les requêtes passent par le pilote pg, qui tient le pool.
// Même adresse qu'avant (DIRECT_URL, non poolée) pour ne rien changer au comportement ; le schéma la
// garde de son côté pour les migrations (prisma migrate, scripts/migrate-deploy.mjs).
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma =
  g.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
