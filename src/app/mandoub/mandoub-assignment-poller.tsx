"use client";

import { useEffect, useRef } from "react";
import {
  ensureNotificationAudioContext,
  playNotificationSound,
} from "@/lib/notification-sound-client";

import {
  renderNotificationTemplate,
  type NotificationSettingsPayload,
} from "@/lib/notification-template";

type Auth = { c: string; exp?: string; s: string };

/**
 * يستطلع إسناد طلبات جديدة للمندوب ويشغّل صوتاً عند زيادة عدد الطلبات المسندة.
 * يعمل فقط عندما تكون الصفحة مفتوحة ومرئية في المتصفح لتقليل الضغط على السيرفر.
 */
export function MandoubAssignmentPoller({ auth }: { auth: Auth }) {
  const lastAssignedRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const q = new URLSearchParams();
        if (auth.c) q.set("c", auth.c);
        if (auth.exp) q.set("exp", auth.exp);
        if (auth.s) q.set("s", auth.s);
        const res = await fetch(`/api/notifications/mandoub-assigned?${q.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          assignedCount?: number;
          latestActiveOrderNumber?: number;
          latestActiveOrderId?: string;
          latestActiveOrderShopName?: string;
          latestActiveOrderRegionName?: string;
          settings?: NotificationSettingsPayload;
        };
        const count = Number(data.assignedCount ?? 0);
        const latest = Number(data.latestActiveOrderNumber ?? 0);
        const latestOrderId = String(data.latestActiveOrderId ?? "");
        const shopName = String(data.latestActiveOrderShopName ?? "—");
        const regionName = String(data.latestActiveOrderRegionName ?? "—");
        const settings = data.settings;
        const sound = settings?.soundPreset ?? "beep";

        if (lastAssignedRef.current !== null && count > lastAssignedRef.current) {
          ensureNotificationAudioContext()?.resume().catch(() => {});
          playNotificationSound(sound);
          
          if (settings && settings.enabled && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              const isMultiple = (count - lastAssignedRef.current) > 1 || count > 1;
              const template = isMultiple ? settings.templateMultiple : settings.templateSingle;
              const titleTemplate = settings.titleSingle;

              const title = renderNotificationTemplate(titleTemplate, {
                count,
                orderNumber: latest,
                shopName,
                regionName,
              });

              const body = renderNotificationTemplate(template, {
                count,
                orderNumber: latest,
                shopName,
                regionName,
              });

              const n = new Notification(title, {
                body,
                icon: "/pwa-icon-192.png",
                tag: `kse-poller-mandoub-${latestOrderId || Date.now()}`,
              });
              n.onclick = () => {
                const q = new URLSearchParams();
                q.set("c", auth.c);
                if (auth.exp) q.set("exp", auth.exp);
                q.set("s", auth.s);
                window.focus();
                const target = latestOrderId
                  ? `/mandoub/order/${latestOrderId}?${q.toString()}`
                  : `/mandoub?${q.toString()}`;
                window.location.assign(target);
              };
            } catch {
              /* ignore */
            }
          }
        }
        lastAssignedRef.current = count;
      } catch {
        /* ignore network */
      }
    };

    void tick();
    const id = window.setInterval(tick, 20000); // استعلام كل 20 ثانية لتقليل الضغط على السيرفر
    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [auth.c, auth.exp, auth.s]);

  return null;
}
