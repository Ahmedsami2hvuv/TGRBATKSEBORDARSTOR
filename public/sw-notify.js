/* Enhanced Service Worker for Notifications - KSE BORDAR */

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// إضافة مستمع الرسائل في البداية لتجنب تحذير المتصفح
self.addEventListener("message", (event) => {
  // يمكن استخدامه لاحقاً للتحكم في الـ Worker من التطبيق
});

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  // إذا كان الإشعار قادماً من OneSignal، نترك OneSignalSDK.sw.js يتعامل معه بالكامل لمنع التكرار
  if (event.data) {
    try {
      const data = event.data.json();
      if (data && (data.custom || data.alert || data.hasOwnProperty('custom'))) {
        console.log("OneSignal push event detected. Handled by OneSignal SDK.");
        return;
      }
    } catch (e) {
      // ignore
    }
  }

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
            // إذا كان الإشعار قادماً من OneSignal، فإن نص الرسالة يكون في الحقل alert أو custom
            if (data.alert && !data.body) {
              payload.body = data.alert;
            }
            if (data.custom && data.custom.a && data.custom.a.url) {
              payload.url = data.custom.a.url;
            }
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
  const data = event.notification.data || {};
  
  event.notification.close();

  if (event.action === 'close') return;

  // استخراج الرابط بشكل مرن لدعم كلاً من VAPID و OneSignal
  let rawUrl = "/";
  if (data.url) {
    rawUrl = data.url;
  } else if (data.custom) {
    let customObj = data.custom;
    if (typeof customObj === 'string') {
      try {
        customObj = JSON.parse(customObj);
      } catch (e) {}
    }
    if (customObj && typeof customObj === 'object') {
      if (customObj.u) {
        rawUrl = customObj.u;
      } else if (customObj.a && customObj.a.url) {
        rawUrl = customObj.a.url;
      }
    }
  }

  // إذا كان الإشعار من ون سيجنال، نمنع انتشار الحدث لمنع تعارض مكاتب ون سيجنال أو فتح نافذة مكررة
  if (data.custom || data.hasOwnProperty('custom')) {
    console.log("OneSignal notification click intercepted and handled by custom SW.");
    event.stopImmediatePropagation();
  }

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
