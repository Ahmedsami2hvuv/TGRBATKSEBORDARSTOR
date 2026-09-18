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
      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-[#C9A86A] bg-[#FDF6E3] px-3 text-xs font-black text-[#8B6A2A] shadow-[0_2px_8px_rgba(201,168,106,0.2),inset_0_1px_0_white] transition-all hover:bg-[#FAF0D7] hover:scale-105 active:scale-95 cursor-pointer select-none shrink-0"
      aria-label="تحديد سريع"
      title="تحديد سريع للطلبات القابلة للإسناد"
    >
      <DynamicIcon
        iconKey="ui_flash"
        config={icons}
        className="h-4 w-4 text-[#C9A86A]"
        fallback={<span>⚡</span>}
      />
      <span className="whitespace-nowrap font-black">تحديد سريع</span>
    </button>
  );
}
