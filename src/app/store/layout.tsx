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
import { StoreHeader } from "./_components/store-header";
import { GlobalToast } from "./_components/global-toast";
import { TopLoadingBar } from "./_components/top-loading-bar";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white font-sans pb-24 transition-colors duration-300 relative z-10" dir="rtl">
      {/* غطاء أبيض صلب لحجب صورة الخلفية */}
      <div className="fixed inset-0 bg-white -z-10"></div>
      
      <StoreSidePanels />
      
      {/* الشريط العلوي الجديد الذي يحتوي الأزرار والبحث */}
      <StoreHeader />
      
      {/* مؤشر التحميل العلوي */}
      <TopLoadingBar />
      
      {/* التنبيهات العائمة للتطبيق */}
      <GlobalToast />

      <main className="max-w-7xl mx-auto px-4 py-4">
        {children}
      </main>

      <BottomNav />

    </div>
  );
}
