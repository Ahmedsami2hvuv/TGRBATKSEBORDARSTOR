"use client";

import { useState, ReactNode } from "react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

export function HiddenCouriersSection({
  count,
  icons,
  children,
}: {
  count: number;
  icons: GlobalIconsConfig;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10 overflow-hidden transition-all shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="w-full flex items-center justify-between p-4 text-right hover:bg-amber-500/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <DynamicIcon config={icons} iconKey="ui_eye_off" fallback="🕶️" className="w-5 h-5 text-amber-700 dark:text-amber-400" />
          <h2 className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-300">
            المندوبون المخفيون من قوائم الإسناد ({count})
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/30">
            {isOpen ? "إغلاق القائمة 🔼" : "عرض القائمة 🔽"}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-amber-500/20">
          <p className="mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            هؤلاء المندوبون مخفيون من قوائم الإسناد (لا يظهرون عند اختيار مندوب للطلبات). يمكنك إعادتهم بالضغط على &quot;إظهار في قوائم الإسناد&quot;.
          </p>
          {children}
        </div>
      )}
    </section>
  );
}
