"use client";

import { useEffect, useRef, useState } from "react";
import {
  registerSwAndRequestNotificationPermission,
  showTrayNotification,
} from "@/lib/client-web-notification";
import {
  ensureNotificationAudioContext,
  playNotificationSound,
} from "@/lib/notification-sound-client";
import {
  DEFAULT_PREPARER_NOTIFICATION_PAYLOAD,
  renderNotificationTemplate,
  type NotificationSettingsPayload,
} from "@/lib/notification-template";
import { subscribeDeviceToWebPush } from "@/lib/web-push-client";

type Auth = { p: string; exp?: string; s: string };

export function PreparerNotificationPoller({
  auth,
  openUrl,
}: {
  auth: Auth;
  openUrl: string;
}) {
  const [perm, setPerm] = useState<NotificationPermission>(() =>
    typeof window === "undefined" || !("Notification" in window) ? "denied" : Notification.permission,
  );
  const lastCountRef = useRef<number | null>(null);
  const seenNoticeRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const q = new URLSearchParams();
        q.set("p", auth.p);
        if (auth.exp) q.set("exp", auth.exp);
        q.set("s", auth.s);
        const res = await fetch(`/api/notifications/preparer-notices?${q.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          noticesCount?: number;
          latestTitle?: string;
          latestBody?: string;
          latestNoticeId?: string;
          settings?: NotificationSettingsPayload;
        };
        const count = Number(data.noticesCount ?? 0);
        const settings = data.settings ?? DEFAULT_PREPARER_NOTIFICATION_PAYLOAD;
        const isBump = lastCountRef.current !== null && count > lastCountRef.current;
        const latestNoticeId = data.latestNoticeId ?? "";
        if (settings.enabled && isBump && latestNoticeId && seenNoticeRef.current !== latestNoticeId) {
          seenNoticeRef.current = latestNoticeId;
          const body = renderNotificationTemplate(settings.templateSingle, {
            count: 1,
            orderNumber: 0,
            shopName: data.latestTitle ?? "—",
            regionName: data.latestBody ?? "—",
          });
          if (perm === "granted") {
            void showTrayNotification({
              title: "لوحة المجهز — إشعار جديد",
              body,
              tag: `kse-preparer-${latestNoticeId}`,
              openUrl,
            });
          } else if (settings.soundEnabled) {
            playNotificationSound(settings.soundPreset);
          }
        }
        lastCountRef.current = count;
      } catch {
        // ignore temporary network failures
      }
    };
    void tick();
    const id = window.setInterval(tick, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [auth.p, auth.exp, auth.s, openUrl, perm]);

  async function enableNotifications() {
    ensureNotificationAudioContext()?.resume().catch(() => {});
    const p = await registerSwAndRequestNotificationPermission();
    setPerm(p);
    if (p === "granted") {
      await subscribeDeviceToWebPush({
        audience: "preparer",
        preparer: { p: auth.p, exp: auth.exp, s: auth.s },
      });
    }
  }

  return (
    <div className="mb-2 rounded-xl border border-violet-200 bg-white/80 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-700">
          إشعارات المجهز:{" "}
          <span className="text-violet-800">
            {perm === "granted" ? "مفعلة" : perm === "denied" ? "مرفوضة من المتصفح" : "غير مفعلة"}
          </span>
        </p>
        {perm !== "granted" ? (
          <button
            type="button"
            onClick={enableNotifications}
            className="rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-900 hover:bg-violet-100"
          >
            تفعيل إشعارات المتصفح
          </button>
        ) : null}
      </div>
    </div>
  );
}
