/// <reference lib="webworker" />
// Code additionnel injecté dans le service worker par @ducanh2912/next-pwa.
declare const self: ServiceWorkerGlobalScope;

// Permet d'activer immédiatement une nouvelle version depuis l'app
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Clic sur une notification (rappels d'objectifs, plus tard)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? "/"));
});
