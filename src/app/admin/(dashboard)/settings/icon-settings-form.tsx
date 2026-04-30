"use client";

import { useState, useEffect } from "react";
import { GlobalIconsConfig, IconConfig } from "@/lib/icon-settings";
import { saveGlobalIconsAction } from "./actions";

const ICON_KEYS = [
  { id: "loading_main", label: "واجهة التحميل الرئيسية (Loading)" },
  { id: "order_received", label: "أيقونة استلام الطلب (Received)" },
  { id: "order_delivered", label: "أيقونة توصيل الطلب (Delivered)" },
  { id: "preparer_delegate", label: "أيقونة المجهز/التفويض" },
  { id: "admin_pricing", label: "أيقونة التسعير الإداري" },
  { id: "admin_delete", label: "أيقونة المسح الإداري" },
  { id: "store_cart", label: "أيقونة سلة المتجر" },
  { id: "store_favorites", label: "أيقونة مفضلة المتجر (ممتلئ)" },
  { id: "store_favorites_empty", label: "أيقونة مفضلة المتجر (فارغ)" },
  { id: "ui_package", label: "أيقونة الطرد/المنتج" },
  { id: "ui_edit", label: "أيقونة التعديل" },
  { id: "ui_delete", label: "أيقونة الحذف العامة" },
  { id: "ui_visibility_on", label: "أيقونة العرض (العين)" },
  { id: "ui_visibility_off", label: "أيقونة الإخفاء" },
  { id: "ui_success", label: "أيقونة النجاح ✅" },
  { id: "ui_warning", label: "أيقونة التحذير ⚠️" },
  { id: "ui_search", label: "أيقونة البحث 🔍" },
  { id: "ui_location", label: "أيقونة الموقع 📍" },
  { id: "ui_user", label: "أيقونة المستخدم 👤" },
  { id: "ui_home", label: "أيقونة الصفحة الرئيسية 🏠" },
  { id: "ui_time", label: "أيقونة الوقت 🕒" },
];

export function IconSettingsForm({ initial }: { initial: GlobalIconsConfig }) {
  const [icons, setIcons] = useState<GlobalIconsConfig>(initial);
  const [loading, setLoading] = useState(false);

  const updateIcon = (key: string, field: keyof IconConfig, value: any) => {
    setIcons((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { url: "", type: "image" }), [field]: value },
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await saveGlobalIconsAction(icons);
      if (res.ok) {
        alert("تم حفظ الإيقونات بنجاح");
      } else {
        alert("خطأ في الحفظ");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ICON_KEYS.map((item) => {
          const config = icons[item.id] || { url: "", type: "image" };
          return (
            <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="block text-sm font-black text-slate-700">{item.label}</label>

              <div className="flex gap-2">
                <select
                  value={config.type}
                  onChange={(e) => updateIcon(item.id, "type", e.target.value)}
                  className="px-2 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                >
                  <option value="image">صورة/رابط</option>
                  <option value="lottie">Lottie (أنيميشن)</option>
                  <option value="emoji">Emoji</option>
                </select>
                <input
                  value={config.url}
                  onChange={(e) => updateIcon(item.id, "url", e.target.value)}
                  placeholder="ضع الرابط هنا..."
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-300 outline-none focus:border-sky-500 font-bold text-sm"
                />
              </div>

              {config.url && (
                <div className="flex items-center gap-4 p-2 bg-white rounded-xl border border-dashed border-slate-300">
                  <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
                    {config.type === 'image' && <img src={config.url} className="max-w-full max-h-full object-contain" alt="Preview" />}
                    {config.type === 'emoji' && <span className="text-3xl">{config.url}</span>}
                    {config.type === 'lottie' && <span className="text-2xl">🎬</span>}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold leading-tight">
                    {config.type === 'lottie' ? "سيتم عرض الأنيميشن في الواجهة المخصصة" : "معاينة حية للإيقونة"}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full py-4 bg-sky-600 text-white font-black rounded-2xl shadow-lg hover:bg-sky-700 transition-all disabled:opacity-50"
      >
        {loading ? "جاري الحفظ..." : "حفظ تغييرات الإيقونات ✅"}
      </button>
    </div>
  );
}
