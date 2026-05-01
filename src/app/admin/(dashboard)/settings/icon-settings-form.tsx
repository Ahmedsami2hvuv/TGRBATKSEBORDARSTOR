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
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // الحفظ التلقائي عند أي تغيير
  useEffect(() => {
    if (!hasLoaded) {
      setHasLoaded(true);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSaving(true);
      try {
        await saveGlobalIconsAction(icons);
      } catch (e) {
        console.error("Auto-save failed", e);
      } finally {
        setTimeout(() => setIsSaving(false), 800);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [icons]);

  const smartDetectType = (url: string): 'image' | 'lottie' | 'svg' | 'emoji' | 'gif' => {
    if (!url) return 'image';
    const lowerUrl = url.toLowerCase().trim();
    if (lowerUrl.includes('.gif') || url.startsWith('data:image/gif')) return 'gif';
    if (lowerUrl.includes('lottiefiles.com') || lowerUrl.includes('.json') || lowerUrl.includes('lottie.host')) return 'lottie';
    if (url.startsWith('<svg')) return 'svg';
    if (url.length <= 4) return 'emoji';
    return 'image';
  };

  const updateIcon = (key: string, field: keyof IconConfig, value: any) => {
    if (field === "url" && typeof value === "string" && value.startsWith("data:image/")) {
      alert("يرجى رفع الملف إلى R2 عبر زر الرفع، وليس إدخال Base64 مباشرة.");
      return;
    }

    setIcons((prev) => {
      const current = prev[key] || { url: "", type: "image" };
      const next = { ...current, [field]: value };
      if (field === 'url' && typeof value === 'string') {
        next.type = smartDetectType(value);
      }
      return { ...prev, [key]: next };
    });
  };

  const handleFileChange = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("الملف كبير جداً (أقصى حد 3 ميجا)");
      return;
    }

    try {
      setUploadingKey(key);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("iconKey", key);

      const res = await fetch("/api/admin/settings/icons/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Upload failed");
      }

      updateIcon(key, "url", data.url as string);
      if (file.type === "image/gif") {
        updateIcon(key, "type", "gif");
      } else if (file.type.startsWith("image/")) {
        updateIcon(key, "type", "image");
      }
    } catch (error: any) {
      alert(error?.message || "فشل رفع الملف إلى R2");
    } finally {
      setUploadingKey(null);
      e.target.value = "";
    }
  };

  return (
    <div className="relative space-y-6">
      {/* مؤشر الحفظ التلقائي العائم */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${isSaving ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'}`}>
        <div className="bg-slate-900 text-white px-6 py-2 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700">
          <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-black">جاري حفظ التغييرات تلقائياً...</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
        {ICON_KEYS.map((item) => {
          const config = icons[item.id] || { url: "", type: "image" };
          return (
            <div key={item.id} className="p-4 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:border-sky-200 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-sm font-black text-slate-800">{item.label}</label>
                {config.url?.startsWith('/uploads/') && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">مخزّن في R2 ✅</span>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <select
                    value={config.type}
                    onChange={(e) => updateIcon(item.id, "type", e.target.value)}
                    className="px-2 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50 outline-none focus:border-sky-500"
                  >
                    <option value="image">صورة ثابتة</option>
                    <option value="gif">GIF (أنيميشن)</option>
                    <option value="lottie">Lottie (JSON)</option>
                    <option value="emoji">Emoji</option>
                  </select>
                  <input
                    value={config.url}
                    onChange={(e) => updateIcon(item.id, "url", e.target.value)}
                    placeholder="رابط مباشر أو /uploads/... (R2)"
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-300 outline-none focus:border-sky-500 font-bold text-xs bg-slate-50"
                  />
                </div>

                {item.id === "loading_main" && (config.type === "gif" || config.type === "image") && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-slate-600 whitespace-nowrap">طريقة العرض:</span>
                    <select
                      value={config.renderMode || "no_upscale"}
                      onChange={(e) => updateIcon(item.id, "renderMode" as keyof IconConfig, e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50 outline-none focus:border-sky-500"
                    >
                      <option value="no_upscale">بدون تكبير (أوضح)</option>
                      <option value="fill">ملء المساحة (قد يغبش)</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer bg-sky-50 text-sky-700 border border-sky-100 rounded-xl px-4 py-2 text-xs font-black hover:bg-sky-100 transition-all text-center flex items-center justify-center gap-2">
                    <span>{uploadingKey === item.id ? "جاري الرفع إلى R2..." : "📤 رفع ملف جديد إلى R2"}</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(item.id, e)} />
                  </label>

                  {config.url && (
                    <button
                      onClick={() => updateIcon(item.id, "url", "")}
                      className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all"
                      title="مسح"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {/* معاينة ذكية ومحسنة */}
              <div className="h-32 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group">
                {config.url ? (
                  <>
                    {(config.type === 'image' || config.type === 'gif') && (
                      <img src={config.url} className="max-w-full max-h-full object-contain p-2 drop-shadow-sm" alt="Preview" />
                    )}
                    {config.type === 'emoji' && <span className="text-5xl drop-shadow-md">{config.url}</span>}
                    {config.type === 'lottie' && (
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <span className="text-3xl">🎬</span>
                        <span className="text-[10px] font-bold">أنيميشن Lottie (يظهر في الواجهة)</span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-slate-300">لا توجد أيقونة مسجلة</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
