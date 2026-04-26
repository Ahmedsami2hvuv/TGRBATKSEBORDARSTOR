"use client";

import { useMemo } from "react";
import { ad } from "@/lib/admin-ui";
import {
  ADMIN_OFFICE_LABEL,
  ADMIN_PHONE_FROM_SHOP_LOCAL,
} from "@/lib/admin-order-from-admin-constants";

export type ShopEmployeeRow = {
  id: string;
  shopId: string;
  name: string;
  phone: string;
};

/**
 * بعد اختيار المحل: يعرض الإدارة وموظفي المحل كأزرار جاهزة للنقر (بدون بحث).
 */
export function ShopEmployeeQuickPick({
  shopId,
  employees,
  selectedEmployeeId,
  recipientKind,
  onPickEmployee,
  onPickAdminOffice,
}: {
  shopId: string;
  employees: ShopEmployeeRow[];
  selectedEmployeeId: string;
  recipientKind: "none" | "employee" | "admin";
  onPickEmployee: (e: ShopEmployeeRow) => void;
  onPickAdminOffice: () => void;
}) {
  const shopEmployees = useMemo(
    () => employees.filter((e) => e.shopId === shopId),
    [employees, shopId]
  );

  if (!shopId) {
    return (
      <div className="flex flex-col gap-1 text-sm mt-3">
        <span className={ad.label}>وجهة سريعة (العميل أو الإدارة)</span>
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
          اختر المحل أولاً لتظهر أزرار العملاء هنا.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm mt-4">
      <span className={ad.label}>وجهة سريعة (العميل أو الإدارة)</span>
      <p className="text-[11px] text-slate-500">
        اضغط على زر العميل أو الإدارة لملء رقم الوجهة والمنطقة تلقائياً.
      </p>
      <div className="flex flex-wrap gap-2 mt-1">
        <button
          type="button"
          className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
            recipientKind === "admin"
              ? "border-violet-600 bg-violet-600 text-white shadow-md"
              : "border-violet-300 bg-violet-50 text-violet-950 hover:bg-violet-100"
          }`}
          onClick={onPickAdminOffice}
        >
          {ADMIN_OFFICE_LABEL} — {ADMIN_PHONE_FROM_SHOP_LOCAL}
        </button>

        {shopEmployees.map((emp) => {
          const isSelected = recipientKind === "employee" && selectedEmployeeId === emp.id;
          return (
            <button
              key={emp.id}
              type="button"
              className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                isSelected
                  ? "border-sky-600 bg-sky-600 text-white shadow-md"
                  : "border-sky-300 bg-sky-50 text-sky-950 hover:bg-sky-100"
              }`}
              onClick={() => onPickEmployee(emp)}
            >
              {emp.name || "بدون اسم"} — {emp.phone}
            </button>
          );
        })}
      </div>
      {shopEmployees.length === 0 && (
        <p className="text-xs text-slate-500 mt-1">لا يوجد عملاء (موظفون) مسجلون في هذا المحل.</p>
      )}
    </div>
  );
}
