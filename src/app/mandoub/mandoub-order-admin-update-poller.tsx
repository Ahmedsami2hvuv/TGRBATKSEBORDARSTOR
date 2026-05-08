"use client";

import { useEffect, useRef, useState } from "react";

/**
 * يستطلع الخادم دورياً؛ إذا تغيّر الطلب في الإدارة يظهر تنبيه بتحديث إجباري
 * (إعادة تحميل هذه الصفحة/الإطار فقط — لا تعيد تحميل قائمة الطلبات في الخلفية).
 */
export function MandoubOrderAdminUpdatePoller({
  orderId,
  initialUpdatedAtIso,
  initialSnapshot,
  auth,
}: {
  orderId: string;
  initialUpdatedAtIso: string;
  initialSnapshot: {
    status: string;
    totalAmount: string;
    deliveryPrice: string;
    summary: string;
    orderType: string;
    customerLocationUrl: string;
    customerLandmark: string;
    customerDoorPhotoUrl: string;
    adminVoiceNoteUrl: string;
    shopDoorPhotoUrl: string;
    secondCustomerPhone: string;
    secondCustomerLocationUrl: string;
    secondCustomerLandmark: string;
    secondCustomerDoorPhotoUrl: string;
  };
  auth: { c: string; exp: string; s: string };
}) {
  const baselineMs = useRef<number>(Date.parse(initialUpdatedAtIso));
  const baselineSnapshotRef = useRef(initialSnapshot);
  const [stale, setStale] = useState(false);
  const [changedFields, setChangedFields] = useState<string[]>([]);

  const FIELD_LABELS: Record<string, string> = {
    status: "حالة الطلب",
    totalAmount: "مبلغ الطلب",
    deliveryPrice: "أجرة التوصيل",
    summary: "وصف الطلب",
    orderType: "نوع الطلب",
    customerLocationUrl: "لوكيشن الزبون",
    customerLandmark: "أقرب نقطة دالة",
    customerDoorPhotoUrl: "صورة باب الزبون",
    adminVoiceNoteUrl: "ملاحظة الإدارة الصوتية",
    shopDoorPhotoUrl: "صورة باب المحل",
    secondCustomerPhone: "رقم الزبون الثاني",
    secondCustomerLocationUrl: "لوكيشن الزبون الثاني",
    secondCustomerLandmark: "نقطة الزبون الثاني",
    secondCustomerDoorPhotoUrl: "صورة باب الزبون الثاني",
  };

  useEffect(() => {
    const t = Date.parse(initialUpdatedAtIso);
    if (!Number.isNaN(t)) baselineMs.current = t;
  }, [initialUpdatedAtIso]);

  useEffect(() => {
    baselineSnapshotRef.current = initialSnapshot;
  }, [initialSnapshot]);

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
        const j = (await res.json()) as {
          updatedAt?: string;
          snapshot?: Record<string, string>;
        };
        const serverIso = j.updatedAt;
        if (!serverIso) return;
        const serverMs = Date.parse(serverIso);
        if (Number.isNaN(serverMs)) return;
        if (serverMs > baselineMs.current) {
          const serverSnapshot = j.snapshot ?? {};
          const baseSnapshot = baselineSnapshotRef.current as Record<string, string>;
          const diffs = Object.keys(FIELD_LABELS).filter((key) => {
            const before = (baseSnapshot[key] ?? "").trim();
            const after = (serverSnapshot[key] ?? "").trim();
            return before !== after;
          });
          setChangedFields(diffs.map((key) => FIELD_LABELS[key]));
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
          تم تحديث هذا الطلب. اضغط «تحديث» لعرض النسخة الأحدث.
        </p>
        {changedFields.length > 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
            <p className="text-xs font-black text-slate-800">التغييرات التي وصلت:</p>
            <ul className="mt-2 space-y-1 text-xs font-bold text-slate-600">
              {changedFields.slice(0, 6).map((label) => (
                <li key={label}>- {label}</li>
              ))}
            </ul>
          </div>
        ) : null}
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
