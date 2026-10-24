import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pulse — Suivi sportif",
    short_name: "Pulse",
    description: "Course, vélo, rando et musculation : chaque séance suivie. Gratuit, sans pub.",
    lang: "fr",
    dir: "ltr",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#0A0A0C", // écran de lancement sombre : pas de flash blanc à l'ouverture
    theme_color: "#0A0A0C",
    categories: ["health", "fitness", "sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android adapte l'icône à la forme du launcher Pixel (cercle / squircle)
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      // icône thématique Android 13+
      { src: "/icons/monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
    ],
    shortcuts: [
      { name: "Enregistrer", short_name: "Enregistrer", url: "/record", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Mes activités", short_name: "Activités", url: "/activities", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
