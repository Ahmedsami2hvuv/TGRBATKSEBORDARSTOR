"use client";

import type { GlobalIconsConfig } from "@/lib/icon-settings";

/**
 * زر أيقونة البحث المعروض داخل ترويسة لوحة المجهز.
 * عند النقر يُرسل حدثاً مخصصاً يستمع له `PreparerOrdersSection` ليفتح حقل البحث.
 *
 * استُخدم مقاس وستايل متناسق مع باقي أزرار الترويسة (محفظتي/طلب جديد/تجهيز الطلبات)
 * مع أيقونة SVG ثابتة لضمان عرض نظيف بدون اعتماد على إعدادات الأيقونات.
 */
export function PreparerSearchTrigger({
  icons: _icons,
}: {
  icons?: GlobalIconsConfig | null;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("preparer:open-search"))}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D0DDFB] bg-[#EEF3FF] text-[#0B2E8C] shadow-xs transition hover:bg-[#DCE7FC] hover:scale-105 active:scale-95 cursor-pointer"
      aria-label="فتح البحث"
      title="بحث"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-5 w-5"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
  );
}
