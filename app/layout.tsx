import type { Metadata, Viewport } from "next";
import { Barlow_Semi_Condensed, Inter } from "next/font/google";
import { NativeFeel } from "@/components/layout/native-feel";
import "./globals.css";

// Texte : Inter avec l'axe optique (variante « Display » automatique sur les grands titres).
const body = Inter({ subsets: ["latin"], axes: ["opsz"], variable: "--font-body", display: "swap" });
// Chiffres : Barlow Semi Condensed, dessinée d'après la signalétique routière (lisible vite et de loin).
const num = Barlow_Semi_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-num", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Pulse", template: "%s · Pulse" },
  description: "Suivi sportif gratuit et sans pub.",
  applicationName: "Pulse",
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: "Pulse", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // contenu sous la barre d'état / la barre de gestes du Pixel : les safe areas sont gérées en CSS
  interactiveWidget: "resizes-content", // le clavier Android réduit la page : les boutons du bas restent au-dessus du clavier
  themeColor: "#0A0A0C",
  colorScheme: "light dark",
};

// Exécuté avant l'affichage : applique le thème forcé sans flash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("pulse-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${body.variable} ${num.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans">
        <NativeFeel />
        {children}
      </body>
    </html>
  );
}
