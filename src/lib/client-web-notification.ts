/**
 * إشعارات شريط النظام (الهاتف/الحاسوب) عبر Service Worker حيث يُدعم ذلك.
 * يجب استدعاؤه من عميل فقط ("use client").
 */

const SW_PATH = "/sw-notify.js";

export function getPwaIconUrl(): string {
  if (typeof window === "undefined") return "/pwa-icon-192.png";
  return `${window.location.origin}/pwa-icon-192.png`;
}

/** تسجيل عام — يُفضّل مبكراً ليكون جاهزاً عند أول طلب إشعار */
export async function registerNotifyServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null;
  }
}

function toAbsoluteUrl(openUrl: string): string {
  if (typeof window === "undefined") return openUrl.startsWith("http") ? openUrl : openUrl;
  if (openUrl.startsWith("http")) return openUrl;
  const path = openUrl.startsWith("/") ? openUrl : `/${openUrl}`;
  return `${window.location.origin}${path}`;
}

async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing?.active) return existing;
    const fresh = await registerNotifyServiceWorker();
    return fresh?.active ? fresh : null;
  } catch {
    return null;
  }
}

/**
 * يعرض إشعاراً في شريط النظام (قائمة إشعارات الهاتف/التطبيقات) ويفتح `openUrl` عند النقر.
 * تجنّب `silent: true` على الجوال إن أردت ظهوراً حقيقياً في الشريط — يقلّل أولوية الإشعار أو يخفيه.
 */
export async function showTrayNotification(options: {
  title: string;
  body: string;
  tag: string;
  /** مسار نسبي من أصل الموقع أو رابط مطلق */
  openUrl: string;
  iconUrl?: string;
  /** الافتراضي false — صوت/اهتزاز حسب إعدادات النظام للقناة */
  silent?: boolean;
}): Promise<void> {
  const { title, body, tag, openUrl, iconUrl, silent = false } = options;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const icon = iconUrl ?? getPwaIconUrl();
  const dataUrl = toAbsoluteUrl(openUrl);

  const reg = await readyRegistration();
  if (reg && typeof reg.showNotification === "function") {
    try {
      const swNote = {
        body,
        tag,
        icon,
        badge: icon,
        data: { url: dataUrl },
        silent,
        vibrate: [200, 100, 200] as number[],
        lang: "ar",
        dir: "rtl" as NotificationDirection,
      };
      await reg.showNotification(title, swNote as NotificationOptions);
      return;
    } catch {
      /* fallback */
    }
  }

  try {
    const n = new Notification(title, {
      body,
      tag,
      icon,
      silent,
      lang: "ar",
      dir: "rtl",
    });
    n.onclick = () => {
      window.focus();
      window.location.assign(dataUrl);
    };
  } catch {
    /* ignore */
  }
}

/** تسجيل + طلب الإذن — نفّذ من نقر المستخدم */
export async function registerSwAndRequestNotificationPermission(): Promise<NotificationPermission> {
  await registerNotifyServiceWorker();
  if (!("Notification" in window)) return "denied";
  return Notification.requestPermission();
}
