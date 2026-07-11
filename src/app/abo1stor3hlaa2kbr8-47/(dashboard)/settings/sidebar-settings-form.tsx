"use client";

import { useState, useEffect } from "react";
import { SidebarConfig, CustomTile, getMergedSidebarTiles } from "@/lib/sidebar-settings";
import { saveSidebarConfigAction } from "./actions";
import { useRouter } from "next/navigation";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

const AVAILABLE_ICONS = [
  { key: "ui_home", label: "الرئيسية 🏠" },
  { key: "ui_shops", label: "المتجر/المحلات 🏪" },
  { key: "ui_add", label: "إضافة/زائد ➕" },
  { key: "ui_inbox", label: "صندوق الوارد/الجديد 📥" },
  { key: "ui_location", label: "الموقع/التتبع 📍" },
  { key: "ui_courier", label: "المندوب/التوصيل 🛵" },
  { key: "ui_preparer", label: "المجهز/التعبئة 📦" },
  { key: "ui_staff_member", label: "الموظف/المستخدم 👤" },
  { key: "ui_supplier", label: "المورد/المخازن 🍎" },
  { key: "ui_chart", label: "التقارير/الرسومات 📊" },
  { key: "ui_payment_ledger", label: "دفتر الحسابات/الديون 📘" },
  { key: "ui_users", label: "الزبائن/المستخدمين 👥" },
  { key: "ui_package", label: "أرشيف/حزمة 📦" },
  { key: "ui_error", label: "تنبيه/خطأ/مرفوض ⚠️" },
  { key: "ui_whatsapp", label: "واتساب 💬" },
  { key: "ui_map", label: "الخريطة/المناطق 🗺️" },
  { key: "ui_ai", label: "الذكاء الاصطناعي/المساعد 🤖" },
  { key: "ui_search", label: "البحث 🔍" },
  { key: "ui_announcement", label: "إعلان/إشعار 📢" },
  { key: "ui_notification", label: "التنبيهات 🔔" },
  { key: "ui_image", label: "الصور/الخلفيات 🖼️" },
  { key: "ui_settings", label: "الإعدادات ⚙️" },
  { key: "ui_link", label: "رابط خارجي 🔗" }
];

