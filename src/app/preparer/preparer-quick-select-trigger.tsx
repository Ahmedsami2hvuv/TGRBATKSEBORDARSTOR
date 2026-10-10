"use client";

import type { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

/**
 * زر التحديد السريع الموضوع في ترويسة صفحة المجهز بجانب اسم المجهز.
 * عند النقر يُرسل حدثاً مخصصاً يستمع له PreparerOrderTable لفتح/إغلاق لوحة التحديد السريع.
 */
export function PreparerQuickSelectTrigger({
  icons,
}: {
  icons?: GlobalIconsConfig | null;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("preparer:toggle-quick-select"))}
      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#D0DDFB] bg-[#EEF3FF] px-3 text-xs font-black text-[#0B2E8C] shadow-xs transition-all hover:bg-[#DCE7FC] hover:scale-105 active:scale-95 cursor-pointer select-none shrink-0"
      aria-label="تحديد سريع"
      title="تحديد سريع للطلبات القابلة للإسناد"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
      <span className="whitespace-nowrap font-black">تحديد سريع</span>
    </button>
  );
}
