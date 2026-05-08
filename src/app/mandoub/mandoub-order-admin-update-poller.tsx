"use client";

import { useEffect, useRef, useState } from "react";

/**
 * يستطلع الخادم دورياً؛ إذا تغيّر الطلب في الإدارة يظهر تنبيه بتحديث إجباري
 * (إعادة تحميل هذه الصفحة/الإطار فقط — لا تعيد تحميل قائمة الطلبات في الخلفية).
 */
export function MandoubOrderAdminUpdatePoller({
  orderId,
  initialUpdatedAtIso,
  auth,
}: {
  orderId: string;
  initialUpdatedAtIso: string;
  auth: { c: string; exp: string; s: string };
}) {
  const baselineMs = useRef<number>(Date.parse(initialUpdatedAtIso));
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const t = Date.parse(initialUpdatedAtIso);
    if (!Number.isNaN(t)) baselineMs.current = t;
  }, [initialUpdatedAtIso]);

  useEffect(() => {
    if (!orderId || stale) return;

    let cancelled = false;
    const tick = async () => {
      const p = new URLSearchParams();
      p.set("orderId", orderId);
      if (auth.c) p.set("c", auth.c);
      if (auth.exp) p.set("exp", auth.exp);
      if (auth.s) p.set("s", auth.s);
      try {
        const res = await fetch(`/api/mandoub/order-updated-at?${p.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as { updatedAt?: string };
        const serverIso = j.updatedAt;
        if (!serverIso) return;
        const serverMs = Date.parse(serverIso);
        if (Number.isNaN(serverMs)) return;
        if (serverMs > baselineMs.current) {
          setStale(true);
        }
      } catch {
        /* تجاهل أخطاء الشبكة المؤقتة */
      }
    };

    const intervalMs = 12_000;
    const id = window.setInterval(() => void tick(), intervalMs);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [orderId, auth.c, auth.exp, auth.s, stale]);

  if (!stale) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]"
      dir="rtl"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mandoub-admin-update-title"
    >
      <div className="max-w-sm rounded-2xl border border-sky-200 bg-white p-6 text-center shadow-2xl">
        <p id="mandoub-admin-update-title" className="text-lg font-black text-slate-900">
          تحديث من الإدارة
        </p>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
          الإدارة عدّلت بيانات هذا الطلب (سعر، لوكيشن، صورة باب، أو غيرها). اضغط «تحديث»
          لعرض آخر النسخة لهذا الطلب فقط.
        </p>
        <button
          type="button"
          className="mt-5 w-full rounded-xl bg-sky-600 py-3 text-base font-black text-white shadow-md hover:bg-sky-700"
          onClick={() => window.location.reload()}
        >
          تحديث
        </button>
      </div>
    </div>
  );
}
