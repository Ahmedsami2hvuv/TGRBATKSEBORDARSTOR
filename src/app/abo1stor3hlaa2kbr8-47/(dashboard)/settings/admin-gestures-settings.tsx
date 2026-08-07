"use client";

import { useEffect, useState } from "react";

export function AdminGesturesSettings() {
  const [gestures, setGestures] = useState<Record<string, string>>({});
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});

  const getGestureKeys = () => {
    const keys: string[] = [];
    // النقرات السريعة الفورية
    [2, 3, 4, 5].forEach((fingers) => {
      keys.push(`tap_${fingers}`);
    });
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
    const loadedCustomUrls: Record<string, string> = {};

    keys.forEach((key) => {
      loadedGestures[key] = localStorage.getItem(`gesture_${key}`) || "none";
      loadedCustomUrls[key] = localStorage.getItem(`gesture_custom_url_${key}`) || "";
    });

    setGestures(loadedGestures);
    setCustomUrls(loadedCustomUrls);
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

  const handleCustomUrlChange = (key: string, url: string) => {
    localStorage.setItem(`gesture_custom_url_${key}`, url);
    setCustomUrls((prev) => ({
      ...prev,
      [key]: url,
    }));

    // مزامنة الرابط المخصص مع تطبيق أندرويد المدير إن وجد
    if (typeof window !== "undefined" && (window as any).AndroidGestures?.saveCustomGestureUrl) {
      try {
        (window as any).AndroidGestures.saveCustomGestureUrl(key, url);
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).AndroidGestures?.saveGestureAction) {
      const keys = getGestureKeys();
      keys.forEach((key) => {
        const val = localStorage.getItem(`gesture_${key}`) || "none";
        const customUrl = localStorage.getItem(`gesture_custom_url_${key}`) || "";
        try {
          (window as any).AndroidGestures.saveGestureAction(key, val);
          if ((window as any).AndroidGestures?.saveCustomGestureUrl) {
            (window as any).AndroidGestures.saveCustomGestureUrl(key, customUrl);
          }
        } catch (e) {}
      });
    }
  }, [gestures, customUrls]);

  const gestureOptions: { key: string; label: string }[] = [];

  // النقرات السريعة المباشرة
  [2, 3, 4, 5].forEach((fingers) => {
    gestureOptions.push({
      key: `tap_${fingers}`,
      label: `⚡ النقر الفوري السريع بـ ${fingers} أصابع (نقرة مباشرة)`,
    });
  });

  // النقرات المطولة
  [2, 3, 4, 5].forEach((fingers) => {
    gestureOptions.push({
      key: `long_press_${fingers}`,
      label: `⏳ النقر المطول بـ ${fingers} أصابع (ثانيتين)`,
    });
  });

  // السحبات
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
        label: `👆 السحب بـ ${fingers} أصابع ${dir.label}`,
      });
    });
  });

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/40 mb-4">
        <p className="text-xs font-bold text-sky-800 dark:text-sky-300">
          🖐️ خصص حركات الأصابع المتعددة على الشاشة لتنفيذ إجراءات سريعة فورية أو فتح أي صفحة خاصة تبدأ برابط من اختيارك.
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
              <option value="custom_url">🔗 فتح رابط مخصص (ادخل اسم ورابط الصفحة بنفسك)</option>
              <option value="reload_page">🔄 تحديث الصفحة</option>
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
              <option value="privacy_mode">👁️ إخفاء / إظهار الأرقام المالية (وضع الخصوصية)</option>
              <option value="text_zoom_in">🔍 تكبير نصوص الصفحة (1%)</option>
              <option value="text_zoom_out">📉 تصغير نصوص الصفحة (1%)</option>
            </select>

            {gestures[gesture.key] === "custom_url" && (
              <div className="mt-2 space-y-1.5 bg-white dark:bg-slate-950 p-3 rounded-xl border border-sky-300/80 dark:border-sky-800 shadow-sm animate-fadeIn">
                <label className="text-[11px] font-black text-sky-700 dark:text-sky-300 flex items-center gap-1">
                  <span>🔗</span> ضع رابط الصفحة هنا (مثال: /abo1stor3hlaa2kbr8-47/shops):
                </label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="/abo1stor3hlaa2kbr8-47/shops"
                  value={customUrls[gesture.key] || ""}
                  onChange={(e) => handleCustomUrlChange(gesture.key, e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
                />
                <p className="text-[10px] text-slate-400">يمكنك كتابة مسار من داخل الموقع أو أي رابط خارجي تبدأ بـ https://</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
