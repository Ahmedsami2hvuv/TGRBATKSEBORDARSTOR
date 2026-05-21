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
import { preparerPath } from "@/lib/preparer-portal-nav";

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
  const seenOrderRef = useRef<string>("");
  const initializedRef = useRef(false);

  const [toast, setToast] = useState<{ message: string; url: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 12000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
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
          latestShopOrderId?: string;
          latestShopOrderNumber?: number | null;
          latestShopOrderCreatedAt?: string | null;
          latestShopOrderShopName?: string;
          latestShopOrderRegionName?: string;
          settings?: NotificationSettingsPayload;
        };
        const count = Number(data.noticesCount ?? 0);
        const settings = data.settings ?? DEFAULT_PREPARER_NOTIFICATION_PAYLOAD;
        if (!initializedRef.current) {
          seenNoticeRef.current = data.latestNoticeId ?? "";
          seenOrderRef.current = data.latestShopOrderId ?? "";
          initializedRef.current = true;
        }

        const latestNoticeId = data.latestNoticeId ?? "";
        // نعتمد على تغيير الـ ID فقط لضمان وصول كل إشعار جديد
        if (settings.enabled && latestNoticeId && seenNoticeRef.current !== latestNoticeId) {
          seenNoticeRef.current = latestNoticeId;

          const rawTitle = data.latestTitle ?? "";
          const rawBody = data.latestBody ?? "";

          // هل هذا إشعار إسناد طلب (غالباً من الموقع)؟
          const isAssignment = rawTitle.includes("إسناد") || rawBody.includes("إسناد") || /\d{8,}/.test(rawTitle) || /\d{8,}/.test(rawBody);

          let body = "";
          if (isAssignment && settings.templateWebsite) {
            // استخدام قالب الموقع الجديد
            const orderNumMatch = (rawTitle + rawBody).match(/#(\d+)/);
            const orderNumber = orderNumMatch ? parseInt(orderNumMatch[1]) : 0;

            body = renderNotificationTemplate(settings.templateWebsite, {
              count: 1,
              orderNumber: orderNumber,
              shopName: "الموقع الإلكتروني",
              regionName: "—",
            });
          } else {
            // القالب العادي
            body = renderNotificationTemplate(settings.templateSingle, {
              count: 1,
              orderNumber: 0,
              shopName: rawTitle || "—",
              regionName: rawBody || "—",
            });
          }

          if (settings.soundEnabled) {
            playNotificationSound(settings.soundPreset);
          }

          setToast({ message: body, url: openUrl });

          if (perm === "granted") {
            void showTrayNotification({
              title: "لوحة المجهز — إشعار جديد",
              body,
              tag: `kse-prep-notice-${latestNoticeId}`,
              openUrl,
            });
          }
        }

        const latestShopOrderId = String(data.latestShopOrderId ?? "");
        const latestShopOrderNumber = Number(data.latestShopOrderNumber ?? 0);
        const latestShopOrderCreatedAt = String(data.latestShopOrderCreatedAt ?? "");

        if (
          settings.enabled &&
          latestShopOrderId &&
          latestShopOrderCreatedAt &&
          seenOrderRef.current !== latestShopOrderId
        ) {
          seenOrderRef.current = latestShopOrderId;
          const orderOpenUrl = preparerPath(`/preparer/order/${latestShopOrderId}`, {
            p: auth.p,
            exp: auth.exp || "",
            s: auth.s,
          });

          if (settings.soundEnabled) {
            playNotificationSound(settings.soundPreset);
          }

          const orderBody = renderNotificationTemplate(settings.templateMultiple, {
            count: 1,
            orderNumber: Number.isFinite(latestShopOrderNumber) ? latestShopOrderNumber : 0,
            shopName: data.latestShopOrderShopName ?? "—",
            regionName: data.latestShopOrderRegionName ?? "—",
          });

          setToast({ message: orderBody, url: orderOpenUrl });

          if (perm === "granted") {
            void showTrayNotification({
              title: "لوحة المجهز — طلب جديد",
              body: orderBody,
              tag: `kse-prep-order-${latestShopOrderId}`,
              openUrl: orderOpenUrl,
            });
          }
        }
        lastCountRef.current = count;
      } catch {
        // ignore temporary network failures
      }
    };
    void tick();
    const id = window.setInterval(tick, 20000); // زيادة الوقت لـ 20 ثانية لتقليل الطلبات
    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
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
    <>
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

      {toast ? (
        <div
          className="fixed top-4 left-4 right-4 z-[300] mx-auto flex max-w-lg items-start gap-3 rounded-2xl border-2 border-violet-500 bg-white px-4 py-3 text-slate-900 shadow-2xl shadow-violet-900/30 animate-in slide-in-from-top duration-300 sm:left-auto sm:right-4 sm:mx-0"
          role="alert"
          dir="rtl"
        >
          <span className="text-2xl animate-bounce" aria-hidden>
            🔔
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-violet-700 mb-1">إشعار مجهز جديد</p>
            <p className="text-sm font-bold leading-snug">{toast.message}</p>
            <button
              onClick={() => {
                window.location.assign(toast.url);
                setToast(null);
              }}
              className="mt-2 text-xs font-bold text-violet-600 underline"
            >
              عرض الطلب الآن
            </button>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600"
          >
            إغلاق
          </button>
        </div>
      ) : null}
    </>
  );
}
