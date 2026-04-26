"use client";

import { useCallback, useState } from "react";
import {
  registerSwAndRequestNotificationPermission,
} from "@/lib/client-web-notification";
import { ensureNotificationAudioContext } from "@/lib/notification-sound-client";
import { subscribeDeviceToWebPush } from "@/lib/web-push-client";

export function EmployeePushBanner({ e, exp, s }: { e: string; exp?: string; s: string }) {
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
        audience: "employee",
        portal: { e, exp, s },
      });
    }
  }

  const label =
    perm === "granted" ? "مفعلة" : perm === "denied" ? "مرفوضة من المتصفح" : "غير مفعلة";

  return (
    <div
      className="mb-4 rounded-xl border border-emerald-200 bg-white/80 px-3 py-2 shadow-sm"
      onPointerDown={unlock}
      role="presentation"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-700">
          إشعارات الطلبات: <span className="text-emerald-900">{label}</span>
        </p>
        {perm !== "granted" ? (
          <button
            type="button"
            onClick={enable}
            className="rounded-lg border border-emerald-400 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
          >
            تفعيل إشعارات المتصفح
          </button>
        ) : null}
      </div>
    </div>
  );
}
