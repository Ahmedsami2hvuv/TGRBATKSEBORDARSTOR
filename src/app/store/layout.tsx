import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DraggableBackButton } from "@/components/draggable-back-button";
import { StoreSidePanels } from "@/components/store-side-panels";

export const metadata: Metadata = {
  title: "خصيب ستور(ابو الاكبر للتوصيل)",
  description: "تسوق أفضل المنتجات بأفضل الأسعار",
};

// مكون شريط التنقل السفلي
const BottomNav = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.05)] rounded-t-3xl border-t border-slate-100 pb-safe">
      <div className="flex items-center justify-around h-16 md:h-20 px-2 md:px-6">
        <Link href="/store" className="flex flex-col items-center justify-center gap-1 w-full h-full text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] md:text-xs font-bold">الرئيسية</span>
        </Link>
        <Link href="/store/categories" className="flex flex-col items-center justify-center gap-1 w-full h-full text-slate-400 hover:text-green-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <span className="text-[10px] md:text-xs font-bold">الفئات</span>
        </Link>
        <Link href="/store/cart" className="flex flex-col items-center justify-center gap-1 w-full h-full text-slate-400 hover:text-green-600 transition-colors relative">
          <div className="absolute top-1 right-1/4 md:right-1/3 w-2 h-2 bg-red-500 rounded-full"></div>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-[10px] md:text-xs font-bold">السلة</span>
        </Link>
        <Link href="/store/orders" className="flex flex-col items-center justify-center gap-1 w-full h-full text-slate-400 hover:text-green-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-[10px] md:text-xs font-bold">الطلبات</span>
        </Link>
        <Link href="/store/profile" className="flex flex-col items-center justify-center gap-1 w-full h-full text-slate-400 hover:text-green-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[10px] md:text-xs font-bold">الملف الشخصي</span>
        </Link>
      </div>
    </div>
  );
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white font-sans pb-24 transition-colors duration-300" dir="rtl">
      <StoreSidePanels />
      
      {/* الشريط العلوي الجديد */}
      <header className="sticky top-0 z-50 bg-white pt-4 pb-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center flex-1">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              التوصيل إلى
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </span>
            <div className="flex items-center gap-1 cursor-pointer">
              <span className="text-sm font-bold text-slate-800">إضافة عنوان</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-800" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center font-bold text-green-600 bg-green-50 px-2 py-1 rounded-xl text-xs">
              <span className="text-[10px]">🛒</span>
              <span className="ml-1">BC+</span>
            </div>
          </div>
        </div>
        
        {/* شريط البحث والكاميرا */}
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <div className="w-12 h-12 rounded-full border border-green-100 bg-white flex items-center justify-center text-green-500 relative shrink-0 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white">+</div>
          </div>
          <div className="flex-1 relative">
            <input type="text" placeholder="بحث" className="w-full h-12 bg-white rounded-2xl border border-slate-100 shadow-sm pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {children}
      </main>

      <BottomNav />
      <DraggableBackButton />
    </div>
  );
}
