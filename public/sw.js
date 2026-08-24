self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "Huellas Bariloche";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "Tenés una nueva alerta.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "huellas-alert",
    renotify: true,
    data: { url: data.url || "/panel" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/panel", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const windowClient of windows) {
      if (windowClient.url.startsWith(self.location.origin) && "focus" in windowClient) {
        windowClient.navigate(target);
        return windowClient.focus();
      }
    }
    return clients.openWindow(target);
  }));
});
