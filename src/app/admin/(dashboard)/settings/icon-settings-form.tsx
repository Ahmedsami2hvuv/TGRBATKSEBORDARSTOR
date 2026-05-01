"use client";

import { useState, useEffect } from "react";
import { GlobalIconsConfig, IconConfig } from "@/lib/icon-settings";
import { saveGlobalIconsAction } from "./actions";

const ICON_KEYS = [
  { id: "loading_main", label: "واجهة التحميل الرئيسية (Loading Animation)" },
  { id: "order_received", label: "أيقونة استلام الطلب" },
  { id: "order_delivered", label: "أيقونة توصيل الطلب" },
  { id: "ui_whatsapp", label: "أيقونة واتساب" },
  { id: "ui_call", label: "أيقونة الاتصال" },
  { id: "ui_location", label: "أيقونة الموقع/الخريطة" },
  { id: "ui_search", label: "أيقونة البحث" },
  { id: "ui_user", label: "أيقونة المستخدم/العميل" },
  { id: "ui_courier", label: "أيقونة المندوب" },
  { id: "ui_preparer", label: "أيقونة المجهز" },
  { id: "ui_shop", label: "أيقونة المحل" },
  { id: "ui_package", label: "أيقونة الطرد/المنتج" },
  { id: "ui_note", label: "أيقونة الملاحظات 📝" },
  { id: "ui_camera", label: "أيقونة الكاميرا/صورة الباب 🚪" },
  { id: "ui_audio", label: "أيقونة البصمة الصوتية 🎤" },
  { id: "wallet_cash", label: "أيقونة الكاش/الأموال" },
  { id: "wallet_earnings", label: "أيقونة الأرباح" },
  { id: "finance_deficit", label: "تنبيه نقص الوارد 🔴" },
  { id: "finance_excess", label: "تنبيه زيادة الوارد 🟢" },
  { id: "finance_sader_deficit", label: "تنبيه نقص الصادر 📉" },
  { id: "finance_sader_excess", label: "تنبيه زيادة الصادر 📈" },
  { id: "ui_success", label: "أيقونة النجاح ✅" },
  { id: "ui_error", label: "أيقونة الخطأ ❌" },
  { id: "ui_warning", label: "أيقونة التحذير ⚠️" },
  { id: "ui_notification", label: "أيقونة الإشعارات" },
  { id: "ui_settings", label: "أيقونة الإعدادات" },
  { id: "ui_edit", label: "أيقونة التعديل" },
  { id: "ui_delete", label: "أيقونة الحذف" },
  { id: "ui_print", label: "أيقونة الطباعة" },
  { id: "ui_refresh", label: "أيقونة التحديث" },
  { id: "ui_ai", label: "أيقونة الذكاء الاصطناعي" },
  { id: "ui_external_link", label: "أيقونة الرابط الخارجي ↗" },
  { id: "ui_shops", label: "أيقونة المحلات (القائمة)" },
  { id: "ui_map", label: "أيقونة الخريطة العامة" },
  { id: "ui_arrow_right", label: "أيقونة السهم الأيسر ←" },
  { id: "wallet", label: "أيقونة المحفظة" },
  { id: "ui_gps", label: "أيقونة الموقع الحي (GPS)" },
  { id: "ui_image", label: "أيقونة الصورة/المعرض" },
  { id: "ui_eye", label: "أيقونة العين (مرئي)" },
  { id: "ui_eye_off", label: "أيقونة العين المغلقة (مخفي)" },
  { id: "ui_earnings", label: "أيقونة الأرباح/الدخل" },
  { id: "ui_plus", label: "أيقونة الإضافة ➕" },
];

export function IconSettingsForm({ initial }: { initial: GlobalIconsConfig }) {
  const [icons, setIcons] = useState<GlobalIconsConfig>(initial);
  const [loading, setLoading] = useState(false);

  const smartDetectType = (url: string): 'image' | 'lottie' | 'svg' | 'emoji' | 'gif' => {
    if (!url) return 'image';
    const lowerUrl = url.toLowerCase().trim();
    if (lowerUrl.includes('.gif')) return 'gif';
    if (lowerUrl.includes('lottiefiles.com') || lowerUrl.includes('.json') || lowerUrl.includes('lottie.host')) return 'lottie';
    if (url.startsWith('<svg')) return 'svg';
    if (url.length <= 4) return 'emoji';
    return 'image';
  };

  const updateIcon = (key: string, field: keyof IconConfig, value: any) => {
    setIcons((prev) => {
      const current = prev[key] || { url: "", type: "image" };
      const next = { ...current, [field]: value };

      if (field === 'url' && typeof value === 'string') {
        next.type = smartDetectType(value);
      }

      return { ...prev, [key]: next };
    });
  };

  const handleFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التأكد من حجم الملف (اختياري - مثلاً 2 ميجا بايت كحد أقصى للـ GIF)
    if (file.size > 2 * 1024 * 1024) {
      alert("الملف كبير جداً، يرجى اختيار ملف أقل من 2 ميجابايت لضمان سرعة التحميل.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const isGif = file.type === 'image/gif';

      setIcons((prev) => ({
        ...prev,
        [key]: {
          url: base64String,
          type: isGif ? 'gif' : 'image'
        }
      }));
    };
    reader.readAsDataURL(file);
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

              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={config.type}
                    onChange={(e) => updateIcon(item.id, "type", e.target.value)}
                    className="px-2 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                  >
                    <option value="image">صورة/رابط</option>
                    <option value="gif">GIF (أنيميشن)</option>
                    <option value="lottie">Lottie (أنيميشن)</option>
                    <option value="emoji">Emoji</option>
                  </select>
                  <input
                    value={config.url}
                    onChange={(e) => updateIcon(item.id, "url", e.target.value)}
                    placeholder="ضع الرابط هنا أو ارفع ملفاً..."
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-300 outline-none focus:border-sky-500 font-bold text-sm"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="cursor-pointer flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs font-black hover:bg-slate-50 transition-all text-center flex items-center justify-center gap-2 shadow-sm border-b-2 active:border-b-0 active:translate-y-[1px]">
                    <span className="text-lg">📁</span>
                    <span>رفع ملف من الجهاز (GIF/Image)</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleFileChange(item.id, e)}
                    />
                  </label>

                  {config.url?.startsWith('data:') && (
                    <button
                      onClick={() => updateIcon(item.id, "url", "")}
                      className="text-[10px] font-black text-rose-600 hover:text-rose-700 underline underline-offset-4"
                    >
                      حذف الملف 🗑️
                    </button>
                  )}
                </div>
              </div>

              {config.url && (
                <div className="flex items-center gap-4 p-2 bg-white rounded-xl border border-dashed border-slate-300">
                  <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
                    {(config.type === 'image' || config.type === 'gif') && <img src={config.url} className="max-w-full max-h-full object-contain" alt="Preview" />}
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
