"use client";

import type { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

/**
 * زر أيقونة البحث المعروض داخل ترويسة لوحة المجهز.
 * عند النقر يُرسل حدثاً مخصصاً يستمع له `PreparerOrdersSection` ليفتح حقل البحث.
 */
export function PreparerSearchTrigger({
  icons,
}: {
  icons?: GlobalIconsConfig | null;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("preparer:open-search"))}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      aria-label="فتح البحث"
      title="بحث"
    >
      <DynamicIcon
        iconKey="ui_search"
        config={icons}
        className="h-4 w-4"
        fallback={<span className="text-sm">🔍</span>}
      />
    </button>
  );
}
