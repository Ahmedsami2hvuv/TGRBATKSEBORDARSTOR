"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const [cartCount, setCartCount] = useState(0);
  const pathname = usePathname();
  const [clickedPath, setClickedPath] = useState<string | null>(null);

  useEffect(() => {
    // إخفاء تأثير النقر عندما يتم تغيير الصفحة فعلياً
    setClickedPath(null);
  }, [pathname]);

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
    window.addEventListener("cart-updated", calculateCart);
    // الاستماع لتغييرات الـ localStorage في تبويبات أخرى
    window.addEventListener("storage", calculateCart);

    return () => {
      window.removeEventListener("cart-updated", calculateCart);
      window.removeEventListener("storage", calculateCart);
    };
  }, []);

  const navItems = [
    { href: "/store", label: "الرئيسية", exact: true, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )},
    { href: "/store/categories", label: "الأقسام", exact: false, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )},
    { href: "/store/cart", label: "السلة", exact: false, badge: cartCount, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )},
    { href: "/store/orders", label: "الطلبات", exact: false, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )},
    { href: "/store/profile", label: "ملفي", exact: false, icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )}
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-md shadow-[0_-4px_10px_rgba(0,0,0,0.05)] rounded-t-3xl border-t border-white/50 pb-safe">
      <div className="flex items-center justify-around h-16 md:h-20 px-2 md:px-6">
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
          const isClicked = clickedPath === item.href;
          
          let containerClass = "flex flex-col items-center justify-center gap-1 w-full h-full transition-all relative ";
          
          if (isClicked) {
            containerClass += "text-green-500 scale-95 opacity-70";
          } else if (isActive) {
            containerClass += "text-green-600 scale-110 drop-shadow-sm";
          } else {
            containerClass += "text-slate-400 hover:text-green-500 active:scale-95";
          }

          return (
            <Link 
              key={item.href}
              href={item.href} 
              onClick={() => {
                if (pathname !== item.href) {
                  setClickedPath(item.href);
                }
              }}
              className={containerClass}
            >
              {item.badge ? (
                <div className="absolute top-1 right-1/4 md:right-1/3 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center shadow-sm z-10">
                  {item.badge > 99 ? "+99" : item.badge}
                </div>
              ) : null}
              
              <div className="relative">
                {item.icon}
                {isClicked && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-green-500 rounded-full animate-pulse blur-sm"></span>
                )}
              </div>
              <span className={`text-[10px] md:text-xs font-bold ${isActive ? 'text-green-600' : ''}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
