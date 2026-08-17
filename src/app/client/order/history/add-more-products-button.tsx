"use client";

import { useRouter } from "next/navigation";

export function AddMoreProductsButton({ orderNumber }: { orderNumber: number | string }) {
  const router = useRouter();

  const handleAddMore = () => {
    localStorage.setItem("kse_add_to_order_id", String(orderNumber));
    window.dispatchEvent(new CustomEvent("kse:show-toast", { 
      detail: { message: `جاري إضافة منتجات لطلبك رقم #${orderNumber} 🛍️`, type: "success" } 
    }));
    router.push("/store");
  };

  return (
    <button
      type="button"
      onClick={handleAddMore}
      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 whitespace-nowrap"
      title="إضافة منتجات لهذه الطلبية"
    >
      <span>➕</span>
      <span>إضافة منتجات</span>
    </button>
  );
}
