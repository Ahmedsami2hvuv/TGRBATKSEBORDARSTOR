"use client";

import { useCallback, useEffect, useState } from "react";
import {
  registerSwAndRequestNotificationPermission,
} from "@/lib/client-web-notification";
import { ensureNotificationAudioContext } from "@/lib/notification-sound-client";
import { subscribeDeviceToWebPush } from "@/lib/web-push-client";

type Auth = { c: string; exp?: string; s: string };

export function MandoubWebPushBanner({ auth }: { auth: Auth }) {
  const [perm, setPerm] = useState<NotificationPermission>(() =>
    typeof window === "undefined" || !("Notification" in window)
      ? "denied"
      : Notification.permission,
  );
  const [vapidConfigured, setVapidConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/push/vapid-public", { cache: "no-store" });
        const data = (await res.json()) as { configured?: boolean; publicKey?: string | null };
        if (!alive) return;
        setVapidConfigured(Boolean(data.configured));
      } catch {
        // إذا فشل جلب الحالة نعتبرها غير مضبوطة كي يظهر التحذير بشكل واضح للمستخدم.
        if (!alive) return;
        setVapidConfigured(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const unlock = useCallback(() => {
    const ctx = ensureNotificationAudioContext();
    if (ctx) void ctx.resume();
  }, []);

  async function enable() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    unlock();
    const p = await registerSwAndRequestNotificationPermission();
    setPerm(p);
    if (p === "granted") {
      await subscribeDeviceToWebPush({
        audience: "mandoub",
        mandoub: { c: auth.c, exp: auth.exp, s: auth.s },
      });
    }
  }

  const label =
    perm === "granted" ? "مفعلة" : perm === "denied" ? "مرفوضة من المتصفح" : "غير مفعلة";

  // إضافة: إخفاء الشريط بالكامل إذا كانت الإشعارات مفعلة بنجاح
  if (perm === "granted" && vapidConfigured !== false) {
    return null;
  }

  return (
    <div
      className="mb-2 rounded-xl border border-cyan-200 bg-white/70 px-3 py-2"
      onPointerDown={unlock}
      role="presentation"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-700">
          إشعارات إسناد الطلبات: <span className="text-cyan-900">{label}</span>
        </p>
        {perm !== "granted" ? (
          <button
            type="button"
            onClick={enable}
            className="rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-900 transition hover:bg-cyan-100"
          >
            تفعيل إشعارات المتصفح
          </button>
        ) : null}
      </div>
      {vapidConfigured === false ? (
        <p className="mt-1 text-[11px] text-slate-500">
          لإظهار الإشعار في شريط الهاتف حتى عند إغلاق المتصفح، يجب أن يضبط المسؤول مفاتيح VAPID على الخادم. على iPhone يُفضّل إضافة الموقع إلى الشاشة الرئيسية.
        </p>
      ) : null}
    </div>
  );
}
