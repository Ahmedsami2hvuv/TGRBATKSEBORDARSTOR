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
  const seenOrderIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

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
          latestActiveOrderPrice?: string;
          latestActiveOrderTime?: string;
          settings?: NotificationSettingsPayload;
        };
        const count = Number(data.assignedCount ?? 0);
        const latest = Number(data.latestActiveOrderNumber ?? 0);
        const latestOrderId = String(data.latestActiveOrderId ?? "");
        const shopName = String(data.latestActiveOrderShopName ?? "—");
        const regionName = String(data.latestActiveOrderRegionName ?? "—");
        const orderPrice = String(data.latestActiveOrderPrice ?? "—");
        const orderTime = String(data.latestActiveOrderTime ?? "فوري");
        const settings = data.settings;
        const sound = settings?.soundPreset ?? "beep";

        if (!initializedRef.current) {
          lastAssignedRef.current = count;
          seenOrderIdRef.current = latestOrderId || null;
          initializedRef.current = true;
          return;
        }

        const countIncreased = lastAssignedRef.current !== null && count > lastAssignedRef.current;
        const isNewOrder = latestOrderId && seenOrderIdRef.current !== null && seenOrderIdRef.current !== latestOrderId;

        if (countIncreased || isNewOrder) {
          ensureNotificationAudioContext()?.resume().catch(() => {});
          playNotificationSound(sound);
          
          if (settings && settings.enabled && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              const isMultiple = (count - (lastAssignedRef.current ?? 0)) > 1 || count > 1;
              const template = isMultiple ? settings.templateMultiple : settings.templateSingle;
              const titleTemplate = settings.titleSingle;

              const title = renderNotificationTemplate(titleTemplate, {
                count,
                orderNumber: latest,
                shopName,
                regionName,
                orderPrice,
                orderTime,
              });

              const body = renderNotificationTemplate(template, {
                count,
                orderNumber: latest,
                shopName,
                regionName,
                orderPrice,
                orderTime,
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
        if (latestOrderId) {
          seenOrderIdRef.current = latestOrderId;
        }
      } catch {
        /* ignore network */
      }
    };

    void tick();
    const id = window.setInterval(tick, 7000); // تقليل وقت الاستعلام إلى 7 ثوانٍ لوصول فوري للإشعار ودون تأخير
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
