"use client";

import { useEffect, useState } from "react";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function StoreCartIcon() {
  const [count, setCount] = useState(0);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  useEffect(() => {
    const updateCount = () => {
      const cart = JSON.parse(localStorage.getItem("kse_cart") || "[]");
      setCount(cart.reduce((acc: number, item: any) => acc + item.quantity, 0));
    };

    updateCount();
    window.addEventListener("storage", updateCount);
    window.addEventListener("cart-updated", updateCount);
    return () => {
      window.removeEventListener("storage", updateCount);
      window.removeEventListener("cart-updated", updateCount);
    };
  }, []);

  return (
    <div className={`relative inline-flex items-center justify-center ${count > 0 ? "animate-cart-dance" : ""}`}>
      <DynamicIcon icon={icons?.store_cart} className="text-2xl" fallback="🛒" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-sm">
          {count}
        </span>
      )}
    </div>
  );
}
