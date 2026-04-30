"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function StaffPortalMenuClient({
  emp,
  authQ
}: {
  emp: any;
  authQ: string;
}) {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  return (
    <div className="mt-8 grid gap-3">
      {emp.canSubmitOrders && (
        <>
          <Link
            href={`/staff/portal/preparation?${authQ}`}
            className="group w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-700 py-4 text-sm font-black text-white shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <DynamicIcon
              icon={icons?.ui_flash}
              className="w-5 h-5"
              fallback={<span>🚀</span>}
            />
            إنشاء طلب تجهيز ذكي (تحليل)
          </Link>

          <Link
            href={`/staff/portal/submitted?${authQ}`}
            className="group w-full rounded-2xl border-2 border-sky-400 bg-white py-4 text-sm font-black text-sky-900 shadow-sm transition hover:bg-sky-50 active:scale-95 flex items-center justify-center gap-2"
          >
            <DynamicIcon
              icon={icons?.ui_tasks}
              className="w-5 h-5"
              fallback={<span>📑</span>}
            />
            الطلبات المرفوعة حالياً
          </Link>
        </>
      )}

      {emp.canViewArchived && (
        <Link
          href={`/staff/portal/archived?${authQ}`}
          className="group w-full rounded-2xl border-2 border-slate-300 bg-slate-50 py-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95 flex items-center justify-center gap-2"
        >
          <DynamicIcon
            icon={icons?.ui_box}
            className="w-5 h-5 opacity-70"
            fallback={<span>📦</span>}
          />
          الأرشيف (الطلبات القديمة)
        </Link>
      )}

      {emp.canManageStore && (
        <Link
          href={`/staff/portal/store?${authQ}`}
          className="group w-full rounded-2xl border-2 border-purple-400 bg-white py-4 text-sm font-black text-purple-900 shadow-sm transition hover:bg-purple-50 active:scale-95 flex items-center justify-center gap-2"
        >
          <DynamicIcon
            icon={icons?.ui_shops}
            className="w-5 h-5"
            fallback={<span>🏪</span>}
          />
          إدارة المتجر (الأقسام والمنتجات)
        </Link>
      )}

      {!emp.canSubmitOrders && !emp.canViewArchived && !emp.canManageStore && (
        <p className="p-4 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl">
          ليس لديك أي صلاحيات نشطة حالياً. يرجى مراجعة المسؤول.
        </p>
      )}
    </div>
  );
}
