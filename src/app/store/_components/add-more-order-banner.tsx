"use client";

import { useState, useEffect } from "react";

export function AddMoreOrderBanner() {
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const activeId = localStorage.getItem("kse_add_to_order_id");
    if (activeId) {
      setOrderId(activeId);
    }
  }, []);

  if (!orderId) return null;

  const handleCancel = () => {
    localStorage.removeItem("kse_add_to_order_id");
    setOrderId(null);
    window.dispatchEvent(new CustomEvent("kse:show-toast", { detail: { message: "تم إلغاء الإضافة للطلب السابق", type: "info" } }));
  };

  return (
    <div className="sticky top-2 z-40 w-full bg-gradient-to-r from-sky-600 to-indigo-600 text-white px-4 py-3 rounded-2xl shadow-xl border border-sky-400/30 flex items-center justify-between gap-3 text-xs md:text-sm font-bold mb-4 animate-in fade-in slide-in-from-top-4 duration-300 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="text-base animate-pulse">🛒</span>
        <span>أنت تقوم بإضافة منتجات لطلبك النشط <span className="font-black underline">#{orderId}</span> (سيتم دمجها في طلبك الحالي)</span>
      </div>
      <button
        onClick={handleCancel}
        className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-xl text-xs font-black transition-colors whitespace-nowrap active:scale-95"
      >
        إلغاء الإضافة
      </button>
    </div>
  );
}
