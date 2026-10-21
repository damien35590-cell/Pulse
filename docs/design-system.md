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
| `brand` | #FC4C02 | action principale, lien, mise en avant (une seule par écran) | 5,4:1 |
| `brand-ink` | #0A0A0C | texte sur fond orange (5,8:1 ; le blanc ne fait que 3,4:1) | |
| `good` / `warn` / `bad` | vert / ambre / rouge | progrès, vigilance, baisse | ≥ 4,9:1 |
| `z1` … `z6` | gris, bleu, vert, jaune, rouge, violet | zones cardio / puissance uniquement | |

Thème clair : opt-in avec `<html data-theme="light">` (mêmes noms de tokens). Les variantes `dark:` s'appliquent dès que ce n'est pas le thème clair.

## Typographie

- Texte : Inter (`font-sans`). Chiffres : Barlow Semi Condensed (`font-num`), environ 20 % plus étroite qu'Inter (mesuré : 16 à 21 % selon les chiffres).
- Échelle des chiffres (graisse 600 : en sombre, le 700 « bave ») :
  `text-metric-hero` 56 · `text-metric-xl` 40 · `text-metric-lg` 28 · `text-metric-md` 22 · `text-metric-sm` 17.
- Libellés : `text-label uppercase text-ink-mute` (12 px, interlettrage 0,06em).
- Titres : grand titre de page 32 px bold (via `<TopBar>`), titre de section = `text-label uppercase text-ink-soft` (via `<Section>`).
- Pas de nouvelles tailles arbitraires `text-[13px]` : utiliser l'échelle.

## Formes

- Rayons : `rounded-tile` 14 px (contrôles), `rounded-card` 20 px (cartes), `rounded-t-sheet` 28 px (feuilles), `rounded-full` (boutons, pastilles).
- Cartes : `ui.card` = `rounded-card bg-surface shadow-card` (liseré clair en haut, pas de bordure grise).
- Ombres portées seulement sur ce qui flotte : `shadow-glow` (bouton principal), `shadow-pop` (feuilles, menus).
- Espacement : `p-4` dans les cartes, `gap-3` entre cartes, `space-y-8` entre sections.

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
| `TraceChart` | `components/activity/trace-chart.tsx` | courbe au doigt (FC, altitude, puissance), bandes de zones |
| `ZoneBar` | `components/activity/zone-bar.tsx` | temps par zone (`compact` pour une carte) |
| `Splits` | `components/activity/splits.tsx` | allure par km |
| `SetLogger` | `components/workout/set-logger.tsx` | séance de muscu en cours |
| `RouteMap` | `components/activity/route-map.tsx` (+ `route-map-lazy.tsx`) | tracé Leaflet : `interactive={false}` pour une vignette, `pois`, `expandable` (plein écran) |
| `RouteCard` | `components/routes/route-card.tsx` | boucle proposée (Itinéraires) : nom, temps / km / D+, vignette, phrase « pourquoi » |
| `WeatherBanner`, `WeatherAlerts`, `WeatherCredit` | `components/routes/weather.tsx` | météo d'une sortie (ressenti, pluie, vent fléché, coucher), alertes en `warn` / `bad`, crédit Open-Meteo obligatoire (CC BY 4.0) |
| `PlacePicker` | `components/routes/place-picker.tsx` (+ `pick-map.tsx`) | choisir un lieu : recherche Photon, lieux récents, toucher sur la carte pour placer ou ajuster le point |
| `PoiIcon` | `components/routes/poi-icon.tsx` | pastille d'un point d'intérêt (liste ou repère de carte) |

## Comportement « appli native » (déjà global)

`app/globals.css` + `components/layout/native-feel.tsx` : pas de surbrillance au tap, pas de tirer-pour-rafraîchir,
pas de zoom au double tap, pas de sélection ni de menu au long-press (tactile uniquement), `hover:` actif seulement sur PC.
Dans une zone qui défile à l'intérieur d'un écran : `overscroll-contain`. Sur une courbe interactive : `touch-pan-y`.
