/* KSE BORDAR - Professional Service Worker v2 */

// 1. يجب تعريف المستمعين في البداية المطلقة للملف
self.addEventListener("message", (e) => { /* Silent */ });

// 2. استيراد مكتبة OneSignal
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (err) {
  console.error("SW: OneSignal import failed", err);
}

// 3. التعامل مع إشعارات النظام (Fallback)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { alert: event.data.text() };
  }

  // إذا كان الإشعار من OneSignal، نترك المكتبة تتعامل معه تماماً
  if (data.custom || data.hasOwnProperty('custom') || data.os_data) {
    console.log("SW: OneSignal push detected, bypassing custom handler.");
    return;
  }

  // إشعار يدوي (في حال فشل OneSignal في عرض المحتوى)
  const title = data.title || "إشعار جديد — أبو الأكبر";
  const options = {
    body: data.body || data.alert || "لديك طلب جديد ينتظر الإجراء.",
    icon: "/pwa-icon-192.png",
    badge: "/pwa-icon-192.png",
    vibrate: [500, 110, 500, 110, 450, 110, 200, 110],
    data: { url: data.url || "/" },
    requireInteraction: true,
    dir: 'rtl'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
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
