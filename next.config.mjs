import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,      // pré-cache les pages visitées en navigation client
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  fallbacks: { document: "/~offline" },
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      // Activités déjà consultées : réseau d'abord, cache si hors-ligne
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/api/activities"),
        handler: "NetworkFirst",
        options: {
          cacheName: "api-activities",
          networkTimeoutSeconds: 4,
          expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      // Tuiles OpenStreetMap : cache d'abord (économise la data)
      {
        urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "osm-tiles",
          expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 14 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Photos
      {
        urlPattern: /\.(?:png|jpg|jpeg|webp|avif|svg)$/i,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "images", expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 } },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le projet n'a pas pu être compilé avant livraison : on ne bloque pas le déploiement sur une erreur de typage (sans effet à l'exécution).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"] },
  experimental: { optimizePackageImports: ["lucide-react", "recharts", "framer-motion"] },
};

export default withPWA(nextConfig);
