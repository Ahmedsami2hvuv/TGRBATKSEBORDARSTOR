"use client";

import { useState } from "react";
import { StaticBackgroundsConfig, StaticBackgroundItem } from "@/lib/site-backgrounds";
import { saveStaticBackgroundsConfigAction } from "./site-backgrounds-actions";

export function SiteBackgroundsForm({ initial }: { initial: StaticBackgroundsConfig }) {
  const [config, setConfig] = useState<StaticBackgroundsConfig>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingInfo, setUploadingInfo] = useState<{ id: string; field: "lightUrl" | "darkUrl" } | null>(null);

  const saveConfig = async (newConfig: StaticBackgroundsConfig) => {
    setIsSaving(true);
    try {
      const res = await saveStaticBackgroundsConfigAction(newConfig);
      if (!res.success) {
        alert("فشل حفظ التحديثات: " + res.error);
      } else {
        // إخطار محرك الخلفية لإعادة التحميل في نفس الوقت
        window.dispatchEvent(new CustomEvent("kse_static_bg_updated", { detail: newConfig }));
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ غير متوقع أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddField = () => {
    const newItem: StaticBackgroundItem = {
      id: "bg-" + Date.now(),
      name: "خلفية ثابتة جديدة",
      lightUrl: "",
      darkUrl: "",
      isActive: true,
    };

    const nextConfig = {
      ...config,
      items: [newItem, ...config.items],
    };
    setConfig(nextConfig);
    saveConfig(nextConfig);
  };

  const handleUpdateItem = (id: string, field: keyof StaticBackgroundItem, value: any) => {
    const nextItems = config.items.map((item) => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });

    const nextConfig = { ...config, items: nextItems };
    setConfig(nextConfig);
    saveConfig(nextConfig);
  };

  const handleDeleteItem = (id: string) => {
    if (config.items.length <= 1) {
      alert("يجب إبقاء خلفية واحدة على الأقل في النظام.");
      return;
    }
    if (!confirm("هل أنت متأكد من حذف هذه الخلفية؟")) return;

    const nextItems = config.items.filter((item) => item.id !== id);
    let nextDefault = config.defaultBackgroundId;
    if (nextDefault === id) {
      nextDefault = nextItems[0]?.id;
    }

    const nextConfig = {
      items: nextItems,
      defaultBackgroundId: nextDefault,
    };
    setConfig(nextConfig);
    saveConfig(nextConfig);
  };

  const handleFileChange = async (id: string, field: "lightUrl" | "darkUrl", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert("حجم الملف كبير جداً (الحد الأقصى 25 ميجابايت للملف الواحد)");
      return;
    }

    try {
      setUploadingInfo({ id, field });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bgKey", `${id}_${field}`);

      const res = await fetch("/api/abo1stor3hlaa2kbr8-47/settings/backgrounds/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "فشل رفع ملف الصورة");
      }

      handleUpdateItem(id, field, data.url as string);
    } catch (error: any) {
      alert(error?.message || "فشل رفع الصورة إلى التخزين السحابي Cloudflare R2");
    } finally {
      setUploadingInfo(null);
      e.target.value = "";
    }
  };

  return (
    <div className="relative space-y-6">
      {/* مؤشر الحفظ العائم */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${isSaving ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10 pointer-events-none"}`}>
        <div className="bg-slate-900 text-white px-6 py-2 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700">
          <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-black">جاري الحفظ التلقائي...</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-sky-50 dark:bg-slate-900/50 rounded-2xl border border-sky-100 dark:border-white/10">
        <div>
          <h3 className="text-sm font-black text-sky-900 dark:text-sky-300">خلفيات الموقع الثابتة 🎆</h3>
          <p className="text-xs text-sky-700 dark:text-slate-400 mt-1">
            قم بإضافة وإدارة مجموعة الخلفيات الثابتة المتاحة لجميع مستخدمي النظام (المناديب، المجهزين، الموظفين، والمدير).
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddField}
          className="px-4 py-2 bg-sky-600 text-white font-bold text-xs rounded-xl hover:bg-sky-700 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
        >
          ➕ إضافة خلفية ثابتة
        </button>
      </div>

      {/* اختيار الخلفية الافتراضية */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-wrap items-center gap-4 justify-between">
        <label className="text-xs font-black text-slate-700 dark:text-slate-350">الخلفية الافتراضية للنظام:</label>
        <select
          value={config.defaultBackgroundId || ""}
          onChange={(e) => {
            const nextConfig = { ...config, defaultBackgroundId: e.target.value };
            setConfig(nextConfig);
            saveConfig(nextConfig);
          }}
          className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-950 outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
        >
          {config.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-6">
        {config.items.map((item) => {
          const isUploadingLight = uploadingInfo?.id === item.id && uploadingInfo?.field === "lightUrl";
          const isUploadingDark = uploadingInfo?.id === item.id && uploadingInfo?.field === "darkUrl";

          return (
            <div key={item.id} className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm space-y-6 relative overflow-hidden">
              {config.defaultBackgroundId === item.id && (
                <div className="absolute top-0 end-0 bg-violet-600 text-white px-4 py-1 text-[10px] font-black rounded-bl-2xl shadow-sm">
                  الافتراضية ⭐
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex-1 min-w-[200px]">
                  <input
                    value={item.name}
                    onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                    placeholder="اسم الخلفية"
                    className="w-full text-base font-black text-slate-800 dark:text-white outline-none focus:border-b focus:border-sky-500 bg-transparent py-1"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={item.isActive}
                      onChange={(e) => handleUpdateItem(item.id, "isActive", e.target.checked)}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">نشطة ومتاحة</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-100 transition-all"
                  >
                    🗑️ حذف
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* صورة الوضع المضيء */}
                <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
                    ☀️ صورة الوضع المضيء (النهاري)
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <input
                      value={item.lightUrl}
                      onChange={(e) => handleUpdateItem(item.id, "lightUrl", e.target.value)}
                      placeholder="رابط الصورة أو ارفع من جهازك"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-900 outline-none focus:border-sky-500 text-slate-800 dark:text-slate-100"
                    />

                    <label className="cursor-pointer bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400 border border-sky-100 dark:border-sky-900/30 rounded-xl px-4 py-2.5 text-xs font-black hover:bg-sky-100 transition-all text-center flex items-center justify-center gap-2">
                      <span>{isUploadingLight ? "جاري الرفع..." : "📤 رفع صورة للنهار"}</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleFileChange(item.id, "lightUrl", e)}
                      />
                    </label>

                    {item.lightUrl && (
                      <div className="h-28 rounded-lg overflow-hidden border border-slate-200 relative bg-slate-200">
                        <img src={item.lightUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                {/* صورة الوضع المظلم */}
                <div className="space-y-4 p-4 bg-slate-900 rounded-2xl border border-slate-800 text-white">
                  <h4 className="text-xs font-black text-slate-200">
                    🌙 صورة الوضع المظلم (الليلي)
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <input
                      value={item.darkUrl}
                      onChange={(e) => handleUpdateItem(item.id, "darkUrl", e.target.value)}
                      placeholder="رابط الصورة أو ارفع من جهازك"
                      className="w-full px-3 py-2 rounded-xl border border-slate-700 text-xs font-bold bg-slate-800 outline-none focus:border-sky-500 text-white"
                    />

                    <label className="cursor-pointer bg-slate-800 text-sky-400 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-black hover:bg-slate-750 transition-all text-center flex items-center justify-center gap-2">
                      <span>{isUploadingDark ? "جاري الرفع..." : "📤 رفع صورة لليل"}</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleFileChange(item.id, "darkUrl", e)}
                      />
                    </label>

                    {item.darkUrl && (
                      <div className="h-28 rounded-lg overflow-hidden border border-slate-800 relative bg-slate-950">
                        <img src={item.darkUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* اختيار الخلفية الشخصية */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-black text-slate-700 dark:text-slate-350">تطبيق اختياري:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem("kse_user_background", item.id);
                      window.dispatchEvent(new CustomEvent("kse_static_bg_changed", { detail: item }));
                      alert(`تم تطبيق الخلفية "${item.name}" على حسابك الشخصي الآن!`);
                    }}
                    className="px-3 py-1.5 bg-violet-600 text-white text-[10px] font-black rounded-lg transition-all hover:bg-violet-755"
                  >
                    👁️ تجربة الخلفية على حسابي الشخصي
                  </button>
                  {config.defaultBackgroundId !== item.id && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextConfig = { ...config, defaultBackgroundId: item.id };
                        setConfig(nextConfig);
                        saveConfig(nextConfig);
                        alert(`تم تعيين "${item.name}" كخلفية افتراضية للنظام.`);
                      }}
                      className="px-3 py-1.5 bg-sky-600 text-white text-[10px] font-black rounded-lg transition-all hover:bg-sky-700"
                    >
                      ⭐ تعيين كافتراضية للجميع
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
