"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

/** يستمع إليه `MandoubCustomerEditForm` لتبديل إظهار نموذج التعديل (فتح / إخفاء) */
export const MANDOUB_ORDER_EDIT_TOGGLE = "mandoub-order-edit-toggle";

export function MandoubOrderDetailActions({
  closeHref,
  orderId,
  onCloseModal,
}: {
  closeHref: string;
  orderId: string;
  onCloseModal?: () => void;
}) {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const router = useRouter();

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const handleClose = () => {
    if (onCloseModal) {
      onCloseModal();
      return;
    }
    if (closeHref && closeHref !== "#") {
      window.location.href = closeHref;
    } else {
      const p = new URLSearchParams(window.location.search);
      p.delete("activeOrderId");
      const newPath = window.location.pathname + (p.toString() ? "?" + p.toString() : "");
      window.history.pushState({}, "", newPath);
    }
  };

  return (
    <div className="flex flex-shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent(MANDOUB_ORDER_EDIT_TOGGLE, { detail: { orderId } }));
        }}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-600/80 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 dark:text-emerald-300 shadow-sm transition hover:bg-emerald-100 active:scale-95 shrink-0"
      >
        <DynamicIcon iconKey="ui_edit" config={icons} fallback="✏️" className="w-3 h-3" />
        تعديل الطلب
      </button>
    </div>
  );
}
