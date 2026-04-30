"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { StoreCartIcon } from "./store-cart-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function StoreHeaderActions() {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const openFavorites = () => {
    window.dispatchEvent(new Event("open-favorites"));
  };

  const openCart = () => {
    window.dispatchEvent(new Event("open-cart"));
  };

  return (
    <div className="flex items-center gap-2 md:gap-3">
      <ThemeToggle />

      <button
        onClick={openFavorites}
        className="p-2.5 text-slate-500 hover:text-rose-500 transition bg-slate-100 dark:bg-slate-800 rounded-2xl"
        title="المفضلة"
      >
        <DynamicIcon icon={icons?.store_favorites} fallback="❤️" />
      </button>

      <button
        onClick={openCart}
        className="relative p-2.5 bg-violet-600 text-white rounded-2xl hover:bg-violet-700 transition shadow-lg shadow-violet-100 dark:shadow-none"
      >
        <StoreCartIcon />
      </button>
    </div>
  );
}
