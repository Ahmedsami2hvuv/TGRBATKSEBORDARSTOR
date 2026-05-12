import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DraggableBackButton } from "@/components/draggable-back-button";
import { StoreSidePanels } from "@/components/store-side-panels";
import { StoreHeaderActions } from "./store-header-actions";
import { StoreSearchBar } from "./_components/store-search-bar";

export const metadata: Metadata = {
  title: "خصيب ستور(ابو الاكبر للتوصيل)",
  description: "تسوق أفضل المنتجات بأفضل الأسعار",
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans pb-20 transition-colors duration-300" dir="rtl">
      <StoreSidePanels />
      <header className="sticky top-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/store" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-none group-hover:scale-110 transition-transform">
              <span className="text-white text-xl">🏠</span>
            </div>
            <span className="font-black text-sm md:text-xl tracking-tight text-slate-900 dark:text-white leading-tight">
                خصيب ستور<br className="md:hidden" />
                <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold block md:inline md:mr-1">
                    (ابو الاكبر للتوصيل)
                </span>
            </span>
          </Link>

          <Suspense fallback={<div className="flex-1 max-w-md mx-4 h-10 bg-slate-100/50 dark:bg-slate-800/50 animate-pulse rounded-2xl" />}>
            <StoreSearchBar />
          </Suspense>

          <StoreHeaderActions />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-10">
        {children}
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="w-12 h-12 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚡</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-bold">جميع الحقوق محفوظة &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>

      <DraggableBackButton />
    </div>
  );
}
