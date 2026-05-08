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
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-50 text-sky-700 shadow-sm transition hover:bg-sky-100 hover:text-sky-900 dark:border-sky-400 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/50"
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
