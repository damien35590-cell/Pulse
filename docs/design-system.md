# Design system Pulse

Référence pour toute nouvelle UI. Démo vivante : page `/ui-kit` (données fictives).
Cible : PWA installée sur Pixel, sombre par défaut, lisible en plein effort.

## Règles d'or

1. **Un chiffre se lit en 1 seconde.** Valeur en `font-num` + `tabular-nums`, unité plus petite et plus claire, libellé en petites capitales au-dessus.
2. **Résumé d'abord, analyse ensuite.** Une carte de fil = titre, 3 chiffres, 1 visuel compact, 1 phrase. Le reste va dans le détail.
3. **L'action principale est en bas**, dans la zone du pouce, en `h-14` minimum (`h-16` pendant une séance).
4. **Toute cible tactile fait au moins 48 px** (`size-12`), 56 px (`size-14`) pour la saisie en séance.
5. **Jamais de couleur en dur dans un composant** : uniquement les tokens ci-dessous (ils suivent le thème).
6. **Jamais `confirm()` / `alert()`** : `<ConfirmSheet>` / `<BottomSheet>` (`components/ui/bottom-sheet.tsx`).
7. **Toujours `cn()`** (`lib/utils.ts`) pour combiner des classes : il connaît les tailles et rayons du thème.
8. **L'art ne vit que sur des couvertures, des en-têtes et des bandes dérivées des données** : palette `art-*`, toujours sombre ; jamais derrière un chiffre, jamais dans une séance en direct (SetLogger), un graphique ou un `Metric`.

## Couleurs (tokens, `app/globals.css`)

| Token | Valeur sombre | Usage | Contraste sur `surface` |
|---|---|---|---|
| `bg` | #0A0A0C | fond de page (quasi noir, pas #000 : évite le flou OLED au défilement) | |
| `surface` | #141417 | cartes | |
| `surface-2` | #1E1E22 | contrôles, pistes de barres, état pressé | |
| `surface-3` | #2A2A30 | contrôle actif sur surface-2, feuille de confirmation | |
| `ink` | #F5F5F7 | valeurs, titres | 16,9:1 |
| `ink-soft` | #A1A1AA | unités, phrases | 7,2:1 |
| `ink-mute` | #8A8A95 | libellés, dates | 5,4:1 |
| `brand` | #C6F432 « Volt » (clair : #B8E62A) | aplat de l'action principale : bouton +, barres de niveau (`bg-brand`, une mise en avant par écran) | |
| `brand-ink` | #0A0A0C | texte sur fond citron, dans les deux thèmes (jamais de blanc sur Volt) | |
| `brand-text` | #C6F432 (clair : #4D7C0F) | utilisé automatiquement par `text-brand`, `border-brand`, `ring-brand`, `outline-brand`, `stroke-brand` : le citron ne se lit pas sur fond blanc | ≥ 5:1 |
| `good` / `warn` / `bad` | vert / ambre / rouge | progrès, vigilance, baisse | ≥ 4,9:1 |
| `act-run` / `-strength` / `-ride` / `-hike` / `-other` (+ `-soft`) | corail #FF8A5C (clair #D9561F), indigo #8E92FF (#5457E0), lagon #3FCADB (#0E8A9C), vert-bleu #45CBA2 (#1A8A66), `ink-mute` | types d'activité uniquement, via `lib/activity-style.ts` (`fg` / `soft` / `dot`) : tuile `size-12 rounded-tile bg-act-x-soft` + icône `text-act-x`, point `size-2` dans les filtres ; tuile pleine `size-10 rounded-tile bg-act-x` + icône `text-bg` (`dot`) en tête de fiche d'activité. `-soft` = 18 % (clair 14 %). Ne jamais réutiliser `z6` ni `good` ; pas de nage | icône / fond doux ≥ 3:1 |
| `z1` … `z6` | gris, bleu, vert, jaune, rouge, violet | zones cardio / puissance uniquement | |
| `art-run-bg` / `-run-fg` / `-gym-bg` / `-gym-fg` | #12233F, #5AA9FF, #2A1810, #FF8A3D | **Art** (règle 8) : fond et trait des couvertures course (bleu nuit) et muscu (brun). **Identiques en clair et en sombre.** Jamais Volt dans l'art |  |
| `art-ink` / `art-ink-soft-run` / `art-ink-soft-gym` | #F5F5F7, #C9D8F0, #F3D9C8 | texte sur une couverture d'art : étiquette, puis total en demi-teinte (course, muscu). Les zones y reprennent `z1`–`z6` | |
| `tier-bronze` / `-silver` / `-gold` (+ `-soft`, `-ink`) | bronze, argent, or | paliers de badges uniquement (`components/profile/tier-medal.tsx`) | |
| `bg-holo`, `bg-holo-ring`, `tier-gem`, `tier-diamond-soft/-ink` | dégradé holographique | palier Diamant : anneau animé autour d'une gemme sombre, le badge ultime | |

