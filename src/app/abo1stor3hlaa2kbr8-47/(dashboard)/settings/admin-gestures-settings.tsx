"use client";

import { useEffect, useState } from "react";

export function AdminGesturesSettings() {
  const [gestures, setGestures] = useState<Record<string, string>>({});

  const getGestureKeys = () => {
    const keys: string[] = [];
    // النقرات المطولة
    [2, 3, 4, 5].forEach((fingers) => {
      keys.push(`long_press_${fingers}`);
    });
    // السحبات
    const directions = ["right", "left", "up", "down"];
    [2, 3, 4, 5].forEach((fingers) => {
      directions.forEach((dir) => {
        keys.push(`swipe_${fingers}_${dir}`);
      });
    });
    return keys;
  };

  useEffect(() => {
    const keys = getGestureKeys();
    const loadedGestures: Record<string, string> = {};
    keys.forEach((key) => {
      loadedGestures[key] = localStorage.getItem(`gesture_${key}`) || "none";
    });
    setGestures(loadedGestures);
  }, []);

  const handleGestureChange = (key: string, val: string) => {
    localStorage.setItem(`gesture_${key}`, val);
    setGestures((prev) => ({
      ...prev,
      [key]: val,
    }));

    // مزامنة فورية مع تطبيق أندرويد المدير
    if (typeof window !== "undefined" && (window as any).AndroidGestures?.saveGestureAction) {
      try {
        (window as any).AndroidGestures.saveGestureAction(key, val);
      } catch (e) {
        console.error("فشلت مزامنة الإيماءات مع أندرويد المدير", e);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).AndroidGestures?.saveGestureAction) {
      const keys = getGestureKeys();
      keys.forEach((key) => {
        const val = localStorage.getItem(`gesture_${key}`) || "none";
        try {
          (window as any).AndroidGestures.saveGestureAction(key, val);
        } catch (e) {}
      });
    }
  }, [gestures]);

  const gestureOptions: { key: string; label: string }[] = [];

  [2, 3, 4, 5].forEach((fingers) => {
    gestureOptions.push({
      key: `long_press_${fingers}`,
      label: `النقر المطول بـ ${fingers} أصابع (ثانيتين)`,
    });
  });

  const directions = [
    { id: "right", label: "لليمين ➡️" },
    { id: "left", label: "لليسار ⬅️" },
    { id: "up", label: "للأعلى ⬆️" },
    { id: "down", label: "للأسفل ⬇️" },
  ];

  [2, 3, 4, 5].forEach((fingers) => {
    directions.forEach((dir) => {
      gestureOptions.push({
        key: `swipe_${fingers}_${dir.id}`,
        label: `السحب بـ ${fingers} أصابع ${dir.label}`,
      });
    });
  });

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/40 mb-4">
        <p className="text-xs font-bold text-sky-800 dark:text-sky-300">
          🖐️ خصص حركات الأصابع المتعددة على الشاشة لتنفيذ إجراءات سريعة وفورية داخل تطبيق المدير (أندرويد).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto p-1">
        {gestureOptions.map((gesture) => (
          <div
            key={gesture.key}
            className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800"
          >
            <label className="text-xs font-black text-slate-700 dark:text-slate-200">
              {gesture.label}
            </label>
            <select
              value={gestures[gesture.key] || "none"}
              onChange={(e) => handleGestureChange(gesture.key, e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-white outline-none focus:border-sky-500 dark:focus:border-[#00f3ff] transition"
            >
              <option value="none">🚫 لا شيء (تعطيل الحركة)</option>
              <option value="open_dashboard">🏠 الذهاب للوحة الرئيسية</option>
              <option value="open_orders">📦 فتح الطلبات الجديدة</option>
              <option value="open_credit_book">💸 فتح سجل الديون والمحاسبين</option>
              <option value="open_reports">📊 فتح تقارير النظام</option>
              <option value="open_customers">👥 فتح قائمة الزبائن</option>
              <option value="open_couriers">🛵 فتح قائمة المناديب</option>
              <option value="open_preparers">🏬 فتح قائمة المجهزين</option>
              <option value="open_settings">⚙️ فتح صفحة الإعدادات</option>
              <option value="open_whatsapp">💬 فتح واتساب الإدارة</option>
              <option value="open_telegram">✈️ فتح تليجرام الإدارة</option>
              <option value="open_camera">📷 فتح الكاميرا فوراً</option>
              <option value="reload_page">🔄 تحديث الصفحة</option>
              <option value="privacy_mode">👁️ إخفاء / إظهار الأرقام المالية (وضع الخصوصية)</option>
              <option value="text_zoom_in">🔍 تكبير نصوص الصفحة (1%)</option>
              <option value="text_zoom_out">📉 تصغير نصوص الصفحة (1%)</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
