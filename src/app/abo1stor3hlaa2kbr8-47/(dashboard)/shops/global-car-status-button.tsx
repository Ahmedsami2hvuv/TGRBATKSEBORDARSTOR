"use client";

import { updateGlobalCarStatus } from "./actions";
import { useTransition, useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export function GlobalCarStatusButton({
  noCarsMode,
  noCarsUntil,
}: {
  noCarsMode: string;
  noCarsUntil: Date | string | null;
  icons?: any;
}) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [showTimerOptions, setShowTimerOptions] = useState(false);
  const [customUntil, setCustomUntil] = useState<string>("");
  const [timeLeftStr, setTimeLeftStr] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  // إغلاق القائمة المنسدلة عند النقر في الخارج
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowTimerOptions(false);
        setSelectedMode(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // تحديث وعرض عداد الوقت المتبقي
  useEffect(() => {
    if (!noCarsUntil || noCarsMode === "off") {
      setTimeLeftStr("");
      return;
    }

    const updateTimer = () => {
      const target = new Date(noCarsUntil).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeftStr(" (انتهى وقت المؤقت)");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeLeftStr(` (ينتهي بعد: ${hours} س و ${minutes} د)`);
      } else {
        setTimeLeftStr(` (ينتهي بعد: ${minutes} د)`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000); // تحديث كل نصف دقيقة
    return () => clearInterval(interval);
  }, [noCarsUntil, noCarsMode]);

  const handleSelectModeClick = (mode: string, label: string) => {
    if (mode === "off") {
      setIsOpen(false);
      startTransition(async () => {
        const fd = new FormData();
        fd.append("noCarsMode", "off");
        fd.append("noCarsUntil", "");
        await updateGlobalCarStatus(fd);
        toast.success(`تم إلغاء التفعيل والسيارات متوفرة الآن`);
      });
    } else {
      setSelectedMode(mode);
      setShowTimerOptions(true);
    }
  };

  const handleApplyTimer = (hoursOffset: number | null) => {
    if (!selectedMode) return;
    
    let untilDateStr = "";
    if (hoursOffset !== null) {
      const d = new Date();
      d.setHours(d.getHours() + hoursOffset);
      untilDateStr = d.toISOString();
    } else if (customUntil) {
      untilDateStr = new Date(customUntil).toISOString();
    }

    setIsOpen(false);
    setShowTimerOptions(false);
    setSelectedMode(null);

    startTransition(async () => {
      const fd = new FormData();
      fd.append("noCarsMode", selectedMode);
      fd.append("noCarsUntil", untilDateStr);
      await updateGlobalCarStatus(fd);
      
      const timeLabel = untilDateStr 
        ? `بمؤقت إيقاف تلقائي` 
        : `بشكل مستمر`;
      
      toast.success(`تم تفعيل وضعية عدم وجود سيارات ${timeLabel}`);
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
        <span>{status.label}{timeLeftStr}</span>
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
        <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-2xl bg-white border border-slate-100 shadow-2xl ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150" dir="rtl">
          {showTimerOptions ? (
            <div className="p-4 space-y-3 text-right">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2 mb-1">
                <span className="text-xs font-black text-slate-800">اختر مدة تفعيل الوضعية:</span>
                <button 
                  type="button" 
                  onClick={() => { setShowTimerOptions(false); setSelectedMode(null); }} 
                  className="text-xs text-rose-500 font-bold hover:underline"
                >
                  تراجع
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyTimer(null)}
                  className="px-3 py-2.5 text-xs font-black bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition"
                >
                  مستمر (بدون مؤقت)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTimer(3)}
                  className="px-3 py-2.5 text-xs font-black bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition"
                >
                  لمدة 3 ساعات
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTimer(6)}
                  className="px-3 py-2.5 text-xs font-black bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition"
                >
                  لمدة 6 ساعات
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTimer(12)}
                  className="px-3 py-2.5 text-xs font-black bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-100 transition"
                >
                  لمدة 12 ساعة
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTimer(24)}
                  className="px-3 py-2.5 text-xs font-black bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition col-span-2"
                >
                  لمدة 24 ساعة (يوم كامل)
                </button>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <span className="text-xs font-bold text-slate-500 block">أو حدد وقت وتاريخ مخصص للإيقاف:</span>
                <input
                  type="datetime-local"
                  value={customUntil}
                  onChange={(e) => setCustomUntil(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
                <button
                  type="button"
                  disabled={!customUntil}
                  onClick={() => handleApplyTimer(null)}
                  className="w-full py-2.5 text-xs font-black bg-sky-600 hover:bg-sky-700 text-white rounded-xl disabled:opacity-50 transition"
                >
                  تأكيد وقت الإيقاف المخصص
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              <div className="px-3 py-2 text-xs font-bold text-slate-400 border-b border-slate-50 mb-1">
                إعدادات وضعية السيارات للتوصيل
              </div>
              
              <button
                onClick={() => handleSelectModeClick("off", "السيارات متوفرة")}
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
                onClick={() => handleSelectModeClick("morning", "لا يوجد سيارات صباحاً")}
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
                onClick={() => handleSelectModeClick("evening", "لا يوجد سيارات مساءً")}
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
                onClick={() => handleSelectModeClick("all_day", "لا يوجد سيارات اليوم بأكمله")}
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
          )}
        </div>
      )}
    </div>
  );
}
