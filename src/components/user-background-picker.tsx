"use client";

import { useState, useEffect } from "react";
import { getBackgroundsAction } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/settings/background-actions";

export function UserBackgroundPicker() {
  const [backgrounds, setBackgrounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBgUrl, setActiveBgUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchBgs = async () => {
      setLoading(true);
      const res = await getBackgroundsAction();
      if (res.ok && res.backgrounds) {
        setBackgrounds(res.backgrounds);
        
        const stored = localStorage.getItem("kse_user_background_url");
        if (stored) {
          setActiveBgUrl(stored);
        } else {
          // إذا لم يحدد المستخدم خياراً، نتحقق من وجود خلفية افتراضية للنظام
          const activeSystem = res.backgrounds.find((b: any) => b.active);
          if (activeSystem) {
            setActiveBgUrl(activeSystem.imageUrl);
          }
        }
      }
      setLoading(false);
    };

    fetchBgs();
  }, []);

  const handleSelect = (url: string) => {
    localStorage.setItem("kse_user_background_url", url);
    setActiveBgUrl(url);
    window.dispatchEvent(new CustomEvent("kse_background_changed"));
  };

  const handleClear = () => {
    // تعيين القيمة 'none' لرفض استخدام أي خلفية والعودة للون الأبيض
    localStorage.setItem("kse_user_background_url", "none");
    setActiveBgUrl("none");
    window.dispatchEvent(new CustomEvent("kse_background_changed"));
  };

  if (loading) {
    return <div className="text-center py-4 text-xs font-bold text-slate-400 animate-pulse">جاري تحميل الخلفيات المتاحة...</div>;
  }

  // يظهر خيار إلغاء التفعيل والعودة للون الأبيض إذا لم تكن الخلفية بيضاء بالفعل
  const hasBackgroundActive = activeBgUrl && activeBgUrl !== "none";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-slate-700">اختر خلفية مخصصة لحسابك:</span>
        {hasBackgroundActive && (
          <button
            onClick={handleClear}
            className="text-[10px] font-black text-rose-600 hover:underline"
          >
            إلغاء التفعيل (أبيض)
          </button>
        )}
      </div>

      {backgrounds.length === 0 ? (
        <p className="text-[10px] text-center text-slate-400 py-2">لا توجد خلفيات مرفوعة من الإدارة حالياً.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {backgrounds.map((bg) => {
            const isSelected = activeBgUrl === bg.imageUrl;
            return (
              <button
                key={bg.id}
                onClick={() => handleSelect(bg.imageUrl)}
                className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all ${
                  isSelected ? "border-sky-500 shadow-sm ring-2 ring-sky-100" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <img
                  src={bg.imageUrl}
                  alt={bg.name}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 inset-x-0 bg-slate-900/60 text-white text-[8px] font-bold py-0.5 truncate px-1">
                  {bg.name}
                </span>
                {isSelected && (
                  <span className="absolute top-1 right-1 bg-sky-500 text-white text-[7px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

