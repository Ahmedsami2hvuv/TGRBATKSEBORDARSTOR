"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function BottomNav() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    // حساب العدد الإجمالي للمنتجات
    const calculateCart = () => {
      try {
        const cartStr = localStorage.getItem("kse_cart");
        if (cartStr) {
          const cart = JSON.parse(cartStr);
          const total = cart.reduce((sum: number, item: any) => sum + (item.qty || 1), 0);
          setCartCount(total);
        } else {
          setCartCount(0);
        }
      } catch (e) {
        setCartCount(0);
      }
    };

    calculateCart();

    // الاستماع لأي تحديثات على السلة
    window.addEventListener("cart_updated", calculateCart);
    // الاستماع لتغييرات الـ localStorage في تبويبات أخرى
    window.addEventListener("storage", calculateCart);

    return () => {
      window.removeEventListener("cart_updated", calculateCart);
      window.removeEventListener("storage", calculateCart);
    };
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-md shadow-[0_-4px_10px_rgba(0,0,0,0.05)] rounded-t-3xl border-t border-white/50 pb-safe">
      <div className="flex items-center justify-around h-16 md:h-20 px-2 md:px-6">
        <Link href="/store" className="flex flex-col items-center justify-center gap-1 w-full h-full text-slate-400 hover:text-green-600 transition-colors focus:text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] md:text-xs font-bold">الرئيسية</span>
        </Link>
        <Link href="/store/categories" className="flex flex-col items-center justify-center gap-1 w-full h-full text-slate-400 hover:text-green-600 transition-colors focus:text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <span className="text-[10px] md:text-xs font-bold">الأقسام</span>
        </Link>
        <Link href="/store/cart" className="flex flex-col items-center justify-center gap-1 w-full h-full text-slate-400 hover:text-green-600 transition-colors focus:text-green-600 relative">
          {cartCount > 0 && (
            <div className="absolute top-1 right-1/4 md:right-1/3 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center shadow-sm">
              {cartCount > 99 ? "+99" : cartCount}
            </div>
          )}
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-[10px] md:text-xs font-bold">السلة</span>
        </Link>
        <Link href="/store/orders" className="flex flex-col items-center justify-center gap-1 w-full h-full text-slate-400 hover:text-green-600 transition-colors focus:text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-[10px] md:text-xs font-bold">الطلبات</span>
        </Link>
        <Link href="/store/profile" className="flex flex-col items-center justify-center gap-1 w-full h-full text-slate-400 hover:text-green-600 transition-colors focus:text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[10px] md:text-xs font-bold">ملفي</span>
        </Link>
      </div>
    </div>
  );
}
