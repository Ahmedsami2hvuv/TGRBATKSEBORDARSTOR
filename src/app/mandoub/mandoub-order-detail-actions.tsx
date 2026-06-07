"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

/** يستمع إليه `MandoubCustomerEditForm` لتبديل إظهار نموذج التعديل (فتح / إخفاء) */
export const MANDOUB_ORDER_EDIT_TOGGLE = "mandoub-order-edit-toggle";

export function MandoubOrderDetailActions({ closeHref, orderId }: { closeHref: string; orderId: string }) {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const router = useRouter();

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const handleClose = () => {
    if (closeHref && closeHref !== "#") {
      window.location.href = closeHref;
    } else {
      const p = new URLSearchParams(window.location.search);
      p.delete("activeOrderId");
      window.location.href = window.location.pathname + "?" + p.toString();
    }
  };

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center justify-start gap-2">
      <button
        type="button"
        onClick={handleClose}
        className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-base font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
      >
        <DynamicIcon iconKey="ui_close" config={icons} fallback="✕" className="w-4 h-4 text-slate-500" />
        إغلاق الطلب
      </button>

      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent(MANDOUB_ORDER_EDIT_TOGGLE, { detail: { orderId } }));
        }}
        className="flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2 text-base font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100 active:scale-95"
      >
        <DynamicIcon iconKey="ui_edit" config={icons} fallback="✏️" className="w-4 h-4" />
        تعديل الطلب
      </button>
    </div>
  );
}
