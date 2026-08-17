"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export function AddMoreOrderBanner() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const pathname = usePathname();

  const checkActiveOrder = () => {
    if (typeof window !== "undefined") {
      const activeId = localStorage.getItem("kse_add_to_order_id");
      setOrderId(activeId || null);
    }
  };

  useEffect(() => {
    checkActiveOrder();

    // فحص دوري وسريع جداً للالتقاط الفوري بدون ريفرش
    const interval = setInterval(checkActiveOrder, 500);

    const handleStorageChange = () => checkActiveOrder();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("kse:add-to-order-changed", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("kse:add-to-order-changed", handleStorageChange);
    };
  }, [pathname]);

  if (!orderId) return null;

  const handleCancel = () => {
    localStorage.removeItem("kse_add_to_order_id");
    setOrderId(null);
    window.dispatchEvent(new Event("kse:add-to-order-changed"));
    window.dispatchEvent(new CustomEvent("kse:show-toast", { detail: { message: "تم إلغاء الإضافة للطلب السابق", type: "info" } }));
  };

  return (
    <div className="w-full bg-gradient-to-r from-sky-600 via-indigo-600 to-blue-600 text-white px-4 py-2.5 rounded-2xl shadow-md flex items-center justify-between gap-2 text-xs md:text-sm font-bold mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-base shrink-0 animate-bounce">🛍️</span>
        <span className="truncate leading-tight">
          أنت تقوم بإضافة منتجات لطلبك النشط <span className="font-black underline bg-white/20 px-1.5 py-0.5 rounded-md">#{orderId}</span>
        </span>
      </div>
      <button
        onClick={handleCancel}
        className="bg-white text-rose-600 hover:bg-rose-50 px-3 py-1 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 shadow-sm active:scale-95"
      >
        إلغاء الإضافة
      </button>
    </div>
  );
}
