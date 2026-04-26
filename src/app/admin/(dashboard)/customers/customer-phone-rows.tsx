"use client";

import { useRouter } from "next/navigation";

export type CustomerRegionMini = {
  key: string;
  name: string;
  locationUrl: string;
  landmark: string;
  orderCount: number;
  totalLabel: string;
  infoHref: string;
};

export type CustomerPhoneRowUi = {
  phone: string;
  totalOrders: number;
  totalAmountLabel: string;
  ordersHref: string;
  regions: CustomerRegionMini[];
};

export function CustomerPhoneRows({ rows }: { rows: CustomerPhoneRowUi[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-sky-300 bg-white p-6 text-center text-slate-600">
        لا توجد نتائج مطابقة.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div
          key={r.phone}
          role="button"
          tabIndex={0}
          onClick={() => router.push(r.ordersHref)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push(r.ordersHref);
            }
          }}
          className="cursor-pointer rounded-2xl border border-sky-200 bg-white px-4 py-3 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/50"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-base font-bold tabular-nums text-sky-900">
              {r.phone}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-900">
                الطلبات: {r.totalOrders}
              </span>
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-900">
                مجموع الأسعار: {r.totalAmountLabel}
              </span>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {r.regions.map((rg) => (
              <button
                key={rg.key}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(rg.infoHref);
                }}
                className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 font-semibold text-slate-800 transition hover:bg-slate-100"
                title={`عرض تفاصيل المنطقة «${rg.name}» — صورة الباب، اللوكيشن، أقرب نقطة دالة، الرقم الثاني`}
              >
                {rg.name}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
            {r.regions.map((rg) => (
              <span key={`${rg.key}-meta`} className="rounded-md bg-slate-100 px-2 py-1">
                {rg.name}: {rg.landmark || "—"} | {rg.orderCount} طلب | {rg.totalLabel}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

