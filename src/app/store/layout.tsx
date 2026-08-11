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
        <div className="max-w-7xl mx-auto flex items-center justify-center mb-4">
          <div className="flex flex-col items-center justify-center">
            <span className="text-lg font-black text-green-600">حصري بستور أبو الأكبر للتوصيل</span>
          </div>
        </div>
        
        {/* شريط البحث والكاميرا */}
        <div className="max-w-7xl mx-auto flex items-center gap-2">

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

    </div>
  );
}
