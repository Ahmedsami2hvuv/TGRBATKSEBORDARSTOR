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
      }
      setLoading(false);
    };

    fetchBgs();
    setActiveBgUrl(localStorage.getItem("kse_user_background_url"));
  }, []);

  const handleSelect = (url: string) => {
    localStorage.setItem("kse_user_background_url", url);
    setActiveBgUrl(url);
    window.dispatchEvent(new CustomEvent("kse_background_changed"));
  };

  const handleClear = () => {
    localStorage.removeItem("kse_user_background_url");
    setActiveBgUrl(null);
    window.dispatchEvent(new CustomEvent("kse_background_changed"));
  };

  if (loading) {
    return <div className="text-center py-4 text-xs font-bold text-slate-400 animate-pulse">جاري تحميل الخلفيات المتاحة...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-slate-700">اختر خلفية مخصصة لحسابك:</span>
        {activeBgUrl && (
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
