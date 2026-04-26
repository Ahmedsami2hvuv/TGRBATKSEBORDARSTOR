"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { StoreCartIcon } from "./store-cart-icon";

export function StoreHeaderActions() {
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
        ❤️
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
