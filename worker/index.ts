/// <reference lib="webworker" />
// Code additionnel injecté dans le service worker par @ducanh2912/next-pwa (le cache Workbox reste géré par next.config.mjs).
declare const self: ServiceWorkerGlobalScope;

// Permet d'activer immédiatement une nouvelle version depuis l'app
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Fond de carte : l'ancien cache CARTO contient des tuiles filigrane « clé requise ». Purgé à l'activation ;
// le cache Stadia est versionné dans next.config.mjs (stadia-tiles-v1) : au prochain changement, ajouter l'ancien nom ici.
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all(["carto-tiles"].map((name) => caches.delete(name))));
});

// Notifications Web Push (lib/push/send.ts) : { title, body, url, tag } chiffré par le serveur, déchiffré par le navigateur.
type PushData = { title?: string; body?: string; url?: string; tag?: string };
self.addEventListener("push", (event) => {
  let d: PushData = {};
  try { d = event.data?.json() ?? {}; } catch { d = { body: event.data?.text() }; }
  const url = typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/";
  event.waitUntil(
    self.registration.showNotification(d.title || "Pulse", {
      body: d.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png", // silhouette blanche sur fond transparent : Android la teinte dans la barre d'état
      tag: d.tag || undefined, // même étiquette : remplace la notification précédente au lieu d'empiler
      renotify: !!d.tag, // …tout en vibrant de nouveau
      lang: "fr",
      data: { url },
    } as NotificationOptions),
  );
});

// Clic sur une notification : on réutilise un onglet / la PWA déjà ouverte (et on l'amène sur la bonne page), sinon on l'ouvre.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data?.url as string | undefined) ?? "/", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const same = wins.find((w) => w.url === target) ?? wins.find((w) => new URL(w.url).origin === self.location.origin);
    if (same) {
      const focused = await same.focus().catch(() => null);
      if (same.url !== target) await (focused ?? same).navigate(target).catch(() => self.clients.openWindow(target));
      return;
    }
    await self.clients.openWindow(target);
  })());
});
