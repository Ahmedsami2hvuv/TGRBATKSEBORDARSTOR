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
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem("kse:staff:scale");
    if (saved) setScale(parseFloat(saved));
    getGlobalIcons().then(setIcons);
  }, []);

  useEffect(() => {
    localStorage.setItem("kse:staff:scale", scale.toString());
  }, [scale]);

  return (
    <div className="mt-4">
      {/* التحكم في حجم القائمة */}
      <div className="flex items-center justify-between mb-6 bg-white/50 dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-200 dark:border-white/10 backdrop-blur-sm">
        <span className="text-xs font-black text-slate-500 dark:text-slate-400 mr-2">تغيير حجم الواجهة</span>
        <div className="flex gap-2">
          <button
            onClick={() => setScale(prev => Math.max(0.8, prev - 0.1))}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-white/10 text-xl font-bold active:scale-90 transition-all"
          >
            −
          </button>
          <button
            onClick={() => setScale(prev => Math.min(5, prev + 0.1))}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-white/10 text-xl font-bold active:scale-90 transition-all text-sky-500"
          >
            +
          </button>
        </div>
      </div>

      <div className="grid gap-3" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        {emp.canSubmitOrders && (
        <>
          <Link
            href={`/staff/portal/preparation?${authQ}`}
            className="group w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-700 py-4 text-sm font-black text-white shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <DynamicIcon
              iconKey="ui_flash"
              config={icons}
              className="w-5 h-5"
              fallback={<span>🚀</span>}
            />
            إنشاء طلب تجهيز ذكي (تحليل)
          </Link>

          <Link
            href={`/staff/portal/double-order?${authQ}`}
            className="group w-full rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 py-4 text-sm font-black text-white shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <DynamicIcon
              iconKey="ui_map"
              config={icons}
              className="w-5 h-5"
              fallback={<span>📍</span>}
            />
            رفع طلب ذو وجهتين (مرسل-مستلم)
          </Link>

          <Link
            href={`/staff/portal/profits?${authQ}`}
            className="group w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-4 text-sm font-black text-white shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <DynamicIcon
              iconKey="ui_wallet"
              config={icons}
              className="w-5 h-5"
              fallback={<span>💰</span>}
            />
            أرباحي (المحفظة)
          </Link>

          <Link
            href={`/staff/portal/submitted?${authQ}`}
            className="group w-full rounded-2xl border-2 border-sky-400 bg-white py-4 text-sm font-black text-sky-900 shadow-sm transition hover:bg-sky-50 active:scale-95 flex items-center justify-center gap-2"
          >
            <DynamicIcon
              iconKey="ui_tasks"
              config={icons}
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
            iconKey="ui_box"
            config={icons}
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
            iconKey="ui_shops"
            config={icons}
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
    </div>
  );
}
