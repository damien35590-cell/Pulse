/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  // Ancienne route /profile → /vous (anciens liens, notifications déjà envoyées). Les réglages sont éclatés en sous-pages.
  async redirects() {
    return [
      { source: "/profile/settings", destination: "/vous", permanent: false },
      { source: "/profile", destination: "/vous", permanent: false },
      { source: "/profile/:path*", destination: "/vous/:path*", permanent: false },
    ];
  },
  images: { formats: ["image/avif", "image/webp"] },
  experimental: { optimizePackageImports: ["lucide-react", "recharts", "framer-motion"] },
};

// On utilise une fonction asynchrone pour pouvoir importer la PWA dynamiquement
export default async () => {
  // En mode développement (local), on retourne la config Next.js normale SANS jamais importer la PWA
  if (process.env.NODE_ENV === "development") {
    return nextConfig;
  }

  // En production (Vercel), on importe le module PWA à la volée
  const withPWAInit = (await import("@ducanh2912/next-pwa")).default;
  
  const withPWA = withPWAInit({
    dest: "public",
    register: true,
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    fallbacks: { document: "/~offline" },
    workboxOptions: {
      skipWaiting: true,
      clientsClaim: true,
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.startsWith("/api/activities"),
          handler: "NetworkFirst",
          options: {
            cacheName: "api-activities",
            networkTimeoutSeconds: 4,
            expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        },
        {
          urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "osm-tiles",
            expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 14 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // Fond de carte Stadia Maps (lib/map/basemap.ts) : vignettes du fil et cartes Leaflet.
          // Nom versionné : worker/index.ts supprime les anciens caches à l'activation. Seules les réponses 200 sont gardées
          // (jamais d'erreur ni de tuile filigrane « clé requise »).
          urlPattern: /^https:\/\/tiles-eu\.stadiamaps\.com\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "stadia-tiles-v2",
            expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 14 },
            cacheableResponse: { statuses: [200] },
          },
        },
        {
          urlPattern: /\.(?:png|jpg|jpeg|webp|avif|svg)$/i,
          handler: "StaleWhileRevalidate",
          options: { cacheName: "images", expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 } },
        },
      ],
    },
  });

  return withPWA(nextConfig);
};