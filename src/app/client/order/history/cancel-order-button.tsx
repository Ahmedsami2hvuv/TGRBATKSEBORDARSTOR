"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  return (
    <button
      disabled={isPending}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!confirm("أيها العميل، هل أنت متأكد من رفض هذا الطلب؟ لا يمكن التراجع عن الرفض.")) return;

        setIsPending(true);
        const formData = new FormData();
        formData.append("orderNumber", String(orderNumber));
        formData.append("e", e);
        formData.append("exp", exp);
        formData.append("s", s);

        try {
          const res = await cancelClientOrder(formData);
          if (res?.error) {
            alert(res.error);
          } else {
            // تحديث الصفحة ليعكس التغيير فوراً
            router.refresh();
          }
        } catch (err) {
          alert("فشل رفض الطلب، يرجى المحاولة لاحقاً.");
        } finally {
          setIsPending(false);
        }
      }}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-rose-500 bg-white text-lg leading-none text-rose-600 shadow-md transition hover:scale-110 hover:bg-rose-50 active:scale-95 ${
        isPending ? "opacity-50 cursor-wait" : ""
      }`}
      title="رفض الطلب نهائياً"
    >
      {isPending ? "..." : "❌"}
    </button>
  );
}
