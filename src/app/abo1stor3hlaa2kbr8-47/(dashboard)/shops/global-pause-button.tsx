"use client";

import { toggleGlobalPause } from "./actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { useTransition, useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export function GlobalPauseButton({
  isPaused,
  pauseMessage,
  allOrdersPausedUntil,
  icons,
}: {
  isPaused: boolean;
  pauseMessage: string;
  allOrdersPausedUntil: Date | string | null;
  icons: GlobalIconsConfig | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [customUntil, setCustomUntil] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>(pauseMessage || "نعتذر عن استقبال الطلبات حالياً.. نفتح قريباً");
  const [timeLeftStr, setTimeLeftStr] = useState<string>("");
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

  // التحقق من الوقت المتبقي
  const isCurrentlyPaused = isPaused && (!allOrdersPausedUntil || new Date() < new Date(allOrdersPausedUntil));

  // تحديث عداد الوقت المتبقي
  useEffect(() => {
    if (!allOrdersPausedUntil || !isPaused) {
      setTimeLeftStr("");
      return;
    }

    const updateTimer = () => {
      const target = new Date(allOrdersPausedUntil).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeftStr(" (انتهى وقت المؤقت)");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeLeftStr(` (يفتح بعد: ${hours} س و ${minutes} د)`);
      } else {
        setTimeLeftStr(` (يفتح بعد: ${minutes} د)`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000);
    return () => clearInterval(interval);
  }, [allOrdersPausedUntil, isPaused]);

  // تحديث الرسالة الافتراضية إذا تغيرت من الأب
  useEffect(() => {
    if (pauseMessage) {
      setCustomMessage(pauseMessage);
    }
  }, [pauseMessage]);

  const handleResume = () => {
    if (confirm("هل تريد استئناف تلقي الطلبات لجميع المحلات؟")) {
      startTransition(async () => {
        const fd = new FormData();
        fd.append("shouldPause", "false");
        await toggleGlobalPause(fd);
        toast.success("تم استئناف الطلبات لجميع المحلات");
        setIsOpen(false);
      });
    }
  };

  const handleApplyPause = (hoursOffset: number | null) => {
    let untilDateStr = "";
    if (hoursOffset !== null) {
      const d = new Date();
      d.setHours(d.getHours() + hoursOffset);
      untilDateStr = d.toISOString();
    } else if (customUntil) {
      untilDateStr = new Date(customUntil).toISOString();
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("shouldPause", "true");
      fd.append("pauseMessage", customMessage.trim());
      if (untilDateStr) {
        fd.append("allOrdersPausedUntil", untilDateStr);
      }
      await toggleGlobalPause(fd);
      
      const timeLabel = untilDateStr 
        ? `بمؤقت فتح تلقائي` 
        : `بشكل مستمر`;
      
      toast.success(`تم إيقاف الطلبات للكل ${timeLabel}`);
      setIsOpen(false);
    });
  };

  return (
    <div className="relative inline-block text-right" ref={containerRef}>
      {isCurrentlyPaused ? (
        <button
          onClick={handleResume}
          disabled={isPending}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all shadow-lg active:scale-95 bg-green-600 hover:bg-green-700 text-white shadow-green-200 ${
            isPending ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <DynamicIcon
            iconKey="ui_play"
            config={icons}
            fallback="▶️"
            className="w-5 h-5"
          />
          <span>استئناف الطلبات للكل{timeLeftStr}</span>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isPending}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all shadow-lg active:scale-95 bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 ${
            isPending ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <DynamicIcon
            iconKey="ui_pause"
            config={icons}
            fallback="⏸️"
            className="w-5 h-5"
          />
          <span>إيقاف الطلبات للكل</span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {isOpen && !isCurrentlyPaused && (
        <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-2xl bg-white border border-slate-100 shadow-2xl ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150" dir="rtl">
          <div className="p-4 space-y-4 text-right">
            <div className="border-b border-slate-50 pb-2">
              <span className="text-sm font-black text-slate-800">إعدادات إيقاف الطلبات العامة</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 block">رسالة التوقف للعملاء:</label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                placeholder="أدخل رسالة التوقف التي ستظهر للعملاء..."
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-500 block">اختر مدة التوقف (فتح تلقائي):</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPause(null)}
                  className="px-3 py-2.5 text-xs font-black bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition"
                >
                  مستمر (بدون مؤقت)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPause(3)}
                  className="px-3 py-2.5 text-xs font-black bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition"
                >
                  لمدة 3 ساعات
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPause(6)}
                  className="px-3 py-2.5 text-xs font-black bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition"
                >
                  لمدة 6 ساعات
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPause(12)}
                  className="px-3 py-2.5 text-xs font-black bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-100 transition"
                >
                  لمدة 12 ساعة
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPause(24)}
                  className="px-3 py-2.5 text-xs font-black bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition col-span-2"
                >
                  لمدة 24 ساعة (يوم كامل)
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2">
              <span className="text-xs font-bold text-slate-500 block">أو حدد وقت وتاريخ مخصص لإعادة الفتح:</span>
              <input
                type="datetime-local"
                value={customUntil}
                onChange={(e) => setCustomUntil(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
              />
              <button
                type="button"
                disabled={!customUntil}
                onClick={() => handleApplyPause(null)}
                className="w-full py-2.5 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl disabled:opacity-50 transition"
              >
                تأكيد وقت الإيقاف المخصص
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
