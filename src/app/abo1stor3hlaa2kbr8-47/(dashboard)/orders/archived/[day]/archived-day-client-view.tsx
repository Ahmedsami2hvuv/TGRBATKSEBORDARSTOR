"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname } from "next/navigation";
import { normalizeArabicSearchText } from "@/lib/region-name-normalize";
import type { TrackingTableRow } from "../../tracking/order-tracking-table-body";
import { OrderTrackingBulkTable } from "../../tracking/order-tracking-bulk-table";
import { ad } from "@/lib/admin-ui";

type Props = {
  dayLabel: string;
  initialQ: string;
  rows: TrackingTableRow[];
  couriers: Array<{ id: string; name: string }>;
};

export function ArchivedDayClientView({ dayLabel, initialQ, rows, couriers }: Props) {
  const [q, setQ] = useState(initialQ);
  const pathname = usePathname();

  // تحديث الـ URL بسلاسة وبدون إعادة تحميل الصفحات عند تغيير البحث
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (q.trim()) {
        params.set("q", q.trim());
      } else {
        params.delete("q");
      }
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      window.history.replaceState(null, "", newUrl);
    }, 250);

    return () => clearTimeout(timer);
  }, [q, pathname]);

  const filteredRows = useMemo(() => {
    const trimmed = q.trim();
    if (!trimmed) return rows;

    const qNorm = normalizeArabicSearchText(trimmed);
    const qAsNum = parseInt(trimmed, 10);
    const isNum = !Number.isNaN(qAsNum) && String(qAsNum) === trimmed;

    return rows.filter((r) => {
      if (isNum && r.orderNumber === qAsNum) return true;

      const searchableText = [
        r.regionName || "",
        r.shopCustomerLabel || "",
        r.courierName || "",
        r.customerPhone || "",
        r.orderType || "",
        r.routeModeLabel || "",
        r.summary || "",
        r.orderNoteTime || "",
        String(r.orderNumber),
      ].join(" ");

      return normalizeArabicSearchText(searchableText).includes(qNorm);
    });
  }, [q, rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={ad.h1}>{dayLabel}</h1>
          <p className={`mt-1 ${ad.muted}`}>
            طلبات رُفِعت في هذا اليوم وأُرشِفت مرتبة تسلسلياً (يظهر المندوب الذي قام بالتوصيل).
          </p>
        </div>

        {/* حقل البحث اللحظي المباشر بدون الحاجة للنقر على زر Enter */}
        <div className="relative flex-1 max-w-md w-full">
          <div className="relative flex items-center">
            <span className="absolute right-3.5 text-slate-400 text-sm select-none">🔍</span>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث لحظي فوري (منطقة، محل، رقم طلب، مندوب)..."
              className="w-full rounded-2xl border border-sky-300 bg-white pr-10 pl-9 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              autoComplete="off"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute left-3 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-600 hover:bg-slate-300 transition-colors"
                title="مسح البحث"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <OrderTrackingBulkTable rows={filteredRows} couriers={couriers} />
        <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
          <p className={ad.orderListCountFooter}>
            عدد الطلبات المعروضة: <span className="font-bold text-sky-900">{filteredRows.length}</span>
            {q.trim() && (
              <span className="text-slate-500 font-normal mr-1">
                (مطابقة للبحث من أصل {rows.length})
              </span>
            )}
          </p>
          {q.trim() && (
            <button
              onClick={() => setQ("")}
              className="text-sky-700 hover:underline font-bold text-xs"
            >
              عرض كل الطلبات ({rows.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
