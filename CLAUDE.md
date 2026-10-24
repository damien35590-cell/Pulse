# Pulse

## UI

Toute interface suit docs/design-system.md : tokens Tailwind, composants de components/ui, cn() de lib/utils, démo sur /ui-kit.

## Base de données (Prisma + Neon)

Le schéma évolue uniquement par migrations versionnées dans prisma/migrations/.

- Changer le schéma : modifier prisma/schema.prisma, puis `npm run db:migrate -- --name <description>` (prisma migrate dev) contre une base de dev, jamais la prod. Committer le dossier de migration créé avec le changement de schéma.
- Base de dev : une branche Neon « dev », dans .env ET .env.local (Prisma CLI lit .env, Next lit .env.local). L'adresse de prod n'existe que dans les variables Production de Vercel. `migrate dev` peut proposer de réinitialiser la base en cas d'écart : à refuser si l'adresse n'est pas celle de la branche de dev.
- Prod : le build lance `prisma migrate deploy` seulement si VERCEL_ENV=production (scripts/migrate-deploy.mjs) ; previews et builds locaux n'y touchent pas. migrate deploy applique seulement les migrations committées et ne supprime rien. `npm run db:deploy` l'applique à la main sur la base du .env.
- Interdit : `prisma db push` et `--accept-data-loss` contre la prod, `prisma migrate reset` hors base de dev, modifier une migration déjà appliquée.
