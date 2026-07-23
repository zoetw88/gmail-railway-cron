self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Inbox Daily", body: "發現需要處理的緊急郵件。", url: "/" };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Inbox Daily", {
      body: payload.body || "發現需要處理的緊急郵件。",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag || "inbox-daily-urgent",
      renotify: true,
      data: { url: payload.url || "/" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/"));
});
