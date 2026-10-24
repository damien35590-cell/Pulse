/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
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
          // Fond de carte CARTO (lib/map/basemap.ts) : vignettes du fil et cartes Leaflet.
          urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "carto-tiles",
            expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 14 },
            cacheableResponse: { statuses: [0, 200] },
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