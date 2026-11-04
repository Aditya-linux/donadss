self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  event.waitUntil(self.registration.showNotification(data.title || "DONADS action needed", {
    body: data.body || "Open DONADS to review a task checkpoint.",
    icon: "/brand/donads-mascot-tile.png",
    badge: "/brand/donads-mascot-tile.png",
    tag: data.tag || "donads-action",
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    return existing ? existing.focus() : clients.openWindow(target);
  }));
});
