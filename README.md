# Pulse : votre suivi sportif personnel

Application web installable sur Android (PWA), pour une seule personne : course, vélo, randonnée, musculation. Gratuite et sans publicité.

**Il vous faut** : un ordinateur (une seule fois, pour la mise en ligne, environ 30 minutes), votre Pixel, et trois comptes gratuits : GitHub, Neon et Vercel. À la date de ce guide, ces services proposent des offres gratuites suffisantes pour un usage personnel. Vérifiez leurs conditions actuelles avant de vous lancer.

## 1. La base de données (Neon)

1. Créez un compte sur neon.tech, puis un projet (région proche de chez vous, par exemple Francfort).
2. Cliquez sur **Connect**. Désactivez l'option **Pooled connection**.
3. Copiez l'adresse qui commence par `postgresql://`. Gardez-la de côté : elle ira dans `DATABASE_URL` **et** dans `DIRECT_URL`.

## 2. Le code (GitHub)

1. Créez un compte sur github.com, puis un **dépôt privé** (New repository).
2. Dézippez `pulse.zip` sur votre ordinateur.
3. Dans le dépôt : **uploading an existing file**, puis glissez tout le contenu du dossier `pulse` (les fichiers et les dossiers, pas le zip). Si GitHub refuse à cause du nombre de fichiers, envoyez en deux fois, puis validez avec **Commit changes**.

## 3. La mise en ligne (Vercel)

1. Créez un compte sur vercel.com en vous connectant avec GitHub.
2. **Add New… > Project**, choisissez votre dépôt, laissez les réglages par défaut.
3. Avant de cliquer sur Deploy, ouvrez **Environment Variables** et ajoutez :

| Nom | Valeur |
|---|---|
| `DATABASE_URL` | l'adresse Neon |
| `DIRECT_URL` | la même adresse Neon |
| `ALLOWED_EMAIL` | votre adresse e-mail |
| `APP_PASSWORD` | un mot de passe long et unique, que vous choisissez |
| `NEXTAUTH_SECRET` | 32 caractères aléatoires ou plus (générateur de mots de passe) |

4. Cliquez sur **Deploy**. Le premier déploiement crée aussi les tables de la base : comptez quelques minutes.
5. Quand c'est fini, copiez l'adresse publique (du type `https://pulse-xxxx.vercel.app`). Ajoutez la variable `NEXTAUTH_URL` avec cette adresse, puis relancez le déploiement (**Deployments > ... > Redeploy**).

## 4. L'installer sur le Pixel

1. Ouvrez l'adresse dans **Chrome** sur votre téléphone, connectez-vous avec votre mot de passe.
2. Touchez **Installer** dans le bandeau de l'accueil, ou le menu ⋮ de Chrome puis **Installer l'application**.
3. L'icône Pulse apparaît sur l'écran d'accueil. L'app s'ouvre alors en plein écran. Les sorties déjà consultées restent lisibles hors connexion.

## 5. Vos données Strava et MyWhoosh

- **Strava** : sur le site (pas l'application), Paramètres > Mon compte > « Télécharger ou supprimer votre compte » > demandez votre archive. Elle arrive par e-mail. Vous obtenez un ZIP.
- **MyWhoosh** : si votre compte est relié à Strava, ses sorties sont déjà dans l'archive Strava. Sinon, téléchargez les fichiers FIT depuis votre compte MyWhoosh.
- Dans Pulse : `/import` (ou « Importer » depuis l'app), choisissez le ZIP ou les fichiers, puis **Enregistrer**. Les doublons sont ignorés. Une grosse archive passe mieux depuis l'ordinateur que depuis le téléphone.

## En cas de souci

- **Le déploiement échoue** : dans Vercel, ouvrez le déploiement et lisez la fin du journal (Build Logs). Le message indique en général la variable manquante.
- **« Mot de passe incorrect »** : vérifiez `APP_PASSWORD` et `ALLOWED_EMAIL`, puis relancez un déploiement après toute modification.
- **Boucle de connexion** : `NEXTAUTH_URL` doit être exactement l'adresse publique, en `https`.
- **Mise à jour de l'app** : modifier un fichier dans GitHub relance automatiquement un déploiement.
- **Sauvegarde** : Neon garde un historique court sur l'offre gratuite. Exportez vos activités de temps en temps si elles comptent pour vous.

## Technique

Next.js 14, Prisma, PostgreSQL, NextAuth (mot de passe, Google en option), Recharts, Leaflet, PWA via `@ducanh2912/next-pwa`. Le projet n'a pas été compilé avant livraison : les erreurs de typage sont ignorées au build (`next.config.mjs`) pour ne pas bloquer le déploiement.

## 6. Synchro automatique MyWhoosh (sans rien télécharger)

MyWhoosh n'a pas d'API publique. La voie propre : MyWhoosh envoie vos séances à **Intervals.icu** (compte gratuit), et Pulse les y récupère une fois par jour, avec le fichier original (puissance, cardio).

1. Créez un compte sur intervals.icu et reliez-y MyWhoosh (cherchez MyWhoosh dans les connexions d'Intervals.icu, ou Intervals.icu dans les connexions de l'app MyWhoosh).
2. Dans Intervals.icu : Settings > Developer Settings > **Create API Key**. Copiez la clé.
3. Dans Vercel (Settings > Environment Variables), ajoutez :
   - `INTERVALS_API_KEY` : la clé copiée ;
   - `CRON_SECRET` : 32 caractères aléatoires ou plus.
   Puis redéployez.
4. C'est tout : chaque nuit (vers minuit), Pulse récupère vos nouvelles séances. Pour ne pas attendre, ouvrez la page Importer et touchez **Synchroniser maintenant**.

Limite : une séance qui n'arrive dans Intervals.icu que par Strava n'a pas de fichier original : Pulse ne peut pas la lire.

### Option B : script sur le PC (si MyWhoosh enregistre ses fichiers en local)
`tools\trouver-fit.ps1` (clic droit, Exécuter avec PowerShell) liste les `.fit` modifiés ces 3 dernières heures. Si un dossier apparaît, renseignez-le dans `tools\lancer-pulse-sync.bat` (variable `INGEST_TOKEN` dans Vercel). Le script vérifie le dossier toutes les 10 minutes.
