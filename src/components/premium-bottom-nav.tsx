"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, Store, Users, Settings } from "lucide-react";

export function PremiumBottomNav() {
  const pathname = usePathname();
  const holdTimerRef = useRef<any>(null);
  const isHoldTriggeredRef = useRef(false);

  // لا يظهر في صفحة الذكاء نفسها
  if (pathname === "/admin/ai") return null;

  const triggerFloatingAi = () => {
    if (typeof window !== "undefined") {
      if (navigator.vibrate) navigator.vibrate(60);
      const anyWin = window as any;
      if (anyWin.AndroidGestures && anyWin.AndroidGestures.openFloatingAiChat) {
        anyWin.AndroidGestures.openFloatingAiChat();
      } else {
        window.location.href = "/admin/ai";
      }
    }
  };

  const handleHomeTouchStart = () => {
    isHoldTriggeredRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      isHoldTriggeredRef.current = true;
      triggerFloatingAi();
    }, 500);
  };

  const handleHomeTouchEnd = (e: React.TouchEvent) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    if (isHoldTriggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const tabs = [
    {
      id: "orders",
      name: "الطلبات",
      href: "/abo1stor3hlaa2kbr8-47",
      icon: ShoppingBag,
      active: pathname === "/abo1stor3hlaa2kbr8-47",
      isHome: true
    },
    {
      id: "shops",
      name: "المحلات",
      href: "/abo1stor3hlaa2kbr8-47/shops",
      icon: Store,
      active: pathname.startsWith("/abo1stor3hlaa2kbr8-47/shops")
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
        <div className="relative bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-[28px] shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.06)_inset] px-3 py-2 flex items-center justify-around">
          {tabs.map(tab => {
            const Icon = tab.icon;
            if (tab.isHome) {
              return (
                <Link
                  key={tab.id}
                  id="home-nav-btn"
                  href={tab.href}
                  onTouchStart={handleHomeTouchStart}
                  onTouchEnd={handleHomeTouchEnd}
                  onTouchCancel={() => {
                    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    triggerFloatingAi();
                  }}
                  title="انقر مطولاً لفتح المساعد الذكي الخارق"
                  className={`flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all duration-200 active:scale-90 ${
                    tab.active
                      ? "text-sky-400 font-bold bg-white/[0.08] shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1 transition-transform ${tab.active ? "scale-110" : ""}`} />
                  <span className="text-[11px] tracking-tight">{tab.name}</span>
                </Link>
              );
            }

            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all duration-200 active:scale-90 ${
                  tab.active
                    ? "text-sky-400 font-bold bg-white/[0.08] shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 transition-transform ${tab.active ? "scale-110" : ""}`} />
                <span className="text-[11px] tracking-tight">{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
