"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  registerSwAndRequestNotificationPermission,
  showTrayNotification,
} from "@/lib/client-web-notification";
import { subscribeDeviceToWebPush } from "@/lib/web-push-client";
import {
  ensureNotificationAudioContext,
  playNotificationSound,
} from "@/lib/notification-sound-client";
import {
  DEFAULT_ADMIN_NOTIFICATION_PAYLOAD,
  renderNotificationTemplate,
  type NotificationSettingsPayload,
} from "@/lib/notification-template";

const ADMIN_PENDING_URL = "/admin/orders/pending";

type AdminPendingNotificationsProps = {
  initialPendingCount: number;
  initialLatestOrderNumber: number;
  /** شريط مدمج تحت البحث في كل لوحة الإدارة */
  compact?: boolean;
};

type AdminPendingSnapshot = {
  pendingCount: number;
  latestOrderNumber: number;
  settings: NotificationSettingsPayload;
};

const STORAGE_KEY = "kse:admin:pending:lastSeenOrderNumber";
const COUNT_KEY = "kse:admin:pending:lastKnownPendingCount";
const POLL_MS = 8000;

function mobileBuzz() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate([120, 60, 120]);
    } catch {
      /* ignore */
    }
  }
}

export function AdminPendingNotifications({
  initialPendingCount,
  initialLatestOrderNumber,
  compact = false,
}: AdminPendingNotificationsProps) {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof window === "undefined" || !("Notification" in window)
      ? "denied"
      : Notification.permission,
  );

  const [snapshot, setSnapshot] = useState<AdminPendingSnapshot>({
    pendingCount: initialPendingCount,
    latestOrderNumber: initialLatestOrderNumber,
    settings: DEFAULT_ADMIN_NOTIFICATION_PAYLOAD,
  });

  const [toast, setToast] = useState<{ message: string } | null>(null);
  const bumpHandledRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === null) {
      window.localStorage.setItem(STORAGE_KEY, String(initialLatestOrderNumber));
    }
    if (window.localStorage.getItem(COUNT_KEY) === null) {
      window.localStorage.setItem(COUNT_KEY, String(initialPendingCount));
    }
  }, [initialLatestOrderNumber, initialPendingCount]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 12000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/notifications/admin-pending", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const next = (await res.json()) as AdminPendingSnapshot;
        if (cancelled) return;
        setSnapshot(next);

        const countRaw = window.localStorage.getItem(COUNT_KEY);
        const prevCountParsed = countRaw === null ? null : Number(countRaw);
        const prevCount =
          prevCountParsed !== null && Number.isFinite(prevCountParsed)
            ? prevCountParsed
            : null;

        const rawSeen = window.localStorage.getItem(STORAGE_KEY);
        const seen = rawSeen ? Number(rawSeen) : 0;
        const safeSeen = Number.isFinite(seen) ? seen : 0;

        const orderBump = next.latestOrderNumber > safeSeen;
        const countBump = prevCount !== null && next.pendingCount > prevCount;

        const granted =
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted";

        if (next.settings.enabled && (orderBump || countBump)) {
          let body: string;
          if (orderBump) {
            const diff = next.latestOrderNumber - safeSeen;
            body = renderNotificationTemplate(
              diff === 1 ? next.settings.templateSingle : next.settings.templateMultiple,
              { count: diff, orderNumber: next.latestOrderNumber },
            );
          } else {
            const d = next.pendingCount - (prevCount as number);
            body = renderNotificationTemplate(
              d === 1 ? next.settings.templateSingle : next.settings.templateMultiple,
              {
                count: d,
                orderNumber: next.latestOrderNumber || 0,
              },
            );
          }

          const dedupeKey = `${next.latestOrderNumber}-${next.pendingCount}-${body.slice(0, 40)}`;
          if (bumpHandledRef.current !== dedupeKey) {
            bumpHandledRef.current = dedupeKey;

            /** تنبيه داخل الصفحة — يعمل على الجوال حتى لو فشل إشعار النظام أو الصوت */
            setToast({ message: body });

            if (granted) {
              /* silent: true كان يخفي الإشعار الحقيقي في شريط الهاتف لتجنب صوتين؛ نعرض إشعار نظام كامل ثم لا نكرر بنغمة الصفحة */
              void showTrayNotification({
                title: "لوحة الإدارة — طلب جديد",
                body,
                tag: `kse-p-${next.latestOrderNumber}-${next.pendingCount}`,
                openUrl: ADMIN_PENDING_URL,
              });
            }

            mobileBuzz();

            if (next.settings.soundEnabled && !granted) {
              playNotificationSound(next.settings.soundPreset);
            }

            if (next.latestOrderNumber > safeSeen) {
              window.localStorage.setItem(STORAGE_KEY, String(next.latestOrderNumber));
            }
          }
        }

        window.localStorage.setItem(COUNT_KEY, String(next.pendingCount));
      } catch {
        // تجاهل فشل الشبكة المؤقت
      }
    }

    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [permission]);

  const unlockAudioOnInteract = useCallback(() => {
    const ctx = ensureNotificationAudioContext();
    if (ctx) void ctx.resume();
  }, []);

  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    unlockAudioOnInteract();
    const p = await registerSwAndRequestNotificationPermission();
    setPermission(p);
    if (p === "granted") {
      await subscribeDeviceToWebPush({ audience: "admin" });
    }
  }

  const statusLabel = useMemo(() => {
    if (permission === "granted") return "مفعلة";
    if (permission === "denied") return "مرفوضة من المتصفح";
    return "غير مفعلة";
  }, [permission]);

  const boxClass = compact
    ? "rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2"
    : "rounded-xl border border-sky-200 bg-white/70 px-3 py-2";

  return (
    <>
      <div
        className={boxClass}
        onPointerDown={unlockAudioOnInteract}
        role="presentation"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-700">
            إشعارات الطلبات الجديدة: <span className="text-sky-900">{statusLabel}</span>
          </p>
          {permission !== "granted" ? (
            <button
              type="button"
              onClick={enableNotifications}
              className="rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-900 transition hover:bg-sky-100"
            >
              تفعيل إشعارات المتصفح
            </button>
          ) : null}
        </div>
        {!compact ? (
          <p className="mt-1 text-[11px] text-slate-500">
            الآن في الانتظار: <strong className="text-slate-700">{snapshot.pendingCount}</strong>
            {" — "}
            <span className="text-slate-400">
              مع التفعيل والتثبيت كتطبيق، يظهر الإشعار في شريط النظام ويفتح الطلبات قيد الانتظار عند اللمس.
            </span>
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500">
            طلبات قيد الانتظار:{" "}
            <strong className="text-slate-700">{snapshot.pendingCount}</strong>
            {" — "}
            <span className="text-slate-400">
              للإشعار الحقيقي حتى مع إغلاق المتصفح: يجب ضبط مفاتيح VAPID على الخادم، ثم «تفعيل إشعارات المتصفح» هنا. يُفضّل أيضاً إضافة الموقع إلى الشاشة الرئيسية (أندرويد/iOS).
            </span>
          </p>
        )}
      </div>

      {toast ? (
        <div
          className="fixed bottom-4 left-4 right-4 z-[300] mx-auto flex max-w-lg items-start gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-emerald-950 shadow-2xl shadow-emerald-900/20 sm:left-auto sm:right-4 sm:mx-0"
          role="alert"
          dir="rtl"
        >
          <span className="text-2xl" aria-hidden>
            🔔
          </span>
          <p className="min-w-0 flex-1 text-sm font-bold leading-snug">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="shrink-0 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs font-bold text-emerald-900"
          >
            إغلاق
          </button>
        </div>
      ) : null}
    </>
  );
}
