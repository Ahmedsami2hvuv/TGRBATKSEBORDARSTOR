"use client";

/** Triggering a new deployment to resolve Railway initialization error */
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { bulkUpdateOrdersStatus, type BulkOrdersState } from "../orders/bulk-actions";

type CourierOption = { id: string; name: string };

type SearchOrderRow = {
  id: string;
  orderNumber: number;
  shopName: string;
  customerPhone: string;
  summary: string;
  orderType: string;
  totalAmount: string;
};

export function AdminSearchOrdersBulk({
  orders,
  couriers,
}: {
  orders: SearchOrderRow[];
  couriers: CourierOption[];
}) {
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

  return (
    <div className="space-y-3">
      {orders.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-white/60 px-3 py-2">
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="تحديد الكل"
            />
            تحديد الكل
          </label>
          {selectedCount ? (
            <span className="text-xs font-bold text-sky-800 tabular-nums">
              تم اختيار {selectedCount}
            </span>
          ) : (
            <span className="text-xs font-bold text-slate-500">اختر طلبات لإجراء جماعي</span>
          )}
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

      <div className="space-y-2">
        {orders.map((o) => {
          const isChecked = selected.has(o.id);
          return (
            <div key={o.id} className="flex items-start gap-3">
              <div className="pt-3">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleOne(o.id)}
                  aria-label={`تحديد الطلب ${o.orderNumber}`}
                />
              </div>
              <Link
                href={`/admin/orders/${o.id}`}
                className="flex-1 block rounded-xl border border-sky-200 bg-white p-3 hover:bg-sky-50"
              >
                <p className="font-bold text-slate-900">
                  #{o.orderNumber} — {o.shopName}
                </p>
                <p className="text-sm text-slate-600">
                  الهاتف: {o.customerPhone} | المبلغ: {o.totalAmount || "—"}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {o.summary || o.orderType || "بدون نص"}
                </p>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

