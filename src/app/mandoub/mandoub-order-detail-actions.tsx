"use client";

import Link from "next/link";

/** يستمع إليه `MandoubCustomerEditForm` لتبديل إظهار نموذج التعديل (فتح / إخفاء) */
export const MANDOUB_ORDER_EDIT_TOGGLE = "mandoub-order-edit-toggle";

export function MandoubOrderDetailActions({ closeHref }: { closeHref: string }) {
  return (
    <div className="flex flex-shrink-0 flex-wrap items-center justify-start gap-2">
      <Link
        href={closeHref}
        className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-base font-bold text-sky-900 shadow-sm transition hover:bg-sky-50"
      >
        إغلاق الطلب
      </Link>
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent(MANDOUB_ORDER_EDIT_TOGGLE));
        }}
        className="rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2 text-base font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
      >
        تعديل الطلب
      </button>
    </div>
  );
}
