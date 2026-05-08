"use client";

import { useEffect, useRef } from "react";
import {
  ensureNotificationAudioContext,
  playNotificationSound,
} from "@/lib/notification-sound-client";

type Auth = { c: string; exp?: string; s: string };

/**
 * يستطلع إسناد طلبات جديدة للمندوب ويشغّل صوتاً عند زيادة عدد الطلبات المسندة.
 */
export function MandoubAssignmentPoller({ auth }: { auth: Auth }) {
  const lastAssignedRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
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
          settings?: { soundPreset?: string };
        };
        const count = Number(data.assignedCount ?? 0);
        const latest = Number(data.latestActiveOrderNumber ?? 0);
        const latestOrderId = String(data.latestActiveOrderId ?? "");
        const sound = data.settings?.soundPreset ?? "beep";

        if (lastAssignedRef.current !== null && count > lastAssignedRef.current) {
          ensureNotificationAudioContext()?.resume().catch(() => {});
          playNotificationSound(sound);
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              const n = new Notification("طلب جديد مسند", {
                body: `لديك ${count} طلب بانتظار الاستلام. آخر رقم نشط: ${latest || "—"}`,
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
    const id = window.setInterval(tick, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [auth.c, auth.exp, auth.s]);

  return null;
}
