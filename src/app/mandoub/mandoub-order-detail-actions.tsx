"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

/** يستمع إليه `MandoubCustomerEditForm` لتبديل إظهار نموذج التعديل (فتح / إخفاء) */
export const MANDOUB_ORDER_EDIT_TOGGLE = "mandoub-order-edit-toggle";

export function MandoubOrderDetailActions({ closeHref }: { closeHref: string }) {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const router = useRouter();

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  // ملاحظة: تم إزالة زر «إغلاق الطلب» لأن نافذة الطلب لها زر إغلاق علوي بالفعل.
  void closeHref;
  void router;

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center justify-start gap-2">
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent(MANDOUB_ORDER_EDIT_TOGGLE));
        }}
        className="flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2 text-base font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
      >
        <DynamicIcon iconKey="ui_edit" config={icons} fallback="✏️" className="w-4 h-4" />
        تعديل الطلب
      </button>
    </div>
  );
}
