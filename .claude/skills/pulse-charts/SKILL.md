---
name: pulse-charts
description: À utiliser pour tout graphique, tuile de statistique ou visualisation de données dans Pulse.
---

# Graphiques dans Pulse

Détails : docs/design-system.md. Démo vivante : page /ui-kit.

## 1. Réutiliser avant de créer
- Courbe au doigt (FC, altitude, puissance) : `TraceChart`, avec bandes de zones.
- Profil d'altitude : `ElevationChart`. Temps par zone : `ZoneBar` (`compact` dans une carte).
- Tendance sans axe : `Sparkline`. Allure par km : `Splits`.
- Valeur chiffrée : `Metric` dans un `<dl>`. Écart : `Delta`. Accueil : `StatTile`.
- Ne coder un nouveau graphique que si aucun de ceux-là ne convient.

## 2. Couleurs : tokens uniquement
- Jamais de couleur en dur. Tout suit le thème.
- Zones cardio ou puissance : `z1` à `z6`, et seulement pour les zones.
- Sports : `act-run`, `act-ride`, `act-strength`, `act-hike`, `act-other`, via `lib/activity-style.ts`.
- Progrès, vigilance, baisse : `good`, `warn`, `bad`.
- `brand` (Volt) : une seule mise en avant par écran.
- Ne jamais réutiliser `z6` ni `good` pour un sport.

## 3. Chiffres et texte
- Valeur en `font-num tabular-nums`, unité plus petite et plus claire.
- Échelle : `text-metric-sm` à `text-metric-hero`.
- Libellé : `text-label uppercase text-ink-mute`.
- Pas de nouvelle taille arbitraire.

## 4. Forme
- Résumé d'abord : titre, 3 chiffres, 1 visuel compact, 1 phrase.
- Pas d'axe quand une `Sparkline` suffit. Sinon 3 graduations rondes au plus.
- Altitude : jamais depuis 0, au moins 40 m d'écart vertical, centré. Le plat reste plat.
- Cartes : `ui.card`. Rayons : `rounded-card`, `rounded-tile`.

## 5. Tactile
- Courbe interactive : `touch-pan-y`. Zone qui défile : `overscroll-contain`.
- Cible tactile de 48 px au moins.

## 6. Thèmes
- Vérifier en sombre ET en clair (`data-theme="light"`).
- Le citron ne se lit pas sur blanc : utiliser `text-brand` (jamais une teinte en dur).
