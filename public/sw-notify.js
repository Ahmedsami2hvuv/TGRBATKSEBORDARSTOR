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
    url: origin + "/",
    tag: "kse-general-alert",
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
        // إذا كانت النغمة 'phone' نستخدم اهتزازاً طويلاً جداً يشبه الرنين
        vibrate: payload.sound === 'phone'
          ? [1000, 500, 1000, 500, 1000, 500, 1000]
          : [500, 110, 500, 110, 450, 110, 200, 110],
        renotify: true, // يضمن الاهتزاز حتى لو كان هناك إشعار سابق
        requireInteraction: true, // يبقى الإشعار ظاهراً حتى يتفاعل معه المستخدم
        silent: false, // التأكد من عدم صمت الإشعار
        data: { url: payload.url },
        dir: 'rtl',
        lang: 'ar',
        actions: [
          { action: 'open', title: 'فتح الآن ✅' },
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

  // تحويل الرابط النسبي إلى مطلق للتأكد من صحة التوجيه
  let targetUrl;
  try {
    targetUrl = new URL(rawUrl, self.location.origin).href;
  } catch (err) {
    targetUrl = self.location.origin + "/";
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      // البحث عن نافذة مفتوحة بالفعل للموقع
      for (const client of windowClients) {
        // نركز على أي نافذة تابعة للموقع، وسنقوم بتوجيهها للرابط الجديد
        if (client.url.startsWith(self.location.origin)) {
          if ("navigate" in client) {
            try {
              // إذا كان العميل موجوداً بالفعل على نفس الرابط، نكتفي بالتركيز عليه
              if (client.url !== targetUrl) {
                await client.navigate(targetUrl);
              }
            } catch (e) {
              console.error("Navigation failed:", e);
            }
          }
          if ("focus" in client) {
            await client.focus();
          }
          return;
        }
      }

      // إذا لم تكن هناك نافذة مفتوحة، نفتح واحدة جديدة
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
