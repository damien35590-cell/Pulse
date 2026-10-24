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
| `act-run` / `-strength` / `-ride` / `-hike` / `-other` (+ `-soft`) | corail #FF8A5C (clair #D9561F), indigo #8E92FF (#5457E0), lagon #3FCADB (#0E8A9C), vert-bleu #45CBA2 (#1A8A66), `ink-mute` | types d'activité uniquement, via `lib/activity-style.ts` (`fg` / `soft` / `dot`) : tuile `size-12 rounded-tile bg-act-x-soft` + icône `text-act-x`, point `size-2` dans les filtres. `-soft` = 18 % (clair 14 %). Ne jamais réutiliser `z6` ni `good` ; pas de nage | icône / fond doux ≥ 3:1 |
| `z1` … `z6` | gris, bleu, vert, jaune, rouge, violet | zones cardio / puissance uniquement | |
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
- Micro : `text-micro` (10 px), réservé aux mentions d'attribution des cartes (`text-ink-soft` sur pastille `bg-surface/70 backdrop-blur rounded-full px-1.5`, en bas à droite, 6 px de marge ; Leaflet : même rendu via `.leaflet-control-attribution` dans globals.css).
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
| `TopBar` | `components/layout/top-bar.tsx` | en-tête de page : retour, grand titre repliable, actions |
| `Section` | `components/ui/section.tsx` | bloc de page avec titre en capitales + action |
| `Metric`, `Delta` | `components/ui/metric.tsx` | toute valeur chiffrée (dans un `<dl>`) |
| `Segmented` | `components/ui/segmented.tsx` | onglets (FC / puissance, filtres) |
| `Switch` | `components/ui/switch.tsx` | réglage on / off : toute la ligne (libellé + phrase) est la cible, 56 px de haut |
| `BottomSheet`, `ConfirmSheet` | `components/ui/bottom-sheet.tsx` | choix, confirmation, fin de séance |
| `NumberStepper` | `components/ui/number-stepper.tsx` | saisie kg / reps : ±, appui long, clavier numérique |
| `Sparkline` | `components/ui/sparkline.tsx` | tendance sans axe |
| `ActivitySummary` | `components/dashboard/activity-summary.tsx` | carte d'activité du fil |
| `TodayCard`, `WeekCard`, `StatTile` | `components/dashboard/*` | accueil |
| `TraceChart` | `components/activity/trace-chart.tsx` | courbe au doigt (FC, altitude, puissance), bandes de zones ; axes optionnels (`yTicks`, `xTicks`), étiquette flottante (`tip`), `onCursor` |
| `ElevationChart` | `components/activity/elevation-chart.tsx` | profil d'altitude : D+ / D− / min / max, 3 graduations rondes en m (jamais depuis 0), un repère par km |
| `RoutePreview` | `components/activity/route-preview.tsx` | vignette statique du tracé (fil) : tuiles Stadia Maps en `<img>` + SVG, aucune lib de carte ; trace simplifiée côté serveur (`previewTrack`, `lib/map/track.ts`) ; rien sans GPS |
| `ActivityTrack` | `components/activity/activity-track.tsx` | fiche d'activité : carte Leaflet (gestes coopératifs, plein écran, Pente / Vitesse) + profil d'altitude au curseur partagé |
| `ZoneBar` | `components/activity/zone-bar.tsx` | temps par zone (`compact` pour une carte) |
| `Splits` | `components/activity/splits.tsx` | allure par km |
| `SetLogger` | `components/workout/set-logger.tsx` | séance de muscu en cours (repos entre séries et après exercice, `onSave` asynchrone, option « Enregistrer comme modèle ») |
| `NewSessionSheet`, `NewSessionButton` | `components/workout/new-session-sheet.tsx` | démarrer une séance : suggestion du jour (seule carte `bg-brand` de l'écran), refaire une séance, modèles, séance vide |
| `PrepScreen` | `components/workout/prep-screen.tsx` | préparer la séance : réordonner (flèches 48 px), modifier, retirer, ajouter ; « Démarrer » en `h-16` |
| `AddExerciseSheet` | `components/workout/add-exercise-sheet.tsx` | sélecteur d'exercices : recherche, filtres source / muscle / « Mon matériel », récents, familles Lafay → sous-catégories → variantes, fiche |
| `ExerciseDetail`, `CodeBadge`, `LevelBars` | `components/workout/catalog-bits.tsx` | fiche d'exercice du catalogue, pastille de code Lafay, niveau 1 à 4 barres (jamais en couleur de marque) |
| `LibrarySheet` | `components/workout/library-sheet.tsx` | bibliothèque de modèles (Lafay T1/T2, mes programmes, SuperPhysique) → « Ajouter à mes modèles » |
| `EquipmentSettings` | `components/profile/equipment-settings.tsx` | réglage « Mon matériel » (page Vous) |
| `SessionFlow` | `components/workout/session-flow.tsx` | parcours `/record/session` : feuille → préparation → SetLogger → enregistrement ; reprise de la séance en cours |
| `RouteMap` | `components/activity/route-map.tsx` (+ `route-map-lazy.tsx`) | tracé Leaflet : `interactive={false}` pour une vignette, `pois`, `expandable` (plein écran) |
| fond de carte | `lib/map/basemap.ts` | toutes les cartes : Stadia Maps (`alidade_smooth_dark` ou `alidade_smooth`, endpoint UE, auth par domaine : aucune clé) selon le thème, `useMapTheme()` ; jamais d'URL de tuiles en dur dans un composant |
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
