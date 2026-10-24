# Pulse

## UI

Toute interface suit docs/design-system.md : tokens Tailwind, composants de components/ui, cn() de lib/utils, démo sur /ui-kit.

Graphiques et visualisations de données : utiliser le skill `pulse-charts` et les composants existants ; ne pas charger le skill intégré `dataviz`.

## Base de données (Prisma + Neon)

Le schéma évolue uniquement par migrations versionnées dans prisma/migrations/.

- Changer le schéma : modifier prisma/schema.prisma, puis `npm run db:migrate -- --name <description>` (prisma migrate dev) contre une base de dev, jamais la prod. Committer le dossier de migration créé avec le changement de schéma.
- Base de dev : une branche Neon « dev », dans .env ET .env.local (Prisma CLI lit .env, Next lit .env.local). L'adresse de prod n'existe que dans les variables Production de Vercel. `migrate dev` peut proposer de réinitialiser la base en cas d'écart : à refuser si l'adresse n'est pas celle de la branche de dev.
- Prod : le build lance `prisma migrate deploy` seulement si VERCEL_ENV=production (scripts/migrate-deploy.mjs) ; previews et builds locaux n'y touchent pas. migrate deploy applique seulement les migrations committées et ne supprime rien. `npm run db:deploy` l'applique à la main sur la base du .env.
- Scripts de maintenance (tools/*.ts qui écrivent en base) : par défaut sur la base de dev. Pour la prod, récupérer ses variables le temps d'une commande puis les supprimer (projet lié une fois avec `vercel link`) :
  ```
  vercel env pull .env.production.local --environment=production
  node --env-file=.env.production.local --import tsx tools/<script>.ts --dry-run
  rm .env.production.local
  ```
  Toujours un `--dry-run` d'abord quand le script le propose. Les variables passées par `--env-file` priment sur .env / .env.local. Le fichier est ignoré par git (`.env*.local`), mais ne doit pas rester sur le disque.
- Interdit : `prisma db push` et `--accept-data-loss` contre la prod, `prisma migrate reset` hors base de dev, modifier une migration déjà appliquée.
