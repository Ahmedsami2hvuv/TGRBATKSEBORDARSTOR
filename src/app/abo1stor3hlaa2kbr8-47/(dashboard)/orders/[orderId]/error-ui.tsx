"use client";

import Link from "next/link";
import { ad } from "@/lib/admin-ui";

export function AdminOrderErrorUI({ orderId, error }: { orderId: string; error: string }) {
  return (
    <div className="space-y-4">
      <p className={ad.muted}>
        <Link href="/abo1stor3hlaa2kbr8-47/orders/tracking" className={ad.link}>
          ← تتبع الطلبات
        </Link>
      </p>
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-bold text-red-900">خطأ في تحميل الطلب</h1>
        <p className="mt-2 text-sm text-red-800">
          حدث خطأ غير متوقع أثناء تحميل بيانات الطلب.
        </p>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-red-700 hover:text-red-900">
            تفاصيل الخطأ
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-red-100 p-3 text-xs text-red-900">
            {error}
          </pre>
        </details>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            إعادة محاولة
          </button>
          <Link
            href="/abo1stor3hlaa2kbr8-47/orders/tracking"
            className="rounded bg-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-400"
          >
            العودة للقائمة
          </Link>
        </div>
      </div>
    </div>
  );
}
