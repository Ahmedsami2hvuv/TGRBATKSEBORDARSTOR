"use client";

import React, { useState } from "react";
import { useFontSize, FontSizeConfig } from "@/components/font-size-provider";

export default function FontSizeCustomizer({ onClose }: { onClose: () => void }) {
  const { config, updateConfig, resetConfig } = useFontSize();
  const [localConfig, setLocalConfig] = useState<FontSizeConfig>(config);
  const [savedMessage, setSavedMessage] = useState(false);

  const handleChange = (key: keyof FontSizeConfig, value: number) => {
    setLocalConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    updateConfig(localConfig);
    setSavedMessage(true);
    setTimeout(() => {
      setSavedMessage(false);
    }, 2000);
  };

  const handleReset = () => {
    resetConfig();
    // الحصول على التكوين الافتراضي بعد إعادة التعيين
    setTimeout(() => {
      const defaultConfig = {
        landmarkFontSize: 14,
        locationBtnSize: 14,
        smartHintFontSize: 14,
        globalFontSize: 16,
        globalBtnSize: 14,
      };
      setLocalConfig(defaultConfig);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    }, 50);
  };

  // توليد ستايل المعاينة الحية المباشرة داخل نافذة التخصيص
  const previewStyle = {
    "--preview-landmark-size": `${localConfig.landmarkFontSize}px`,
    "--preview-location-btn-size": `${localConfig.locationBtnSize}px`,
    "--preview-smart-hint-size": `${localConfig.smartHintFontSize}px`,
    "--preview-global-size": `${localConfig.globalFontSize}px`,
    "--preview-global-btn-size": `${localConfig.globalBtnSize}px`,
  } as React.CSSProperties;

  return (
    <div className="flex flex-col gap-6" style={previewStyle}>
      <div className="space-y-4">
        {/* حجم الخط العام */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-black text-slate-800 dark:text-slate-200">حجم الخط العام في الحساب</span>
            <span className="text-xs font-mono font-bold text-sky-600 dark:text-[#00f3ff]">{localConfig.globalFontSize}px</span>
          </div>
          <input
            type="range"
            min="12"
            max="24"
            value={localConfig.globalFontSize}
            onChange={(e) => handleChange("globalFontSize", parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <div className="mt-2 p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg text-center">
            <span style={{ fontSize: `${localConfig.globalFontSize}px` }} className="font-bold text-slate-700 dark:text-slate-350 transition-all">
              معاينة: هذا هو حجم الخط العام في حسابك
            </span>
          </div>
        </div>

        {/* خط أقرب نقطة دالة */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-black text-slate-800 dark:text-slate-200">حجم خط أقرب نقطة دالة</span>
            <span className="text-xs font-mono font-bold text-sky-600 dark:text-[#00f3ff]">{localConfig.landmarkFontSize}px</span>
          </div>
          <input
            type="range"
            min="10"
            max="22"
            value={localConfig.landmarkFontSize}
            onChange={(e) => handleChange("landmarkFontSize", parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <div className="mt-2 p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg text-center">
            <span style={{ fontSize: `${localConfig.landmarkFontSize}px` }} className="font-bold text-emerald-700 dark:text-emerald-400 transition-all">
              قريب من (جامع الرحمن / الفرع الثاني)
            </span>
          </div>
        </div>

        {/* خط الاستدلال الذكي */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-black text-slate-800 dark:text-slate-200">حجم خط الاستدلال الذكي</span>
            <span className="text-xs font-mono font-bold text-sky-600 dark:text-[#00f3ff]">{localConfig.smartHintFontSize}px</span>
          </div>
          <input
            type="range"
            min="10"
            max="22"
            value={localConfig.smartHintFontSize}
            onChange={(e) => handleChange("smartHintFontSize", parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <div className="mt-2 p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg text-center">
            <span style={{ fontSize: `${localConfig.smartHintFontSize}px` }} className="font-black text-sky-700 dark:text-sky-400 transition-all">
              🧭 الاستدلال الذكي: الطلب يبعد 500 متر عن مدخل المنطقة الرئيسي
            </span>
          </div>
        </div>

        {/* حجم خط وزر فتح الموقع */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-black text-slate-800 dark:text-slate-200">حجم أزرار فتح اللوكيشن / الموقع الجغرافي</span>
            <span className="text-xs font-mono font-bold text-sky-600 dark:text-[#00f3ff]">{localConfig.locationBtnSize}px</span>
          </div>
          <input
            type="range"
            min="10"
            max="22"
            value={localConfig.locationBtnSize}
            onChange={(e) => handleChange("locationBtnSize", parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <div className="mt-2 flex justify-center">
            <button
              style={{ fontSize: `${localConfig.locationBtnSize}px` }}
              className="px-4 py-2 bg-rose-600 text-white font-black rounded-full flex items-center gap-1.5 shadow-sm transition-all pointer-events-none"
            >
              <span>📍</span>
              <span>موقع الزبون (GPS)</span>
            </button>
          </div>
        </div>

        {/* حجم الأزرار العام */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-black text-slate-800 dark:text-slate-200">حجم الأزرار العام والرموز</span>
            <span className="text-xs font-mono font-bold text-sky-600 dark:text-[#00f3ff]">{localConfig.globalBtnSize}px</span>
          </div>
          <input
            type="range"
            min="10"
            max="22"
            value={localConfig.globalBtnSize}
            onChange={(e) => handleChange("globalBtnSize", parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <div className="mt-2 flex justify-center gap-2">
            <button
              style={{ fontSize: `${localConfig.globalBtnSize}px` }}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-755 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-750 pointer-events-none"
            >
              زر تجريبي 1
            </button>
            <button
              style={{ fontSize: `${localConfig.globalBtnSize}px` }}
              className="px-3 py-1.5 bg-sky-500 text-white font-bold rounded-xl pointer-events-none"
            >
              زر تجريبي 2
            </button>
          </div>
        </div>
      </div>

      {/* أزرار الحفظ والإلغاء */}
      <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-2xl shadow-md transition-all active:scale-98 text-sm"
          >
            حفظ الإعدادات وتطبيقها
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm"
            title="إعادة ضبط للوضع الافتراضي"
          >
            إعادة تعيين
          </button>
        </div>

        {savedMessage && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-black text-emerald-800 animate-pulse">
            ✓ تم حفظ وتطبيق إعدادات الخط والأزرار بنجاح!
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 text-center text-xs text-slate-500 dark:text-slate-400 font-bold hover:underline"
        >
          إغلاق نافذة التعديل
        </button>
      </div>
    </div>
  );
}
