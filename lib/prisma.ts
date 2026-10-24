import { PrismaClient } from "@prisma/client";

// Les previews (intégration Neon) fournissent DATABASE_URL_UNPOOLED mais pas DIRECT_URL, requis par le schéma.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL_UNPOOLED) {
  process.env.DIRECT_URL = process.env.DATABASE_URL_UNPOOLED;
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
