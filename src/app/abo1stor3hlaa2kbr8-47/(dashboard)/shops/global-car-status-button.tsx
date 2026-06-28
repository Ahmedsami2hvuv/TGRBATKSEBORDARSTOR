"use client";

import { updateGlobalCarStatus } from "./actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { useTransition, useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export function GlobalCarStatusButton({
  noCarsMode,
  icons,
}: {
  noCarsMode: string;
  icons: GlobalIconsConfig | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // إغلاق القائمة المنسدلة عند النقر في الخارج
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleSelectMode = (mode: string, label: string) => {
    setIsOpen(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("noCarsMode", mode);
      await updateGlobalCarStatus(fd);
      toast.success(`تم تحديث حالة السيارات إلى: ${label}`);
    });
  };

  // الحصول على تسمية وألوان الحالة الحالية
  const getStatusDetails = () => {
    switch (noCarsMode) {
      case "morning":
        return {
          label: "لا يوجد سيارات صباحاً",
          colorClass: "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200",
          icon: "🌅",
        };
      case "evening":
        return {
          label: "لا يوجد سيارات مساءً",
          colorClass: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200",
          icon: "🌙",
        };
      case "all_day":
        return {
          label: "لا يوجد سيارات اليوم بأكمله",
          colorClass: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200",
          icon: "🚫",
        };
      default:
        return {
          label: "السيارات متوفرة (طبيعي)",
          colorClass: "bg-slate-700 hover:bg-slate-800 text-white shadow-slate-200",
          icon: "🚗",
        };
    }
  };

  const status = getStatusDetails();

  return (
    <div className="relative inline-block text-right" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all shadow-lg active:scale-95 ${
          status.colorClass
        } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span className="text-lg">{status.icon}</span>
        <span>{status.label}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl bg-white border border-slate-100 shadow-2xl ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150" dir="rtl">
          <div className="p-2 space-y-1">
            <div className="px-3 py-2 text-xs font-bold text-slate-400 border-b border-slate-50 mb-1">
              إعدادات وضعية السيارات للتوصيل
            </div>
            
            <button
              onClick={() => handleSelectMode("off", "السيارات متوفرة")}
              className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition hover:bg-slate-50 ${
                noCarsMode === "off" ? "text-slate-900 bg-slate-50" : "text-slate-600"
              }`}
            >
              <span className="text-base">🚗</span>
              <div className="text-right">
                <p>السيارات متوفرة</p>
                <p className="text-[10px] text-slate-400 font-normal">توصيل طبيعي بالسيارات والدراجات</p>
              </div>
            </button>

            <button
              onClick={() => handleSelectMode("morning", "لا يوجد سيارات صباحاً")}
              className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition hover:bg-amber-50 ${
                noCarsMode === "morning" ? "text-amber-700 bg-amber-50" : "text-slate-600"
              }`}
            >
              <span className="text-base">🌅</span>
              <div className="text-right">
                <p>لا يوجد سيارات صباحاً</p>
                <p className="text-[10px] text-slate-400 font-normal">تنبيه العميل بخصوص الفترة الصباحية</p>
              </div>
            </button>

            <button
              onClick={() => handleSelectMode("evening", "لا يوجد سيارات مساءً")}
              className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition hover:bg-indigo-50 ${
                noCarsMode === "evening" ? "text-indigo-700 bg-indigo-50" : "text-slate-600"
              }`}
            >
              <span className="text-base">🌙</span>
              <div className="text-right">
                <p>لا يوجد سيارات مساءً</p>
                <p className="text-[10px] text-slate-400 font-normal">تنبيه العميل بخصوص الفترة المسائية</p>
              </div>
            </button>

            <button
              onClick={() => handleSelectMode("all_day", "لا يوجد سيارات اليوم بأكمله")}
              className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition hover:bg-rose-50 ${
                noCarsMode === "all_day" ? "text-rose-700 bg-rose-50" : "text-slate-600"
              }`}
            >
              <span className="text-base">🚫</span>
              <div className="text-right">
                <p>لا يوجد سيارات اليوم بأكمله</p>
                <p className="text-[10px] text-slate-400 font-normal">تنبيه العميل طوال اليوم بامتناع السيارات</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
