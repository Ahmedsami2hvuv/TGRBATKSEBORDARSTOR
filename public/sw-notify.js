/* Enhanced Service Worker for Notifications - KSE BORDAR */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const origin = self.location.origin;
  const icon = origin + "/pwa-icon-192.png";

  const defaults = {
    title: "إشعار جديد — أبو الأكبر",
    body: "لديك تحديث جديد في النظام، اضغط للمتابعة.",
    url: origin + "/mandoub",
    tag: "kse-order-alert",
  };

  event.waitUntil(
    (async () => {
      let payload = { ...defaults };
      if (event.data) {
        try {
          const data = event.data.json();
          if (data && typeof data === "object") {
            payload = { ...payload, ...data };
          }
        } catch (e) {
          payload.body = event.data.text() || defaults.body;
        }
      }

      // خيارات الإشعار المتقدمة
      const options = {
        body: payload.body,
        tag: payload.tag, // التاج يمنع تكرار الإشعارات المزعجة لنفس الطلب
        icon: icon,
        badge: icon, // الأيقونة الصغيرة في شريط الحالة (أندرويد)
        vibrate: [500, 110, 500, 110, 450, 110, 200, 110], // نمط اهتزاز تنبيهي قوي
        renotify: true, // يضمن الاهتزاز حتى لو كان هناك إشعار سابق
        requireInteraction: true, // يبقى الإشعار ظاهراً حتى يتفاعل معه المستخدم
        data: { url: payload.url },
        dir: 'rtl',
        lang: 'ar',
        // إضافة أزرار سريعة داخل الإشعار
        actions: [
          { action: 'open', title: 'فتح الطلب ✅' },
          { action: 'close', title: 'تجاهل' }
        ]
      };

      return self.registration.showNotification(payload.title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const data = event.notification.data || {};
  const rawUrl = data.url || "/";

  let targetUrl;
  try {
    targetUrl = rawUrl.startsWith("http") ? rawUrl : new URL(rawUrl, self.location.origin).href;
  } catch {
    targetUrl = self.location.origin + "/";
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              /* ignore navigate failure */
            }
          }
          if ("focus" in client) {
            await client.focus();
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
