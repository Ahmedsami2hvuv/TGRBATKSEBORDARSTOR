"use client";

import { registerNotifyServiceWorker } from "@/lib/client-web-notification";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type WebPushAudience = "admin" | "mandoub" | "employee" | "customer";

/**
 * يشترك في Web Push ليصل إشعار نظام الهاتف حتى عند إغلاق المتصفح.
 * يتطلّب VAPID على الخادم وإذن الإشعارات.
 */
export async function subscribeDeviceToWebPush(options: {
  audience: WebPushAudience;
  mandoub?: { c: string; exp?: string; s: string };
  portal?: { e: string; exp?: string; s: string };
  customer?: { customerId: string; sig: string };
}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const res = await fetch("/api/push/vapid-public", { cache: "no-store" });
  const data = (await res.json()) as { publicKey: string | null; configured?: boolean };
  if (!data.publicKey) return false;

  const reg = await registerNotifyServiceWorker();
  if (!reg) return false;

  let sub = await reg.pushManager.getSubscription();
  const key = urlBase64ToUint8Array(data.publicKey);
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key as BufferSource,
      });
    } catch {
      return false;
    }
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const payload: Record<string, unknown> = {
    subscription: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    },
    audience: options.audience,
  };
  if (options.audience === "mandoub" && options.mandoub) {
    payload.mandoub = {
      c: options.mandoub.c,
      ...(options.mandoub.exp ? { exp: options.mandoub.exp } : {}),
      s: options.mandoub.s,
    };
  }
  if (options.audience === "employee" && options.portal) {
    payload.portal = {
      e: options.portal.e,
      ...(options.portal.exp ? { exp: options.portal.exp } : {}),
      s: options.portal.s,
    };
  }
  if (options.audience === "customer" && options.customer) {
    payload.customer = {
      customerId: options.customer.customerId,
      sig: options.customer.sig,
    };
  }

  const post = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  return post.ok;
}
