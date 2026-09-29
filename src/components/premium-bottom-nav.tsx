"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, Store, Sparkles, Users, Settings } from "lucide-react";

export function PremiumBottomNav() {
  const pathname = usePathname();

  // لا يظهر في صفحة الذكاء نفسها لمنع تكرار الواجهة
  if (pathname === "/admin/ai") return null;

  const tabs = [
    {
      id: "orders",
      name: "الطلبات",
      href: "/abo1stor3hlaa2kbr8-47",
      icon: ShoppingBag,
      active: pathname === "/abo1stor3hlaa2kbr8-47"
    },
    {
      id: "shops",
      name: "المحلات",
      href: "/abo1stor3hlaa2kbr8-47/shops",
      icon: Store,
      active: pathname.startsWith("/abo1stor3hlaa2kbr8-47/shops")
    },
    // زر الذكاء العائم في المنتصف
    {
      id: "ai_center",
      name: "الذكاء",
      isCenter: true,
      href: "/admin/ai",
      active: pathname === "/admin/ai"
    },
    {
      id: "couriers",
      name: "المناديب",
      href: "/abo1stor3hlaa2kbr8-47/couriers",
      icon: Users,
      active: pathname.startsWith("/abo1stor3hlaa2kbr8-47/couriers")
    },
    {
      id: "settings",
      name: "الإعدادات",
      href: "/abo1stor3hlaa2kbr8-47/settings",
      icon: Settings,
      active: pathname.startsWith("/abo1stor3hlaa2kbr8-47/settings")
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center pb-safe">
      <div className="w-full max-w-lg px-3 pb-3 pointer-events-auto">
        <div className="relative bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-[28px] shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.06)_inset] px-2 py-2 flex items-center justify-around">
          {tabs.map(tab => {
            if (tab.isCenter) {
              return (
                <div key={tab.id} className="relative -top-6 flex flex-col items-center">
                  <Link
                    href="/admin/ai"
                    className="group relative flex items-center justify-center"
                    title="مساعد الذكاء الاصطناعي Gemini"
                  >
                    {/* التوهج الخلفي للزر العائم */}
                    <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 rounded-full blur-xl opacity-75 group-hover:opacity-100 transition-opacity animate-pulse" />
                    
                    {/* جسم الزر العائم */}
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-500 p-[2px] shadow-[0_8px_24px_rgba(59,130,246,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)] active:scale-95 transition-transform duration-150">
                      <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center">
                        <Sparkles className="w-7 h-7 text-sky-400 animate-pulse" />
                      </div>
                    </div>
                  </Link>
                  <span className="text-[11px] font-extrabold text-sky-400 mt-1 drop-shadow">الذكاء</span>
                </div>
              );
            }

            const Icon = tab.icon!;
            return (
              <Link
                key={tab.id}
                href={tab.href!}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 active:scale-90 ${
                  tab.active
                    ? "text-sky-400 font-bold bg-white/[0.06] shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 transition-transform ${tab.active ? "scale-110" : ""}`} />
                <span className="text-[10.5px] tracking-tight">{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