Thème clair : opt-in avec `<html data-theme="light">` (mêmes noms de tokens). Les variantes `dark:` s'appliquent dès que ce n'est pas le thème clair.

Règle des badges : la couleur d'un badge = son palier, jamais la marque. Barres de progression dans la teinte du **prochain** palier ;
pastilles atteintes pleines, non atteintes en simple contour ; filtre actif en `bg-ink text-bg`.

## Typographie

- Texte : Inter (`font-sans`). Chiffres : Barlow Semi Condensed (`font-num`), environ 20 % plus étroite qu'Inter (mesuré : 16 à 21 % selon les chiffres).
- Échelle des chiffres (graisse 600 : en sombre, le 700 « bave ») :
  `text-metric-hero` 56 · `text-metric-xl` 40 · `text-metric-lg` 28 · `text-metric-md` 22 · `text-metric-sm` 17.
- Libellés : `text-label uppercase text-ink-mute` (12 px, interlettrage 0,06em).
- Art (couvertures uniquement) : `text-art-label` 44 px 800 (étiquette d'EffortStrip), `text-art-code` 18 px 700 (code d'exercice), `text-art-total` 14 px 600 (total), tous en `font-num`.
- Micro : `text-micro` (10 px), réservé aux crédits des cartes (`<MapAttribution>`, voir Composants).
- Titres : grand titre de page 32 px bold (via `<TopBar>`), titre de section = `text-label uppercase text-ink-soft` (via `<Section>`).
- Pas de nouvelles tailles arbitraires `text-[13px]` : utiliser l'échelle.

## Formes

- Rayons : `rounded-tile` 14 px (contrôles), `rounded-card` 20 px (cartes), `rounded-t-sheet` 28 px (feuilles), `rounded-full` (boutons, pastilles).
- Cartes : `ui.card` = `rounded-card bg-surface shadow-card` (liseré clair en haut, pas de bordure grise).
- Ombres portées seulement sur ce qui flotte : `shadow-glow` (halo discret du bouton + de la nav, jamais sur un bouton posé dans une carte), `shadow-pop` (feuilles, menus).
- Espacement : `p-4` dans les cartes, `gap-3` entre cartes, `space-y-8` entre sections.

## Marque (`components/brand/logo.tsx`)

- **`<PulseMark size>`** : le symbole seul (battement de cœur Volt sur fond `bg-bg`). Pour les petits espaces et les rappels de marque : barre du haut, avatar d'app, état vide.
- **`<PulseLogo size>`** : symbole + mot-symbole « Pulse » (`font-num` 600, `text-ink`). Seulement là où l'on présente l'app : connexion, écran d'accueil, à propos. Jamais deux fois sur le même écran.
- **Taille minimale** : 16 px pour `PulseMark` (taille du favicon, encore lisible), 24 px pour `PulseLogo` (sinon le mot-symbole devient trop petit).
- **Zone de protection** : laisser vide autour du logo au moins ¼ de `size` (8 px pour un symbole de 32 px). Ne pas le coller à un bord de carte ni à un texte.
- **Uniquement les tokens** : trait `stroke-brand` (vire au vert foncé `--brand-text` en thème clair pour rester lisible), fond `bg-bg`. Pas de recoloration, de dégradé, d'ombre ni de déformation, et pas de SVG recopié à la main : toujours passer par ces composants.
- Fichiers sources dans `assets/brand/` (master, maskable, monochrome). Les icônes d'app (`app/icon.svg`, `favicon.ico`, `apple-icon.png`, `public/icons/*`) sont générées par `npm run icons` : modifier le SVG, relancer, committer le résultat.

## Recettes (`lib/ui.ts`)

`ui.card`, `ui.pressCard` (carte cliquable), `ui.label`, `ui.btnPrimary`, `ui.btnSecondary`, `ui.btnDanger`, `ui.iconBtn`, `ui.chip`.
Retour au toucher : `active:scale-[0.97]` (boutons), `active:scale-[0.985]` (cartes), `active:scale-90` (icônes), plus `tap()` de `lib/haptics.ts`.

## Composants

