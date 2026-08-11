import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DraggableBackButton } from "@/components/draggable-back-button";
import { StoreSidePanels } from "@/components/store-side-panels";

export const metadata: Metadata = {
  title: "خصيب ستور(ابو الاكبر للتوصيل)",
  description: "تسوق أفضل المنتجات بأفضل الأسعار",
};

import { BottomNav } from "./_components/bottom-nav";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white font-sans pb-24 transition-colors duration-300 relative z-10" dir="rtl">
      {/* غطاء أبيض صلب لحجب صورة الخلفية */}
      <div className="fixed inset-0 bg-white -z-10"></div>
      
      <StoreSidePanels />
      
      {/* الشريط العلوي الجديد */}
      <header className="sticky top-0 z-50 bg-white pt-4 pb-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center mb-4">
          <div className="flex flex-col items-center justify-center">
            <span className="text-lg font-black text-green-600">خصيب ستور ابو الاكبر للتوصيل</span>
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
