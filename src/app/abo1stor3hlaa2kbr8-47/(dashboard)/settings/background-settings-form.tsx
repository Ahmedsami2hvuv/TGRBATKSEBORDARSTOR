"use client";

import { useState } from "react";
import { BackgroundsConfig, BackgroundItem } from "@/lib/background-settings";
import { saveBackgroundsConfigAction } from "./background-actions";

export function BackgroundSettingsForm({ initial }: { initial: BackgroundsConfig }) {
  const [config, setConfig] = useState<BackgroundsConfig>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingInfo, setUploadingInfo] = useState<{ id: string; field: "lightUrl" | "darkUrl" } | null>(null);
  const [previewModes, setPreviewModes] = useState<Record<string, "light" | "dark">>({});

  const saveConfig = async (newConfig: BackgroundsConfig) => {
    setIsSaving(true);
    try {
      const res = await saveBackgroundsConfigAction(newConfig);
      if (!res.success) {
        alert("فشل الحفظ: " + res.error);
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddField = () => {
    const newItem: BackgroundItem = {
      id: "bg-" + Date.now(),
      name: "خلفية جديدة مخصصة",
      lightUrl: "",
      lightType: "image",
      darkUrl: "",
      darkType: "image",
      isActive: true,
      opacity: 30,
      blur: 0,
    };

    const nextConfig = {
      ...config,
      items: [...config.items, newItem],
    };
    setConfig(nextConfig);
    saveConfig(nextConfig);
  };

  const handleUpdateItem = (id: string, field: keyof BackgroundItem, value: any) => {
    const nextItems = config.items.map((item) => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // استنتاج النوع تلقائياً عند تغيير الرابط إذا لم يكن محدداً
        if (field === "lightUrl" && typeof value === "string" && item.lightType !== "code") {
          updated.lightType = smartDetectType(value);
        }
        if (field === "darkUrl" && typeof value === "string" && item.darkType !== "code") {
          updated.darkType = smartDetectType(value);
        }
        return updated;
      }
      return item;
    });

    const nextConfig = { ...config, items: nextItems };
    setConfig(nextConfig);
    saveConfig(nextConfig);
  };

  const smartDetectType = (url: string): "image" | "video" | "lottie" => {
    if (!url) return "image";
    const lowerUrl = url.toLowerCase().trim();
    if (lowerUrl.endsWith(".mp4") || lowerUrl.endsWith(".webm") || lowerUrl.includes("video")) return "video";
    if (lowerUrl.endsWith(".json") || lowerUrl.includes("lottie") || lowerUrl.endsWith(".lottie")) return "lottie";
    return "image";
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
        throw new Error(data?.error || "فشل رفع الملف");
      }

      handleUpdateItem(id, field, data.url as string);
    } catch (error: any) {
      alert(error?.message || "فشل رفع الملف إلى كلودفلير R2");
    } finally {
      setUploadingInfo(null);
      e.target.value = "";
    }
  };

  return (
    <div className="relative space-y-6">
      {/* مؤشر الحفظ التلقائي العائم */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${isSaving ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10 pointer-events-none"}`}>
        <div className="bg-slate-900 text-white px-6 py-2 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700">
          <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-black">جاري حفظ الإعدادات تلقائياً...</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-sky-50 rounded-2xl border border-sky-100">
        <div>
          <h3 className="text-sm font-black text-sky-900">إدارة الخلفيات المتحركة والمخصصة</h3>
          <p className="text-xs text-sky-700 mt-1">
            قم بإضافة ورفع الخلفيات المتاحة للمستخدمين وتعيين الخلفية الافتراضية للموقع.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddField}
          className="px-4 py-2 bg-sky-600 text-white font-bold text-xs rounded-xl hover:bg-sky-700 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
        >
          ➕ إضافة خلفية جديدة
        </button>
      </div>

      {/* اختيار الخلفية الافتراضية */}
      <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4 justify-between">
        <label className="text-xs font-black text-slate-700">الخلفية الافتراضية للمستخدمين الجدد:</label>
        <select
          value={config.defaultBackgroundId || ""}
          onChange={(e) => {
            const nextConfig = { ...config, defaultBackgroundId: e.target.value };
            setConfig(nextConfig);
            saveConfig(nextConfig);
          }}
          className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-slate-50 outline-none focus:border-sky-500"
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
            <div key={item.id} className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-6 hover:border-sky-200 transition-colors relative overflow-hidden">
              {/* شريط تمييزي للمفعلة كافتراضية */}
              {config.defaultBackgroundId === item.id && (
                <div className="absolute top-0 end-0 bg-violet-600 text-white px-4 py-1 text-[10px] font-black rounded-bl-2xl shadow-sm">
                  الافتراضية ⭐
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex-1 min-w-[200px]">
                  <input
                    value={item.name}
                    onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                    placeholder="اسم الخلفية المميّز"
                    className="w-full text-base font-black text-slate-800 outline-none focus:border-b-2 focus:border-sky-500 bg-transparent py-1"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={item.isActive}
                      onChange={(e) => handleUpdateItem(item.id, "isActive", e.target.checked)}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                    />
                    <span className="text-xs font-bold text-slate-700">متاحة للمستخدمين</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all"
                    title="حذف هذه الخلفية"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* إعدادات الوضع المضيء */}
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                    ☀️ خلفية الوضع المضيء (النهاري)
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <label className="text-[11px] font-bold text-slate-600">النوع:</label>
                    <select
                      value={item.lightType}
                      onChange={(e) => handleUpdateItem(item.id, "lightType", e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white outline-none focus:border-sky-500"
                    >
                      <option value="image">صورة ثابتة / متحركة (WebP / GIF)</option>
                      <option value="video">فيديو حركي متكرر (MP4 / WebM)</option>
                      <option value="lottie">رسومات متحركة لوتي (JSON)</option>
                      <option value="code">كود برمجي تفاعلي (JavaScript / Canvas)</option>
                    </select>

                    {item.lightType === "code" ? (
                      <>
                        <label className="text-[11px] font-bold text-slate-600">الكود البرمجي (JavaScript):</label>
                        <textarea
                          value={item.lightUrl}
                          onChange={(e) => handleUpdateItem(item.id, "lightUrl", e.target.value)}
                          placeholder="// اكتب كود الجافا سكريبت هنا. 
// الكود سيعمل داخل حاوية الخلفية الحية.
// يمكنك استخدام Canvas بالمعرف التالي:
// const canvas = document.getElementById('custom-bg-canvas');"
                          rows={8}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white outline-none focus:border-sky-500 text-left font-normal"
                          style={{ direction: "ltr" }}
                        />
                      </>
                    ) : (
                      <>
                        <label className="text-[11px] font-bold text-slate-600">رابط الملف أو الرفع:</label>
                        <input
                          value={item.lightUrl}
                          onChange={(e) => handleUpdateItem(item.id, "lightUrl", e.target.value)}
                          placeholder="رابط مباشر للملف أو ارفع من جازك"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white outline-none focus:border-sky-500"
                        />

                        <label className="cursor-pointer bg-sky-50 text-sky-700 border border-sky-100 rounded-xl px-4 py-2.5 text-xs font-black hover:bg-sky-100 transition-all text-center flex items-center justify-center gap-2">
                          <span>{isUploadingLight ? "جاري الرفع إلى R2..." : "📤 رفع ملف الوضع المضيء"}</span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,video/*,application/json"
                            onChange={(e) => handleFileChange(item.id, "lightUrl", e)}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                {/* إعدادات الوضع المظلم */}
                <div className="space-y-4 p-4 bg-slate-900 rounded-2xl border border-slate-800 text-white">
                  <h4 className="text-xs font-black text-slate-200 flex items-center gap-2">
                    🌙 خلفية الوضع المظلم (الليلي)
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <label className="text-[11px] font-bold text-slate-400">النوع:</label>
                    <select
                      value={item.darkType}
                      onChange={(e) => handleUpdateItem(item.id, "darkType", e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-700 text-xs font-bold bg-slate-800 outline-none focus:border-sky-500 text-white"
                    >
                      <option value="image">صورة ثابتة / متحركة (WebP / GIF)</option>
                      <option value="video">فيديو حركي متكرر (MP4 / WebM)</option>
                      <option value="lottie">رسومات متحركة لوتي (JSON)</option>
                      <option value="code">كود برمجي تفاعلي (JavaScript / Canvas)</option>
                    </select>

                    {item.darkType === "code" ? (
                      <>
                        <label className="text-[11px] font-bold text-slate-400">الكود البرمجي (JavaScript):</label>
                        <textarea
                          value={item.darkUrl}
                          onChange={(e) => handleUpdateItem(item.id, "darkUrl", e.target.value)}
                          placeholder="// اكتب كود الجافا سكريبت هنا للوضع المظلم.
// الكود سيعمل داخل حاوية الخلفية الحية.
// يمكنك استخدام Canvas بالمعرف التالي:
// const canvas = document.getElementById('custom-bg-canvas');"
                          rows={8}
                          className="w-full px-3 py-2 rounded-xl border border-slate-700 text-xs font-mono bg-slate-800 outline-none focus:border-sky-500 text-white text-left font-normal"
                          style={{ direction: "ltr" }}
                        />
                      </>
                    ) : (
                      <>
                        <label className="text-[11px] font-bold text-slate-400">رابط الملف أو الرفع:</label>
                        <input
                          value={item.darkUrl}
                          onChange={(e) => handleUpdateItem(item.id, "darkUrl", e.target.value)}
                          placeholder="رابط مباشر للملف أو ارفع من جازك"
                          className="w-full px-3 py-2 rounded-xl border border-slate-700 text-xs font-bold bg-slate-800 outline-none focus:border-sky-500 text-white"
                        />

                        <label className="cursor-pointer bg-slate-800 text-sky-400 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-black hover:bg-slate-750 transition-all text-center flex items-center justify-center gap-2">
                          <span>{isUploadingDark ? "جاري الرفع إلى R2..." : "📤 رفع ملف الوضع المظلم"}</span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,video/*,application/json"
                            onChange={(e) => handleFileChange(item.id, "darkUrl", e)}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* الشفافية والضبابية */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-black text-slate-700">
                    <span>نسبة الشفافية:</span>
                    <span>{item.opacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={item.opacity}
                    onChange={(e) => handleUpdateItem(item.id, "opacity", Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-black text-slate-700">
                    <span>نسبة التشويش/الضبابية (Blur):</span>
                    <span>{item.blur}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={item.blur}
                    onChange={(e) => handleUpdateItem(item.id, "blur", Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>
              </div>

              {/* محاكي المعاينة والتشغيل الفوري */}
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">🖥️ شاشة محاكاة المعاينة:</span>
                    <div className="flex bg-slate-200/80 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-300 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setPreviewModes((prev) => ({ ...prev, [item.id]: "light" }))}
                        className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${
                          (previewModes[item.id] || "light") === "light"
                            ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-350 shadow-sm"
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                      >
                        ☀️ نهار
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewModes((prev) => ({ ...prev, [item.id]: "dark" }))}
                        className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${
                          previewModes[item.id] === "dark"
                            ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-350 shadow-sm"
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                      >
                        🌙 ليل
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem("kse_user_background", item.id);
                      window.dispatchEvent(new Event("kse_bg_changed"));
                      alert(`تم تطبيق المعاينة الحية لـ "${item.name}" على حسابك بنجاح! ستراها الآن في كامل خلفية الموقع.`);
                    }}
                    className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 dark:bg-violet-950/20 dark:hover:bg-violet-900/20 dark:text-violet-400 border border-violet-100 dark:border-violet-900 text-[10px] font-black rounded-lg transition-all"
                  >
                    👁️ تطبيق وتجربة على خلفية حسابي الآن
                  </button>
                </div>

                {/* نافذة المحاكي */}
                <div className="h-32 w-full rounded-xl bg-slate-200 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 overflow-hidden relative flex items-center justify-center">
                  {/* تدرج افتراضي في الخلف للمحاكي */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-sky-100 dark:from-slate-900 dark:to-slate-950 opacity-40 -z-20" />
                  
                  {/* الخلفية المعروضة داخل المحاكي مع تطبيق الشفافية والضبابية */}
                  {(() => {
                    const mode = previewModes[item.id] || "light";
                    const currentUrl = mode === "light" ? item.lightUrl : item.darkUrl;
                    const currentType = mode === "light" ? item.lightType : item.darkType;

                    const previewStyle = {
                      opacity: item.opacity / 100,
                      filter: item.blur > 0 ? `blur(${item.blur}px)` : "none",
                    };

                    if (currentType === "code") {
                      return (
                        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-4 bg-slate-900/10 dark:bg-black/40 text-center select-none pointer-events-none">
                          <span className="text-xl">💻</span>
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 mt-1">
                            كود برمجي تفاعلي (JavaScript / Canvas)
                          </span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[80%] leading-relaxed">
                            لتجربة ورؤية الكود يعمل في الخلفية مباشرة، اضغط على زر "تطبيق وتجربة على حسابي الآن".
                          </span>
                        </div>
                      );
                    }

                    if (!currentUrl) {
                      return <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">لا يوجد رابط للخلفية في هذا الوضع</span>;
                    }

                    return (
                      <div className="absolute inset-0 w-full h-full transition-all duration-300 pointer-events-none" style={previewStyle}>
                        {currentType === "video" ? (
                          <video
                            src={currentUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                            key={currentUrl} // لإعادة التحميل عند تغيير الرابط
                          />
                        ) : currentType === "lottie" ? (
                          <div className="w-full h-full flex items-center justify-center scale-110">
                            {/* @ts-ignore */}
                            <lottie-player
                              src={currentUrl}
                              autoplay
                              loop
                              speed="1"
                              style={{ width: "100%", height: "100%" }}
                              background="transparent"
                              key={currentUrl}
                            />
                          </div>
                        ) : (
                          <img
                            src={currentUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            key={currentUrl}
                          />
                        )}
                      </div>
                    );
                  })()}

                  {/* نص توضيحي تراكبي يمثل محتوى الموقع لمعاينة مدى وضوح النصوص فوق الخلفية */}
                  <div className="relative z-10 text-center p-3 pointer-events-none select-none">
                    <p className="text-xs font-black text-slate-900 dark:text-white drop-shadow-sm">مثال لنص الموقع (الوضوح القارئ)</p>
                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-350 mt-1 drop-shadow-sm">تأكد من اختيار شفافية وضبابية مناسبة لكي لا تختفي الكلمات.</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
