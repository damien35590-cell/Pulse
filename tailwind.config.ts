import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"), surface: c("surface"), "surface-2": c("surface-2"),
        ink: c("ink"), "ink-soft": c("ink-soft"), line: c("line"),
        brand: c("brand"), "brand-ink": c("brand-ink"),
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "sans-serif"],
      },
      spacing: {
        "nav": "calc(4.5rem + env(safe-area-inset-bottom))",
      },
    },
  },
  plugins: [],
};
export default config;
