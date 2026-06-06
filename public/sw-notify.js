/* Enhanced Service Worker for Notifications - KSE BORDAR */

// إضافة مستمع الرسائل في البداية المطلقة لتجنب تحذير المتصفح
self.addEventListener("message", (event) => {
  console.log("SW: Message received", event.data);
});

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      if (data && (data.custom || data.alert || data.hasOwnProperty('custom'))) {
        return;
      }
    } catch (e) {}
  }

  const origin = self.location.origin;
  const icon = origin + "/pwa-icon-192.png";

  event.waitUntil(
    (async () => {
      let payload = { title: "إشعار جديد — أبو الأكبر", body: "لديك تحديث جديد في النظام.", url: origin + "/" };
      if (event.data) {
        try {
          const data = event.data.json();
          payload = { ...payload, ...data };
          if (data.alert) payload.body = data.alert;
        } catch (e) {
          payload.body = event.data.text();
        }
      }

      return self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: icon,
        badge: icon,
        vibrate: [500, 110, 500, 110, 450, 110, 200, 110],
        requireInteraction: true,
        data: { url: payload.url },
        dir: 'rtl',
        lang: 'ar'
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          return client.focus().then(() => {
             if (client.navigate) return client.navigate(url);
          });
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
