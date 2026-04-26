"use client";

import { useCallback, useState } from "react";
import {
  registerSwAndRequestNotificationPermission,
} from "@/lib/client-web-notification";
import { ensureNotificationAudioContext } from "@/lib/notification-sound-client";
import { subscribeDeviceToWebPush } from "@/lib/web-push-client";

export function CustomerPushSubscribe({
  customerId,
  sig,
}: {
  customerId: string;
  sig: string;
}) {
  const [perm, setPerm] = useState<NotificationPermission>(() =>
    typeof window === "undefined" || !("Notification" in window)
      ? "denied"
      : Notification.permission,
  );

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
        audience: "customer",
        customer: { customerId, sig },
      });
    }
  }

  const label =
    perm === "granted" ? "مفعلة" : perm === "denied" ? "مرفوضة" : "غير مفعلة";

  return (
    <div
      className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white/90 px-4 py-6 shadow-sm"
      onPointerDown={unlock}
      role="presentation"
    >
      <h1 className="text-lg font-black text-slate-900">إشعارات للزبون</h1>
      <p className="mt-2 text-sm text-slate-600">
        بعد التفعيل قد تصلك إشعارات متعلقة بطلباتك على هذا الجهاز.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-700">الحالة: {label}</p>
        {perm !== "granted" ? (
          <button
            type="button"
            onClick={enable}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            تفعيل إشعارات المتصفح
          </button>
        ) : null}
      </div>
    </div>
  );
}
