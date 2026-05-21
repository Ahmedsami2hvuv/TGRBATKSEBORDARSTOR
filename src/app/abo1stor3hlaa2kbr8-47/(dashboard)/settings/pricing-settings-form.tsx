"use client";

import { useState, useEffect } from "react";
import { DeliveryLoading } from "@/components/delivery-loading";

type PricingConfig = {
  meat_keywords: string[];
  fish_keywords: string[];
  meat_prices: Record<string, { buy: number; sell: number }>;
};

export function PricingSettingsForm() {
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

  useEffect(() => {
    fetch(`/api${SECRET_ADMIN_PATH}/settings/pricing`)
      .then((res) => res.json())
      .then((data) => {
        // إذا كانت الإعدادات فارغة، نضع القيم الافتراضية من الكود
        const defaultConfig: PricingConfig = {
          meat_keywords: ["شرح", "مثروم", "عظم", "عضم", "باجه", "شحم", "عصفورة", "عصفوره", "فكاره", "فكارة", "ضلوع", "ريش", "عروق"],
          fish_keywords: [
            "سمك", "ابياح", "بنت السلطان", "بني", "بياح", "جش", "حيسون", "حمار", "حمر", "حمرة", "حمره",
            "خشرة", "خشره", "دوكان", "روبيان", "ربيان", "سمتي", "سمكة", "سلمون", "سلمونة", "سلمونه",
            "سلمنتين", "شانگ", "شانك", "شعري", "شلك", "صافي", "ضلعة", "ضلعه", "ظلعة", "ظلعه", "عندك",
            "عندگ", "عروسة", "عروسه", "غريبة", "غريبه", "كطان", "مزلك", "مزلگ", "ملزك", "نگرور",
            "نكرور", "وحر", "هامور", "سمك حامض", "سمك مشوي", "فاسكر", "ضلع"
          ],
          meat_prices: {
            "شرح": { buy: 14.0, sell: 18.0 },
            "مثروم": { buy: 14.0, sell: 18.0 },
            "عظم": { buy: 13.0, sell: 16.0 },
            "فكارة": { buy: 13.0, sell: 16.0 },
            "عصفورة": { buy: 13.0, sell: 16.0 },
          }
        };
        setConfig({
            meat_keywords: data.meat_keywords || defaultConfig.meat_keywords,
            fish_keywords: data.fish_keywords || defaultConfig.fish_keywords,
            meat_prices: data.meat_prices || defaultConfig.meat_prices,
        });
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api${SECRET_ADMIN_PATH}/settings/pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      alert("تم الحفظ بنجاح! ملاحظة: التغييرات ستطبق على الطلبات الجديدة.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DeliveryLoading message="جاري تحميل إعدادات التسعير..." />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="space-y-4 rounded-2xl border border-red-100 bg-red-50/30 p-4">
        <h3 className="flex items-center gap-2 font-black text-red-800">🥩 قسم اللحوم</h3>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500">الكلمات المفتاحية للحوم (يفصل بينها بفاصلة)</label>
          <textarea
            className="w-full rounded-xl border border-red-200 p-3 text-sm font-bold outline-none focus:border-red-500"
            rows={3}
            value={config.meat_keywords.join(", ")}
            onChange={(e) => setConfig({ ...config, meat_keywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500">أسعار اللحوم الثابتة (شراء - بيع) - بالآلاف</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(config.meat_prices).map(([key, price]) => (
              <div key={key} className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm border border-red-100">
                <span className="min-w-[60px] text-xs font-black">{key}</span>
                <input
                  type="number"
                  placeholder="شراء"
                  className="w-20 rounded-md border border-slate-200 p-1 text-center text-xs font-bold"
                  value={price.buy}
                  onChange={(e) => setConfig({
                    ...config,
                    meat_prices: { ...config.meat_prices, [key]: { ...price, buy: parseFloat(e.target.value) || 0 } }
                  })}
                />
                <input
                  type="number"
                  placeholder="بيع"
                  className="w-20 rounded-md border border-slate-200 p-1 text-center text-xs font-bold text-emerald-600"
                  value={price.sell}
                  onChange={(e) => setConfig({
                    ...config,
                    meat_prices: { ...config.meat_prices, [key]: { ...price, sell: parseFloat(e.target.value) || 0 } }
                  })}
                />
                <button
                   onClick={() => {
                     const next = { ...config.meat_prices };
                     delete next[key];
                     setConfig({ ...config, meat_prices: next });
                   }}
                   className="text-red-400 hover:text-red-600 px-1"
                >✕</button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
                const name = prompt("أدخل اسم القطعية (مثلاً: ريش)");
                if (name) setConfig({ ...config, meat_prices: { ...config.meat_prices, [name]: { buy: 0, sell: 0 } } });
            }}
            className="mt-2 text-[10px] font-black text-red-600 hover:underline"
          >+ إضافة قطعية جديدة</button>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/30 p-4">
        <h3 className="flex items-center gap-2 font-black text-sky-800">🐟 قسم السمك</h3>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500">أنواع السمك المعتمدة (يفصل بينها بفاصلة)</label>
          <textarea
            className="w-full rounded-xl border border-sky-200 p-3 text-sm font-bold outline-none focus:border-sky-500"
            rows={4}
            value={config.fish_keywords.join(", ")}
            onChange={(e) => setConfig({ ...config, fish_keywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-2xl bg-slate-900 py-4 font-black text-white shadow-xl transition hover:bg-slate-800 disabled:opacity-50"
      >
        {saving ? "جاري الحفظ..." : "حفظ كافة الإعدادات ✅"}
      </button>
    </div>
  );
}
