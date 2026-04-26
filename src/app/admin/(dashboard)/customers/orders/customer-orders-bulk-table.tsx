"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { bulkUpdateOrdersStatus, type BulkOrdersState } from "../../orders/bulk-actions";
import { orderStatusRowClassInteractive } from "@/lib/order-status-style";
import type { ReactNode } from "react";

type CourierOption = { id: string; name: string };

type CustomerOrderRow = {
  id: string;
  orderNumber: number;
  createdAtLabel: string;
  shopName: string;
  status: string;
  missingLoc: boolean;
  totalLabel: string;
  courierName: string;
};

export function CustomerOrdersBulkTable({
  orders,
  couriers,
}: {
  orders: CustomerOrderRow[];
  couriers: CourierOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectedCount = selected.size;

  const visibleIds = useMemo(() => orders.map((o) => o.id), [orders]);
  const allSelected = selectedCount > 0 && visibleIds.every((id) => selected.has(id));

  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkUpdateOrdersStatus,
    {} as BulkOrdersState,
  );

  const [targetStatus, setTargetStatus] = useState<string>("assigned");
  const [courierId, setCourierId] = useState<string>("");
  const needsCourier =
    targetStatus === "assigned" ||
    targetStatus === "delivering" ||
    targetStatus === "delivered";

  const selectedIdsArr = useMemo(() => Array.from(selected), [selected]);

  useEffect(() => {
    if (bulkState.ok) setSelected(new Set());
  }, [bulkState.ok]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const caption: ReactNode = selectedCount ? (
    <span className="text-xs font-bold text-sky-800 tabular-nums">
      تم اختيار {selectedCount}
    </span>
  ) : (
    <span className="text-xs font-bold text-slate-500">اختر طلبات لإجراء جماعي</span>
  );

  return (
    <div className="space-y-3">
      {orders.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-white/60 px-3 py-2">
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="تحديد الكل" />
            تحديد الكل
          </label>
          {caption}
        </div>
      ) : null}

      {selectedCount ? (
        <div className="rounded-2xl border border-sky-200 bg-white/70 p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">
                إجراء جماعي على {selectedCount} طلب
              </p>
              {bulkState.error ? (
                <p className="mt-1 text-sm font-bold text-rose-600">{bulkState.error}</p>
              ) : null}
              {bulkPending ? (
                <p className="mt-1 text-xs font-bold text-sky-800">جارٍ التطبيق…</p>
              ) : null}
            </div>

            <form action={bulkAction} className="flex flex-wrap items-end gap-2">
              {selectedIdsArr.map((id) => (
                <input key={id} type="hidden" name="orderIds" value={id} />
              ))}

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-bold text-slate-600">الحالة الجديدة</span>
                <select
                  name="targetStatus"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                >
                  <option value="pending">قيد الانتظار</option>
                  <option value="assigned">مسند للمندوب</option>
                  <option value="delivering">بالتوصيل</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="cancelled">ملغي/مرفوض</option>
                  <option value="archived">مؤرشف</option>
                </select>
              </label>

              {needsCourier ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-bold text-slate-600">المندوب</span>
                  <select
                    name="courierId"
                    value={courierId}
                    onChange={(e) => setCourierId(e.target.value)}
                    className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="">اختر مندوب…</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="courierId" value="" />
              )}

              <button
                type="submit"
                disabled={bulkPending || (needsCourier && !courierId)}
                className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-200/80 ring-1 ring-sky-400/30 transition hover:from-sky-700 hover:to-cyan-700 disabled:opacity-60"
              >
                تطبيق
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-sky-200/90 bg-white shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-sky-200 bg-sky-50/80 text-right">
              <th className="w-12 px-2 py-2 text-center font-bold text-sky-900">
                <span className="sr-only">تحديد</span>
              </th>
              <th className="w-12 px-2 py-2 text-center font-bold text-sky-900">
                <span className="sr-only">عرض</span>
              </th>
              <th className="px-2 py-2 font-bold text-sky-900">#</th>
              <th className="px-2 py-2 font-bold text-sky-900">التاريخ</th>
              <th className="px-2 py-2 font-bold text-sky-900">المحل</th>
              <th className="px-2 py-2 font-bold text-sky-900">المبلغ</th>
              <th className="px-2 py-2 font-bold text-sky-900">المندوب</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                role="link"
                tabIndex={0}
                className={`border-b border-sky-100 transition ${orderStatusRowClassInteractive(o.status)}${
                  o.missingLoc ? " ring-2 ring-inset ring-rose-400/60" : ""
                } cursor-pointer`}
                onClick={() => router.push(`/admin/orders/${o.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/admin/orders/${o.id}`);
                  }
                }}
              >
                <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggleOne(o.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`تحديد الطلب ${o.orderNumber}`}
                  />
                </td>
                <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-300 bg-sky-50 text-xs font-bold text-sky-800 hover:bg-sky-100"
                    title="عرض الطلب"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ✎
                  </Link>
                </td>
                <td className="px-2 py-2 text-center font-mono font-bold tabular-nums text-sky-900">
                  {o.missingLoc ? (
                    <span className="me-1 inline-block rounded bg-rose-600 px-1 py-0.5 text-[9px] font-black text-white">
                      !
                    </span>
                  ) : null}
                  {o.orderNumber}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-600" dir="ltr">
                  {o.createdAtLabel}
                </td>
                <td className="max-w-[14rem] px-2 py-2 text-slate-800">{o.shopName}</td>
                <td className="px-2 py-2 text-center font-mono tabular-nums text-slate-900">
                  {o.totalLabel}
                </td>
                <td className="max-w-[8rem] px-2 py-2 text-xs text-emerald-900">
                  {o.courierName || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

