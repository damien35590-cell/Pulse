import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

const config: Config = {
  // lib/ inclus : les recettes de classes (lib/ui.ts) doivent être scannées.
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  // Automatique (réglage du téléphone) par défaut ; <html data-theme="light|dark"> force un thème. Les variantes dark: suivent ce choix.
  darkMode: ["variant", [
    "@media (prefers-color-scheme: dark) { &:where(:root:not([data-theme=light]), :root:not([data-theme=light]) *) }",
    "&:where([data-theme=dark], [data-theme=dark] *)",
  ]],
  // Les hover: ne s'appliquent qu'aux appareils qui survolent vraiment : plus d'état « collé » après un tap sur mobile.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        bg: c("bg"), surface: c("surface"), "surface-2": c("surface-2"), "surface-3": c("surface-3"),
        ink: c("ink"), "ink-soft": c("ink-soft"), "ink-mute": c("ink-mute"), line: c("line"),
        brand: c("brand"), "brand-ink": c("brand-ink"), "brand-text": c("brand-text"),
        tier: {
          bronze: { DEFAULT: c("tier-bronze"), soft: c("tier-bronze-soft"), ink: c("tier-bronze-ink") },
          silver: { DEFAULT: c("tier-silver"), soft: c("tier-silver-soft"), ink: c("tier-silver-ink") },
          gold: { DEFAULT: c("tier-gold"), soft: c("tier-gold-soft"), ink: c("tier-gold-ink") },
          diamond: { soft: c("tier-diamond-soft"), ink: c("tier-diamond-ink") },
          gem: c("tier-gem"),
        },
        good: c("good"), warn: c("warn"), bad: c("bad"),
        stack: { workout: c("stack-workout"), run: c("stack-run"), ride: c("stack-ride"), hike: c("stack-hike"), other: c("stack-other") },
        act: Object.fromEntries(["run", "strength", "ride", "hike", "other"].map((k) => [k, { DEFAULT: c(`act-${k}`), soft: `var(--act-${k}-soft)` }])),
        z1: c("z1"), z2: c("z2"), z3: c("z3"), z4: c("z4"), z5: c("z5"), z6: c("z6"),
        // Carte des muscles : 4 paliers (fill-muscle-1 … fill-muscle-4, bg-muscle-4…).
        muscle: Object.fromEntries(["1", "2", "3", "4"].map((k) => [k, c(`muscle-${k}`)])),
        // Bandes de visuel du fil : suivent le thème (bg-viz-strength-bg, text-viz-strength-ink, bg-viz-ride-bg…).
        viz: Object.fromEntries(["strength-bg", "strength-bar", "strength-bar-dim", "strength-ink", "strength-code", "target", "ride-bg", "ride-ink"].map((k) => [k, c(`viz-${k}`)])),
        // Art : toujours sombre, identique dans les deux thèmes (bg-art-run-bg, text-art-gym-fg, text-art-ink…).
        art: {
          "run-bg": c("art-run-bg"), "run-fg": c("art-run-fg"), "gym-bg": c("art-gym-bg"), "gym-fg": c("art-gym-fg"),
          ink: c("art-ink"), "ink-soft-run": c("art-ink-soft-run"), "ink-soft-gym": c("art-ink-soft-gym"),
        },
      },
      // text-brand, border-brand, ring-brand… prennent la variante lisible de la marque (le citron Volt
      // ne se lit pas sur fond blanc) ; bg-brand reste l'aplat citron.
      textColor: { brand: c("brand-text") },
      borderColor: { brand: c("brand-text") },
      outlineColor: { brand: c("brand-text") },
      ringColor: { brand: c("brand-text") },
      caretColor: { brand: c("brand-text") },
      stroke: { brand: c("brand-text"), act: Object.fromEntries(["run", "strength", "ride", "hike", "other"].map((k) => [k, c(`act-${k}`)])) },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "sans-serif"],
        // Chiffres : Barlow Semi Condensed, environ 20 % plus étroite qu’Inter à taille égale.
        num: ["var(--font-num)", "var(--font-body)", "system-ui", "sans-serif"],
      },
      fontSize: {
        label: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.06em", fontWeight: "600" }],
        micro: ["0.625rem", { lineHeight: "1rem" }],
        "metric-sm": ["1.0625rem", { lineHeight: "1.2", fontWeight: "600" }],
        "metric-md": ["1.375rem", { lineHeight: "1.1", fontWeight: "600" }],
        "metric-lg": ["1.75rem", { lineHeight: "1", letterSpacing: "-0.01em", fontWeight: "600" }],
        "metric-xl": ["2.5rem", { lineHeight: "1", letterSpacing: "-0.015em", fontWeight: "600" }],
        "metric-hero": ["3.5rem", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "600" }],
        // Art (components/art) : étiquette de l'EffortStrip, code d'exercice et total des SetBars.
        "art-label": ["2.75rem", { lineHeight: "1", letterSpacing: "-0.01em", fontWeight: "800" }],
        "art-code": ["1.125rem", { lineHeight: "1.2", fontWeight: "700" }],
        "art-total": ["0.875rem", { lineHeight: "1.2", fontWeight: "600" }],
        // Couvertures de la page Programme : distance de l'objectif (course), nom de la demi-séance (affiche muscu).
        "art-hero": ["5.5rem", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "800" }],
        "art-poster": ["3.25rem", { lineHeight: "0.95", letterSpacing: "-0.01em", fontWeight: "800" }],
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        bar: "calc(3.5rem + env(safe-area-inset-top))",
        nav: "calc(4rem + env(safe-area-inset-bottom))",
      },
      borderRadius: { tile: "0.875rem", card: "1.25rem", sheet: "1.75rem" },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "0 24px 48px -12px rgb(0 0 0 / 0.6)",
        // Halo discret, réservé à ce qui flotte (bouton + de la nav, carte « à valider »).
        glow: "0 6px 16px -8px rgb(var(--brand) / 0.35)",
      },
      transitionTimingFunction: { snappy: "cubic-bezier(.2,.8,.2,1)" },
      keyframes: {
        "sheet-in": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        pop: { "0%": { transform: "scale(.6)" }, "60%": { transform: "scale(1.12)" }, "100%": { transform: "scale(1)" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        // Carte des muscles : le corps se retourne (face ↔ dos).
        "body-turn": { from: { opacity: "0.3", transform: "scaleX(0.3)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "sheet-in": "sheet-in .28s cubic-bezier(.2,.8,.2,1)",
        pop: "pop .32s cubic-bezier(.2,.8,.2,1)",
        "fade-up": "fade-up .3s cubic-bezier(.2,.8,.2,1) both",
        "body-turn": "body-turn .26s cubic-bezier(.2,.8,.2,1)",
      },
    },
  },
  plugins: [
    // standalone:… = uniquement dans la PWA installée (ex. masquer l'invite d'installation).
    plugin(({ addVariant }) => addVariant("standalone", "@media (display-mode: standalone)")),
  ],
};
export default config;
