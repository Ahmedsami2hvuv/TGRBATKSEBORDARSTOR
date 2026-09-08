/* KSE BORDAR - Service Worker - Stable v4 */

// 1. استيراد مكتبة OneSignal في بداية الملف فوراً للتقييم الأولي للـ Worker
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (e) {
  console.error("SW: OS Import Error", e);
}

// 2. تعريف المستمعين فوراً بعد الاستيراد
self.addEventListener("message", (e) => { });

// 3. مستمع الإشعارات - إجبار عرض الإشعار بالكامل
self.addEventListener("push", (event) => {
  console.log("SW: Push received", event);

  let payload = {
    title: "طلب جديد — أبو الأكبر",
    body: "لديك تحديث جديد في النظام، اضغط للمتابعة.",
    url: "/"
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload.title = data.title || data.headings?.ar || payload.title;
      payload.body = data.alert || data.contents?.ar || data.body || payload.body;
      payload.url = data.url || (data.custom && data.custom.u) || payload.url;
    } catch (e) {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: "/pwa-icon-192.png",
    badge: "/pwa-icon-192.png",
    vibrate: [500, 110, 500, 110, 450, 110, 200, 110],
    data: { url: payload.url },
    requireInteraction: true,
    dir: 'rtl',
    lang: 'ar'
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin)) {
          return client.focus().then(() => {
            if (client.navigate) return client.navigate(targetUrl);
          });
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
