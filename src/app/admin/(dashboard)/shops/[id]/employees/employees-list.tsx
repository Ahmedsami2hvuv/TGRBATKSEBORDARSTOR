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
  whatsappLink: string;
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.phone.toLowerCase().includes(query.toLowerCase()),
  );

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* شريط البحث */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-slate-50 p-3 rounded-xl">
        <span className="text-sm font-bold text-slate-600">بحث في العملاء:</span>
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
          {filtered.map((emp) => (
            <li key={emp.id} className="py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* معلومات العميل */}
              <div>
                <p className="font-black text-slate-800 text-lg">{emp.name}</p>
                <p className="text-slate-500 font-mono text-sm">{emp.phone}</p>

                {/* أزرار الإجراءات الأساسية */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* 1. رابط واتساب (جاهز) */}
                  {emp.whatsappLink !== "#" ? (
                    <a
                      href={emp.whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 transition-colors"
                    >
                      <span>💬</span> إرسال الرابط للواتساب
                    </a>
                  ) : (
                    <span className="text-[10px] text-rose-500 bg-rose-50 px-2 py-1 rounded">
                      ⚠️ الرابط غير جاهز (رقم غير صالح)
                    </span>
                  )}

                  {/* 2. فتح الرابط المباشر */}
                  {emp.orderPortalUrl && (
                    <a
                      href={emp.orderPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-100 px-3 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-200 transition-colors"
                    >
                      <span>🔗</span> فتح الرابط المباشر
                    </a>
                  )}

                  {/* 3. نسخ الرابط */}
                  <button
                    onClick={() => copyToClipboard(emp.orderPortalUrl, emp.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    {copiedId === emp.id ? "✅ تم النسخ" : "📋 نسخ الرابط"}
                  </button>
                </div>
              </div>

              {/* أزرار التحكم (تعديل، تجديد، حذف) */}
              <div className="flex items-center gap-2 border-t pt-3 sm:border-0 sm:pt-0">
                <Link
                  href={`/admin/shops/${shopId}/employees/${emp.id}/edit`}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900"
                >
                  تعديل
                </Link>
                <form action={renewEmployeeOrderPortalToken}>
                  <input type="hidden" name="id" value={emp.id} />
                  <input type="hidden" name="shopId" value={shopId} />
                  <button
                    type="submit"
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100"
                    title="تجديد الرابط (سيتم إبطال الرابط القديم)"
                  >
                    تجديد
                  </button>
                </form>
                <form action={deleteEmployee} onSubmit={(ev) => !confirm(`حذف الموظف "${emp.name}" نهائياً؟`) && ev.preventDefault()}>
                  <input type="hidden" name="id" value={emp.id} />
                  <input type="hidden" name="shopId" value={shopId} />
                  <button
                    type="submit"
                    className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100"
                  >
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