"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { deleteEmployee, renewEmployeeOrderPortalToken } from "./actions";
import {
  buildShopStaffOrderShareMessage,
  whatsappAppUrl,
} from "@/lib/whatsapp";

export type EmployeeRow = {
  id: string;
  name: string;
  phone: string;
  orderPortalUrl: string;
};

export function EmployeesList({
  shopId,
  shopName,
  locationUrl,
  employees,
}: {
  shopId: string;
  shopName: string;
  locationUrl: string;
  employees: EmployeeRow[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q),
    );
  }, [employees, query]);

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className={ad.label}>بحث في الموظفين</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="اسم أو رقم…"
          className={`w-full max-w-md sm:ms-auto ${ad.input}`}
        />
      </label>

      {filtered.length === 0 ? (
        <p className={ad.muted}>
          {employees.length === 0
            ? "لا يوجد موظفون بعد."
            : "لا توجد نتائج."}
        </p>
      ) : (
        <ul className={ad.listDivide}>
          {filtered.map((e) => {
            const shareText = buildShopStaffOrderShareMessage({
              shopName,
              locationUrl,
              employeeName: e.name,
              orderPortalUrl: e.orderPortalUrl,
            });
            return (
              <li
                key={e.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div>
                  <p className={ad.listTitle}>{e.name}</p>
                  <p className={`${ad.listMuted} tabular-nums`}>{e.phone}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={whatsappAppUrl(e.phone, shareText)}
                      title="واتساب: رسالة تحتوي رابط إدخال الطلب لموظف المحل"
                      className="inline-flex items-center rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-900 shadow-md ring-1 ring-emerald-300/50 transition hover:from-emerald-300 hover:to-emerald-400"
                    >
                      واتساب: رابط الطلب لموظف المحل
                    </a>
                    <a
                      href={e.orderPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="صفحة إدخال الطلب — يعبّيها موظف المحل؛ الزبون هو مستلم التوصيل"
                      className="inline-flex items-center rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 transition hover:bg-sky-100"
                    >
                      فتح رابط الطلب (موظف المحل)
                    </a>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/shops/${shopId}/employees/${e.id}/edit`}
                    className={ad.btnDark}
                  >
                    تعديل
                  </Link>
                  <form action={renewEmployeeOrderPortalToken} className="inline">
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="shopId" value={shopId} />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
                      title="تجديد الرابط: إبطال كل الروابط السابقة لهذا الموظف"
                    >
                      تجديد رابط الطلب
                    </button>
                  </form>
                  <form action={deleteEmployee} className="inline">
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="shopId" value={shopId} />
                    <button type="submit" className={ad.btnDanger}>
                      حذف
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