| Composant | Fichier | Quand |
|---|---|---|
| `TopBar` | `components/layout/top-bar.tsx` | en-tête de page : retour, grand titre repliable, actions ; `collapseAt` (titre affiché ailleurs : il entre dans la barre une fois cet élément passé dessous), `overlay` (barre transparente + léger dégradé sur une carte plein cadre) |
| `Section` | `components/ui/section.tsx` | bloc de page avec titre en capitales + action |
| `Metric`, `Delta` | `components/ui/metric.tsx` | toute valeur chiffrée (dans un `<dl>`) ; `<Delta tone>` : `good` / `warn` (à surveiller) / `bad` / `neutral` (dans la moyenne), ou `good` booléen |
| `Segmented` | `components/ui/segmented.tsx` | onglets (FC / puissance, filtres) |
| `SettingsRow` | `components/ui/settings-row.tsx` | ligne de réglage de la page Vous (et sous-pages) : pastille d’icône `bg-brand/10`, titre, résumé `ink-mute` tronqué, chevron ou contrôle à droite (`trailing`, ex. `Segmented`) ; `Link` si `href`, bouton si `onClick` ; empilée dans une `ui.card` (`divide-y divide-surface-2`), 56 px mini |
| `Switch` | `components/ui/switch.tsx` | réglage on / off : toute la ligne (libellé + phrase) est la cible, 56 px de haut |
| `BottomSheet`, `ConfirmSheet` | `components/ui/bottom-sheet.tsx` | choix, confirmation, fin de séance |
| `NumberStepper` | `components/ui/number-stepper.tsx` | saisie kg / reps : ±, appui long, clavier numérique |
| `Sparkline` | `components/ui/sparkline.tsx` | tendance sans axe |
| `ActivitySummary` | `components/dashboard/activity-summary.tsx` | carte d'activité du fil (accueil et liste Activités) : titre, 3 `<Metric>`, 1 visuel compact, 1 phrase `<InsightLine>` ; données construites par `summaryData` (`lib/activity/summary.ts`), comparaisons en une passe (`getActivityInsights`) |
| `InsightLine`, `INSIGHT_TONE` | `components/activity/insight-line.tsx` | la phrase de comparaison du fil, mêmes formulation et tonalités que la fiche (`insightLine`, `lib/activity/comparables.ts`) |
| `TodayCard`, `WeekCard`, `StatTile` | `components/dashboard/*` | accueil |
| `TraceChart` | `components/activity/trace-chart.tsx` | courbe au doigt (FC, altitude, puissance), bandes de zones ; axes optionnels (`yTicks`, `xTicks`), étiquette flottante (`tip`), `onCursor` |
| `ElevationChart` | `components/activity/elevation-chart.tsx` | profil d'altitude : D+ / D− / min / max, 3 graduations rondes en m (jamais depuis 0), 40 m d'écart vertical au moins, centrés (`spanAtLeast`) : le plat reste plat ; un repère par km |
| `RoutePreview` | `components/activity/route-preview.tsx` | vignette statique du tracé (fil) : tuiles Stadia Maps en `<img>` + SVG, aucune lib de carte ; trace simplifiée côté serveur (`previewTrack`, `lib/map/track.ts`) ; rien sans GPS |
| `ActivityHero` | `components/activity/activity-hero.tsx` | tête de fiche d'activité : carte Leaflet plein cadre (~40vh, gestes coopératifs, plein écran, pastille flottante Pente / Vitesse) sous une `TopBar` transparente (retour, crayon, « … »), carte `rounded-t-sheet` qui chevauche le bas de la carte (méta, titre, distance en `metric-hero`, 3 `Metric`, comparaison, pastille « Comment c'était ? »), puis `sections` (note du coach, allure par km, FC) et profil d'altitude au curseur partagé (`useTrackCursor`, `activity-track.tsx`). Sans GPS : barre normale, même carte. Ordre de la fiche : tête → note du coach → allure par km → FC → altitude → ressenti → « Partager » |
| note du coach | `lib/coach/activity-note.ts` | 1 à 2 phrases sous la tête de fiche, tirées de la doctrine et de la semaine (rang de la séance, prochaine séance du programme) ; gabarits déterministes, pas de LLM ; rien pour le vélotaf ni la marche ; carte `ui.card` masquée sans note |
| `HeartRate` | `components/activity/heart-rate.tsx` | section FC de la fiche : `TraceChart` sur bandes de zones + `ZoneBar` (`lib/activity/heart.ts`) ; masquée sans mesure |
| `FeelNote`, `FeelPrompt` | `components/activity/feelnote.tsx` | ressenti : humeur (choisie en couleur et légèrement agrandie, les autres atténuées), effort, `Metric` « Charge » (sRPE = RPE × minutes, `Activity.srpe`), notes ; enregistrement automatique + `tap()`. `FeelPrompt` : pastille en tête tant que humeur ou effort manquent |
| `RpePicker` | `components/activity/rpe-picker.tsx` | effort 1 à 10 sur une seule ligne : 10 pastilles, cibles de 48 px de haut sur toute leur part de largeur, dégradé `good → warn → bad` jusqu'à la valeur ; aussi sur l'écran d'enregistrement |
| `ShareActivity` | `components/activity/share-activity.tsx` | action principale de la fiche (`ui.btnPrimary`, bas de page) : Web Share API (titre, distance, durée, allure + lien), sinon copie + message |
| `ActivityMenu` | `components/activity/activity-menu.tsx` | « … » d'une fiche d'activité : `BottomSheet` → « Supprimer » → `ConfirmSheet` |
| comparaison | `lib/activity/comparables.ts` (+ `lib/data/activity-insight.ts`) | course seulement (route et trail ; ni marche ni rando) ; « tes footings / sorties longues / séances de seuil / VMA similaires » ; comparables = même sport, même genre de séance (programme, sinon déduit de l'intensité et de la distance), ±30 % de distance, 90 jours précédents, au moins 3 ; écart d'allure en s/km (neutre sous 3 s/km) ; 0 à 2 pastilles `ui.chip` vraies (record déjà calculé, plus longue du mois, rang dans la semaine) |
| `ZoneBar` | `components/activity/zone-bar.tsx` | temps par zone (`compact` pour une carte) |
| `Splits` | `components/activity/splits.tsx` | allure par km (calcul : `kmSplits`, `lib/activity/splits.ts`, pauses retirées, dernier bout ≥ 200 m), km le plus rapide discrètement en `ink` (pas de Volt) |
| `SetLogger` | `components/workout/set-logger.tsx` | séance de muscu en cours (repos entre séries et après exercice, `onSave` asynchrone, option « Enregistrer comme modèle ») |
| `PlusSheet` | `components/record/plus-sheet.tsx` | feuille du bouton « + » de la barre du bas : « Séance de musculation » (seul `ui.btnPrimary`, sous-titre = prochaine séance du programme actif, sinon « Choisir un modèle »), « Importer un fichier » (/import), « Synchroniser maintenant » (`POST /api/sync/now` : Intervals.icu + Google Fit sur 3 jours, une fois toutes les 5 min, `User.lastSyncAt`), puis « Saisie manuelle » discrète (/record) ; résultat en toast. Pas d’enregistrement GPS en direct |
| `NewSessionSheet`, `NewSessionButton` | `components/workout/new-session-sheet.tsx` | démarrer une séance : suggestion du jour (seule carte `bg-brand` de l'écran), refaire une séance, modèles, séance vide |
| `PrepScreen` | `components/workout/prep-screen.tsx` | préparer la séance : réordonner (flèches 48 px), modifier, retirer, ajouter ; « Démarrer » en `h-16` |
| `AddExerciseSheet` | `components/workout/add-exercise-sheet.tsx` | sélecteur d'exercices : recherche, filtres source / muscle / « Mon matériel », récents, familles Lafay → sous-catégories → variantes, fiche |
| `ExerciseDetail`, `CodeBadge`, `LevelBars` | `components/workout/catalog-bits.tsx` | fiche d'exercice du catalogue, pastille de code Lafay, niveau 1 à 4 barres (jamais en couleur de marque) |
| `LibrarySheet` | `components/workout/library-sheet.tsx` | bibliothèque de modèles (Lafay T1/T2, mes programmes, SuperPhysique) → « Ajouter à mes modèles » |
| `EquipmentSettings` | `components/profile/equipment-settings.tsx` | réglage « Matériel de muscu » (/vous/materiel-muscu) |
| `SessionFlow` | `components/workout/session-flow.tsx` | parcours `/record/session` : feuille → préparation → SetLogger → enregistrement ; reprise de la séance en cours |
| `ZoneRibbon` | `components/art/zone-ribbon.tsx` | art du fil : bande de 14 px collée sous la vignette de carte (ou seule pour un tour MyWhoosh), un tronçon par plage de même zone, largeur = part du temps, 2 px d'écart, `z1`–`z6`, `aria-hidden`. Données : `Activity.zoneRibbon` (`lib/art/zone-ribbon.ts`, ~40 tranches de durée égale) et sa source `zoneRibbonSource`, par priorité : FC (FC max saisie, sinon estimée par `lib/physio/hr-max.ts`) > puissance (vélo, FTP) > allure (course sans FC, zones en % de la VMA enregistrée : Z1 < 60, Z2 60–75, Z3 75–85, Z4 85–92, Z5 92–100, Z6 > 100). Calculé à l'import dans `processActivity` ; la tâche de nuit (`/api/cron/sync-intervals`) rattrape 50 rubans manquants ou périmés par nuit, et un changement de FC max (≥ 2 bpm), de FTP ou de VMA recalcule les rubans concernés par lots (`lib/data/zone-ribbon.ts`) ; `tools/calculer-rubans.ts --all` repart de zéro. Jamais le flux brut vers la liste |
| `EffortStrip` | `components/art/effort-strip.tsx` | art du fil : mêmes données dessinées en horizon, 96 px sur `art-run-bg`, hauteur par zone (26, 40, 54, 68, 82, 94 px). À la place de la vignette pour une sortie qui réalise une séance clé du programme (VMA, seuil) ou dont le ruban montre au moins 4 blocs durs (`lib/art/effort.ts`) ; étiquette (« 10×400 ») = titre court de la séance prévue liée, sinon aucune. La fiche garde la carte |
| `SetBars` | `components/art/set-bars.tsx` | art du fil pour la muscu, en tête de carte : 4 exercices au plus dans l'ordre de la séance, une barre de 11 px par série (reps, ou secondes pour un exercice au chrono), `art-gym-fg` sur `art-gym-bg`, pointillé à la cible du jour (`WorkoutExercise.reps`, repli : max de l'exercice), séries sous la cible à 50 %, code + total dessous. Données : `lib/art/set-bars.ts`. Jamais dans le SetLogger |
| choix de l'art | `lib/art/card.ts` | quel art pour quelle carte (course / vélo / rando : vignette + ruban, EffortStrip pour les séances clés ; muscu : SetBars ; le reste inchangé) |
| `RouteMap` | `components/activity/route-map.tsx` (+ `route-map-lazy.tsx`) | tracé Leaflet : `interactive={false}` pour une vignette, `pois`, `expandable` (plein écran) |
| fond de carte | `lib/map/basemap.ts` | toutes les cartes : Stadia Maps (`alidade_smooth_dark` en sombre, `alidade_bright` en clair, constante `BASEMAP` ; endpoint UE, auth par domaine : aucune clé) selon le thème, `useMapTheme()` ; jamais d'URL de tuiles en dur dans un composant |
| `MapAttribution` | `components/map/map-attribution.tsx` | crédits de toutes les cartes : « i » replié (zone tactile 32 px, `bg-surface/80 backdrop-blur text-ink-soft`), une ligne `text-micro` au toucher ; l'attribution Leaflet est désactivée (`attributionControl: false`) ; `inLink` dans le fil (pas de lien imbriqué) ; démo sur /ui-kit |
| `RouteCard` | `components/routes/route-card.tsx` | boucle proposée (Itinéraires) : nom, temps / km / D+, vignette, phrase « pourquoi » |
| `WeatherBanner`, `WeatherAlerts`, `WeatherCredit` | `components/routes/weather.tsx` | météo d'une sortie (ressenti, pluie, vent fléché, coucher), alertes en `warn` / `bad`, crédit Open-Meteo obligatoire (CC BY 4.0) |
| `PlacePicker` | `components/routes/place-picker.tsx` (+ `pick-map.tsx`) | choisir un lieu : recherche Photon, lieux récents, toucher sur la carte pour placer ou ajuster le point |
| `PoiIcon` | `components/routes/poi-icon.tsx` | pastille d'un point d'intérêt (liste ou repère de carte) |

## Comportement « appli native » (déjà global)

`app/globals.css` + `components/layout/native-feel.tsx` : pas de surbrillance au tap, pas de tirer-pour-rafraîchir,
pas de zoom au double tap, pas de sélection ni de menu au long-press (tactile uniquement), `hover:` actif seulement sur PC.

Règle exacte : dans `@media (pointer: coarse)`, `html, body, body *` reçoivent `user-select: none` + `-webkit-user-select: none`
+ `-webkit-touch-callout: none` ; `input`, `textarea`, `[contenteditable]` et la classe utilitaire **`.selectable`** (et ses
descendants) réactivent `user-select: text`. `native-feel.tsx` ajoute, toujours sur tactile, un `preventDefault()` sur
`contextmenu` et `selectstart` hors de ces mêmes zones (+ `[data-allow-menu]` pour le menu seul). Ne jamais mettre `select-text`
sur un composant : pour un texte à copier (code, identifiant…), poser `.selectable`. Sur PC (souris), la sélection reste possible.
Dans une zone qui défile à l'intérieur d'un écran : `overscroll-contain`. Sur une courbe interactive : `touch-pan-y`.
