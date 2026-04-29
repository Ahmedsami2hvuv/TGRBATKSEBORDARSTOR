"use client";

import Link from "next/link";
import { useState } from "react";
import { ad } from "@/lib/admin-ui";
import { deleteEmployee, renewEmployeeOrderPortalToken } from "./actions";

export type EmployeeRow = {
  id: string;
  name: string;
  phone: string;
  orderPortalUrl: string;
  whatsappLink: string; // الرابط جاهز من الخادم
};

export function EmployeesList({
  shopId,
  employees,
}: {
  shopId: string;
  shopName: string;
  locationUrl: string;
  employees: EmployeeRow[];
}) {
  const [query, setQuery] = useState("");

  const filtered = (employees || []).filter(
    (e) =>
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.phone.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-slate-50 p-3 rounded-xl">
        <span className="text-sm font-bold text-slate-600">بحث في الموظفين:</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالاسم أو الرقم..."
          className="w-full max-w-xs rounded-lg border border-slate-200 p-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-slate-400">لا توجد نتائج مطابقة.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((e) => (
            <li key={e.id} className="py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-slate-800 text-lg">{e.name}</p>
                <p className="text-slate-500 font-mono text-sm">{e.phone}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {e.whatsappLink !== "#" ? (
                    <a
                      href={e.whatsappLink}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 transition-colors"
                    >
                      <span>💬</span> إرسال الرابط للواتساب
                    </a>
                  ) : (
                    <span className="text-[10px] text-rose-500 bg-rose-50 px-2 py-1 rounded">⚠️ الرابط غير جاهز</span>
                  )}

                  {e.orderPortalUrl ? (
                    <a
                      href={e.orderPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-100 px-3 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-200 transition-colors"
                    >
                      <span>🔗</span> فتح الرابط المباشر
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t pt-3 sm:border-0 sm:pt-0">
                <Link
                  href={`/admin/shops/${shopId}/employees/${e.id}/edit`}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900"
                >
                  تعديل
                </Link>
                <form action={renewEmployeeOrderPortalToken}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="shopId" value={shopId} />
                  <button type="submit" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100">
                    تجديد
                  </button>
                </form>
                <form action={deleteEmployee} onSubmit={(ev) => !confirm("حذف الموظف؟") && ev.preventDefault()}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="shopId" value={shopId} />
                  <button type="submit" className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100">
                    حذف
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