export function SidebarSettingsForm({
  initialConfig,
  globalIcons
}: {
  initialConfig: SidebarConfig;
  globalIcons: GlobalIconsConfig;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<SidebarConfig>(initialConfig);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  // تتبع حالة تعديل الزر
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingHref, setEditingHref] = useState("");
  const [editingIconKey, setEditingIconKey] = useState("");

  // حقول إضافة زر جديد
  const [newLabel, setNewLabel] = useState("");
  const [newHref, setNewHref] = useState("");
  const [newIconKey, setNewIconKey] = useState("ui_link");

  // دمج الأزرار الحالية لعرضها في قائمة الترتيب
  const mergedTiles = getMergedSidebarTiles(config);

  // دالة الحفظ التلقائي في السيرفر
  const autoSave = async (updatedConfig: SidebarConfig) => {
    setSaving(true);
    try {
      const res = await saveSidebarConfigAction(updatedConfig);
      if (res.ok) {
        router.refresh();
      } else {
        console.error("Auto save failed:", res.error);
      }
    } catch (e) {
      console.error("Auto save error:", e);
    } finally {
      setSaving(false);
    }
  };

  // تحديث خيار الأعمدة تلقائياً
  const handleColumnsChange = (cols: 1 | 2 | 3) => {
    const updated = { ...config, layoutColumns: cols };
    setConfig(updated);
    void autoSave(updated);
  };

  // تحديث شكل الأزرار تلقائياً
  const handleShapeChange = (shape: "square" | "rectangle") => {
    const updated = { ...config, buttonShape: shape };
    setConfig(updated);
    void autoSave(updated);
  };

  // تحريك الزر للأعلى تلقائياً
  const moveUp = (index: number) => {
    if (index === 0) return;
    const currentTiles = getMergedSidebarTiles(config);
    const orderedSlugs = currentTiles.map(t => t.slug);
    
    const temp = orderedSlugs[index];
    orderedSlugs[index] = orderedSlugs[index - 1];
    orderedSlugs[index - 1] = temp;

    const updated = { ...config, orderedSlugs };
    setConfig(updated);
    void autoSave(updated);
  };

  // تحريك الزر للأسفل تلقائياً
  const moveDown = (index: number) => {
    const currentTiles = getMergedSidebarTiles(config);
    if (index === currentTiles.length - 1) return;
    
    const orderedSlugs = currentTiles.map(t => t.slug);
    const temp = orderedSlugs[index];
    orderedSlugs[index] = orderedSlugs[index + 1];
    orderedSlugs[index + 1] = temp;

    const updated = { ...config, orderedSlugs };
    setConfig(updated);
    void autoSave(updated);
  };

  // إضافة زر مخصص جديد تلقائياً
  const addCustomTile = () => {
    if (!newLabel || !newHref) {
      alert("يرجى كتابة اسم الرابط ورابط التوجيه بالكامل.");
      return;
    }

    const newSlug = `custom-${Date.now()}`;
    const newTile: CustomTile = {
      slug: newSlug,
      label: newLabel,
      href: newHref,
      iconKey: newIconKey
    };

    const updated: SidebarConfig = {
      ...config,
      customTiles: [...config.customTiles, newTile],
      orderedSlugs: [...config.orderedSlugs, newSlug]
    };

    setConfig(updated);
    void autoSave(updated);

    setNewLabel("");
    setNewHref("");
    setNewIconKey("ui_link");
  };

  // حذف زر مخصص تلقائياً
  const removeCustomTile = (slug: string) => {
    const updated: SidebarConfig = {
      ...config,
      customTiles: config.customTiles.filter(t => t.slug !== slug),
      orderedSlugs: config.orderedSlugs.filter(s => s !== slug),
      customLabels: { ...config.customLabels }
    };
    if (updated.customLabels) {
      delete updated.customLabels[slug];
    }
    setConfig(updated);
    void autoSave(updated);
  };

  // تفعيل التعديل على الزر
  const startEditTile = (tile: any) => {
    setEditingSlug(tile.slug);
    setEditingLabel(tile.label);
    setEditingHref(tile.href || "");
    setEditingIconKey(tile.iconKey || "");
  };

  // إلغاء التعديل
  const cancelEdit = () => {
    setEditingSlug(null);
    setEditingLabel("");
    setEditingHref("");
    setEditingIconKey("");
  };

  // حفظ التعديلات تلقائياً
  const saveTile = (slug: string) => {
    const trimmedLabel = editingLabel.trim();
    if (!trimmedLabel) {
      alert("لا يمكن ترك اسم الزر فارغاً.");
      return;
    }

    const isCustom = slug.startsWith("custom-");
    let updated: SidebarConfig = { ...config };

    if (isCustom) {
      // تعديل زر مخصص: نقوم بتحديث خصائصه في مصفوفة customTiles
      updated.customTiles = config.customTiles.map((tile) => {
        if (tile.slug === slug) {
          return {
            ...tile,
            label: trimmedLabel,
            href: editingHref.trim(),
            iconKey: editingIconKey.trim()
          };
        }
        return tile;
      });

      // كما نقوم بتحديث الاسم في customLabels لضمان المزامنة
      updated.customLabels = {
        ...(config.customLabels || {}),
        [slug]: trimmedLabel
      };
    } else {
      // زر نظام عادي: نقوم فقط بتحديث الاسم المخصص له
      updated.customLabels = {
        ...(config.customLabels || {}),
        [slug]: trimmedLabel
      };
    }

    setConfig(updated);
    setEditingSlug(null);
    setEditingLabel("");
    setEditingHref("");
    setEditingIconKey("");
    void autoSave(updated);
  };

  return (
    <div className="space-y-8 bg-white dark:bg-[#09090b] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-4xl mx-auto" dir="rtl">
      
      {/* مؤشر الحفظ التلقائي في الأعلى */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-4">
        <div>
          <h1 className="text-lg font-black text-slate-850 dark:text-slate-100 flex items-center gap-2">
            🗂️ تخصيص القائمة الجانبية
          </h1>
          <p className="text-xs text-slate-450 dark:text-slate-400 mt-1">
            يتم حفظ جميع التغييرات والترتيب وتعديل الأسماء **تلقائياً وبشكل فوري** دون الحاجة لزر حفظ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-full text-[10px] font-black animate-pulse">
              🔄 جاري حفظ التغييرات...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black">
              ✅ تم حفظ جميع التغييرات تلقائياً
            </span>
          )}
        </div>
      </div>

      {/* القسم الأول: تخطيط القائمة */}
      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider block">
          📐 تخطيط وشكل القائمة
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* خيار توزيع الأعمدة */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-650 dark:text-slate-350 block">عدد الأزرار في الصف الواحد:</label>
            <div className="flex gap-2">
              {[1, 2, 3].map((cols) => (
                <button
                  key={cols}
                  type="button"
                  onClick={() => handleColumnsChange(cols as 1 | 2 | 3)}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                    config.layoutColumns === cols
                      ? "bg-[#00f3ff] text-black border-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.2)]"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-350 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {cols === 1 ? "زر واحد تحت الآخر" : cols === 2 ? "زرين بجنب بعض" : "3 أزرار بجنب بعض"}
                </button>
              ))}
            </div>
          </div>

          {/* خيار شكل الأزرار */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-650 dark:text-slate-350 block">شكل وتصميم الأزرار:</label>
            <div className="flex gap-2">
              {[
                { key: "rectangle", label: "مستطيل أفقي (كلاسيكي)" },
                { key: "square", label: "أزرار مربعة" }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleShapeChange(item.key as "square" | "rectangle")}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                    config.buttonShape === item.key
                      ? "bg-[#00f3ff] text-black border-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.2)]"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-350 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* القسم الثاني: إعادة ترتيب وتعديل مسميات الأزرار */}
      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider block">
          🔄 إعادة ترتيب وتعديل مسميات الأزرار
        </h2>

        <div className="space-y-2 max-h-[450px] overflow-y-auto border border-slate-150 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950/20">
          {mergedTiles.map((tile, index) => {
            const isCustom = tile.slug.startsWith("custom-");
            const isEditingThis = editingSlug === tile.slug;
            return (
              <div
                key={tile.slug}
                className="flex items-center justify-between bg-white dark:bg-[#131418] p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:shadow-sm transition gap-4"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <DynamicIcon iconKey={tile.iconKey} config={globalIcons} className="w-5 h-5" fallback="📁" />
                  </div>
                  
                  {/* عرض التعديل أو الاسم المعتاد */}
                  <div className="flex-1 min-w-0">
                    {isEditingThis ? (
                      isCustom ? (
                        <div className="flex flex-col gap-3 w-full bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 my-2">
                          {/* اسم الزر */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 block">اسم الزر:</label>
                            <input
                              type="text"
                              value={editingLabel}
                              onChange={(e) => setEditingLabel(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-950 border border-slate-350 dark:border-slate-850 rounded-lg outline-none focus:border-[#00f3ff]"
                            />
                          </div>

                          {/* رابط التوجيه */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 block">رابط التوجيه (Href):</label>
                            <input
                              type="text"
                              value={editingHref}
                              onChange={(e) => setEditingHref(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-950 border border-slate-350 dark:border-slate-850 rounded-lg outline-none focus:border-[#00f3ff] ltr text-left"
                            />
                          </div>

                          {/* رمز الأيقونة */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 block">رمز الأيقونة أو الرمز التعبيري (يمكنك لصقه مباشرة):</label>
                            <input
                              type="text"
                              value={editingIconKey}
                              onChange={(e) => setEditingIconKey(e.target.value)}
                              placeholder="مثال: ⭐ أو 🔗"
                              className="w-full px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-950 border border-slate-350 dark:border-slate-850 rounded-lg outline-none focus:border-[#00f3ff]"
                            />
                            
                            {/* أيقونات سريعة */}
                            <div className="flex flex-wrap gap-1 mt-1.5 max-h-[60px] overflow-y-auto p-1 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                              {AVAILABLE_ICONS.map((item) => {
                                const emojiMatch = item.label.match(/[\u{1F300}-\u{1F9FF}]/u) || item.label.match(/[\u{2700}-\u{27BF}]/u);
                                const quickVal = emojiMatch ? emojiMatch[0] : item.key;
                                return (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setEditingIconKey(quickVal)}
                                    className="px-1.5 py-0.5 text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 transition font-bold"
                                    title={item.label}
                                  >
                                    {item.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* أزرار الإجراءات */}
                          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                            <button
                              type="button"
                              onClick={() => saveTile(tile.slug)}
                              className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-black transition active:scale-95"
                            >
                              حفظ الزر
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-black transition active:scale-95"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 w-full max-w-md">
                          <input
                            type="text"
                            value={editingLabel}
                            onChange={(e) => setEditingLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveTile(tile.slug);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="flex-1 px-2.5 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-350 dark:border-slate-850 rounded-lg outline-none focus:border-[#00f3ff] w-full"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => saveTile(tile.slug)}
                            className="px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-black"
                            title="حفظ الاسم"
                          >
                            ✔
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-black"
                            title="إلغاء"
                          >
                            ✕
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                          {tile.label}
                        </span>
                        
                        {/* زر القلم للتعديل على الاسم */}
                        <button
                          type="button"
                          onClick={() => startEditTile(tile)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1"
                          title="تعديل اسم القسم"
                        >
                          ✏️
                        </button>
                        
                        {isCustom && (
                          <span className="text-[8px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded shrink-0">
                            مخصص
                          </span>
                        )}
                      </div>
                    )}
                    
                    {isCustom && !isEditingThis && (
                      <span className="block text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 truncate w-max max-w-full">
                        رابط: {tile.href}
                      </span>
                    )}
                  </div>
                </div>

                {/* أزرار الأسهم والتحكم الجانبي */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 transition"
                    title="تحريك للأعلى"
                  >
                    ⬆️
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === mergedTiles.length - 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 transition"
                    title="تحريك للأسفل"
                  >
                    ⬇️
                  </button>

                  {/* زر حذف للزر المخصص */}
                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => removeCustomTile(tile.slug)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 transition"
                      title="حذف هذا الزر"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* القسم الثالث: إضافة زر مخصص جديد */}
      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider block">
          ➕ إضافة زر/رابط مخصص جديد
        </h2>

        <div className="bg-slate-50/50 dark:bg-slate-900/40 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 space-y-5">
          {/* السطر الأول: الاسم والرابط بجانب بعضهما */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* اسم الزر */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-650 dark:text-slate-350 block">اسم الزر الجديد:</label>
              <input
                type="text"
                placeholder="مثال: متجرنا الثاني"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#00f3ff] focus:ring-1 focus:ring-[#00f3ff] transition-all"
              />
            </div>

            {/* رابط التوجيه */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-650 dark:text-slate-350 block">رابط التوجيه (Href):</label>
              <input
                type="text"
                placeholder="مثال: /abo1stor3hlaa2kbr8-47/orders"
                value={newHref}
                onChange={(e) => setNewHref(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#00f3ff] focus:ring-1 focus:ring-[#00f3ff] transition-all ltr text-left"
              />
            </div>
          </div>

          {/* السطر الثاني: شكل الأيقونة والمعاينة والأيقونات السريعة */}
          <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              
              {/* حقل إدخال الأيقونة مع المعاينة */}
              <div className="space-y-1.5 shrink-0 sm:w-[260px]">
                <label className="text-[11px] font-black text-slate-650 dark:text-slate-350 block">أيقونة الزر (أو الصق رمز تعبيري):</label>
                <div className="flex items-center gap-2">
                  {/* مربع المعاينة التلقائية للأيقونة النشطة */}
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-lg shadow-inner shrink-0">
                    <DynamicIcon iconKey={newIconKey} config={globalIcons} fallback="📁" className="w-5 h-5" />
                  </div>
                  {/* حقل الإدخال النصي */}
                  <input
                    type="text"
                    placeholder="الصق الرمز هنا (مثال: ⭐)"
                    value={newIconKey}
                    onChange={(e) => setNewIconKey(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#00f3ff] focus:ring-1 focus:ring-[#00f3ff] transition-all text-center"
                  />
                </div>
              </div>

              {/* الأيقونات السريعة للاختيار المباشر بجانبها */}
              <div className="flex-1 space-y-1.5 min-w-0">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-black">أيقونات النظام الشائعة (اضغط للاختيار السريع):</span>
                <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto p-1.5 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-900">
                  {AVAILABLE_ICONS.map((item) => {
                    const emojiMatch = item.label.match(/[\u{1F300}-\u{1F9FF}]/u) || item.label.match(/[\u{2700}-\u{27BF}]/u);
                    const quickVal = emojiMatch ? emojiMatch[0] : item.key;
                    const isActive = newIconKey === quickVal;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setNewIconKey(quickVal)}
                        className={`px-2.5 py-1 text-[11px] rounded-lg transition-all font-bold border active:scale-95 shrink-0 ${
                          isActive
                            ? "bg-[#00f3ff] text-black border-[#00f3ff] shadow-[0_0_8px_rgba(0,243,255,0.25)]"
                            : "bg-white hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-750 dark:text-slate-300 border-slate-200/80 dark:border-slate-800"
                        }`}
                        title={item.label}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* زر إضافة للجدول */}
          <button
            type="button"
            onClick={addCustomTile}
            className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white dark:bg-slate-50 dark:hover:bg-white dark:text-black font-black rounded-2xl text-xs transition active:scale-95 shadow-md flex items-center justify-center gap-1.5"
          >
            ➕ إدراج الزر المخصص وحفظه تلقائياً
          </button>
        </div>
      </div>

    </div>
  );
}
