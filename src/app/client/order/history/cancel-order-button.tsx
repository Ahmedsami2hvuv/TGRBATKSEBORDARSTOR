"use client";

import { cancelClientOrder } from "../actions";

export function CancelOrderButton({
  orderNumber,
  e,
  exp,
  s
}: {
  orderNumber: number;
  e: string;
  exp: string;
  s: string;
}) {
  return (
    <button
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!confirm("أيها العميل، هل أنت متأكد من رفض هذا الطلب؟ لا يمكن التراجع عن الرفض.")) return;

        const formData = new FormData();
        formData.append("orderNumber", String(orderNumber));
        formData.append("e", e);
        formData.append("exp", exp);
        formData.append("s", s);

        try {
          await cancelClientOrder(formData);
        } catch (err) {
          alert("فشل رفض الطلب، يرجى المحاولة لاحقاً.");
        }
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-rose-500 bg-white text-lg leading-none text-rose-600 shadow-md transition hover:scale-110 hover:bg-rose-50 active:scale-95"
      title="رفض الطلب نهائياً"
    >
      ❌
    </button>
  );
}
