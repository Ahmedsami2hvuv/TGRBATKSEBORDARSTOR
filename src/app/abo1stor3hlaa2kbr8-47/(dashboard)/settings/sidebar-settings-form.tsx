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

  // التحكم بنوافذ التعديل والإضافة المنبثقة
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

    // تصفير القيم وإغلاق النافذة
    setNewLabel("");
    setNewHref("");
    setNewIconKey("ui_link");
    setIsAddModalOpen(false);
  };

  // حذف زر مخصص تلقائياً
  const removeCustomTile = (slug: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الزر المخصص نهائياً؟")) {
      return;
    }
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

  // تفعيل التعديل على الزر وفتح النافذة المنبثقة
  const startEditTile = (tile: any) => {
    setEditingSlug(tile.slug);
    setEditingLabel(tile.label);
    setEditingHref(tile.href || "");
    setEditingIconKey(tile.iconKey || "");
    setIsEditModalOpen(true);
  };

  // إلغاء التعديل
  const cancelEdit = () => {
    setEditingSlug(null);
    setEditingLabel("");
    setEditingHref("");
    setEditingIconKey("");
    setIsEditModalOpen(false);
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
    setIsEditModalOpen(false);
    void autoSave(updated);
  };

  return (
    <div className="space-y-8 bg-slate-50 dark:bg-[#0c0d12] p-4 sm:p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 shadow-md max-w-4xl mx-auto" dir="rtl">
      
      {/* مؤشر الحفظ التلقائي في الأعلى */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-850 dark:text-slate-100 flex items-center gap-2">
            📂 تخصيص القائمة الجانبية
          </h1>
          <p className="text-xs sm:text-sm text-slate-550 dark:text-slate-400 mt-1 font-bold">
            رتب أزرار موقعك وعدل مسمياتها وأضف روابط جديدة ليظهر للعملاء والمندوبين بالشكل المناسب.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving ? (
            <span className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl text-xs font-black animate-pulse border border-amber-500/20">
              🔄 جاري حفظ التعديلات...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs font-black border border-emerald-500/20">
              ✅ تم الحفظ تلقائياً
            </span>
          )}
        </div>
      </div>

      {/* القسم الأول: تخطيط وشكل القائمة */}
      <div className="bg-white dark:bg-[#131520] p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-6">
        <h2 className="text-sm font-black text-[#00f3ff] uppercase tracking-wider flex items-center gap-2">
          📐 تخطيط وتصميم القائمة الجانبية
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* خيار توزيع الأعمدة */}
          <div className="space-y-3">
            <label className="text-xs sm:text-sm font-bold text-slate-650 dark:text-slate-350 block">عدد الأزرار في الصف الواحد:</label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((cols) => (
                <button
                  key={cols}
                  type="button"
                  onClick={() => handleColumnsChange(cols as 1 | 2 | 3)}
                  className={`py-3 px-2 rounded-xl border text-xs font-black transition-all active:scale-95 flex flex-col items-center justify-center gap-1 ${
                    config.layoutColumns === cols
                      ? "bg-[#00f3ff]/10 text-[#00f3ff] border-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.15)]"
                      : "bg-slate-50 dark:bg-[#1a1d29] text-slate-650 dark:text-slate-400 border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="text-base sm:text-lg">
                    {cols === 1 ? "📱" : cols === 2 ? "📱📱" : "📱📱📱"}
                  </span>
                  <span>
                    {cols === 1 ? "عمود واحد" : cols === 2 ? "عمودين" : "3 أعمدة"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* خيار شكل الأزرار */}
          <div className="space-y-3">
            <label className="text-xs sm:text-sm font-bold text-slate-650 dark:text-slate-350 block">تصميم وشكل الزر:</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "rectangle", label: "مستطيل (أفقي)", icon: "➖" },
                { key: "square", label: "أزرار مربعة", icon: "⏹️" }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleShapeChange(item.key as "square" | "rectangle")}
                  className={`py-3 px-3 rounded-xl border text-xs font-black transition-all active:scale-95 flex flex-col items-center justify-center gap-1 ${
                    config.buttonShape === item.key
                      ? "bg-[#00f3ff]/10 text-[#00f3ff] border-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.15)]"
                      : "bg-slate-50 dark:bg-[#1a1d29] text-slate-650 dark:text-slate-400 border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="text-base sm:text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* القسم الثاني: إعادة ترتيب وتعديل مسميات الأزرار */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
            🔄 ترتيب الأزرار وتعديل الأسماء
          </h2>
          {/* زر فتح نافذة إضافة زر مخصص */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-xl transition shadow-md flex items-center gap-1.5"
          >
            <span>➕</span>
            <span>إضافة رابط مخصص</span>
          </button>
        </div>

        {/* عرض عناصر القائمة بطريقة البطاقات الواسعة */}
        <div className="grid grid-cols-1 gap-3">
          {mergedTiles.map((tile, index) => {
            const isCustom = tile.slug.startsWith("custom-");
            return (
              <div
                key={tile.slug}
                className="flex items-center justify-between bg-white dark:bg-[#131520] p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 hover:border-slate-350 dark:hover:border-slate-700 hover:shadow-md transition duration-200 gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* أيقونة العنصر */}
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1a1d29] flex items-center justify-center shrink-0 border border-slate-200/40 dark:border-slate-800/40">
                    <DynamicIcon iconKey={tile.iconKey} config={globalIcons} className="w-5 h-5 text-slate-750 dark:text-slate-300" fallback="📁" />
                  </div>
                  
                  {/* معلومات العنصر */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-850 dark:text-slate-200 truncate">
                        {tile.label}
                      </span>
                      {isCustom && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          مخصص
                        </span>
                      )}
                    </div>
                    {isCustom && (
                      <span className="block text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 mt-1 truncate max-w-[200px] sm:max-w-[400px]">
                        رابط التوجيه: <code className="bg-slate-100 dark:bg-[#1a1d29] px-1 py-0.5 rounded text-amber-600 dark:text-amber-400 font-mono">{tile.href}</code>
                      </span>
                    )}
                  </div>
                </div>

                {/* أزرار الإجراءات والتحكم */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* زر التعديل (القلم) */}
                  <button
                    type="button"
                    onClick={() => startEditTile(tile)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#1a1d29] dark:hover:bg-slate-800 border border-slate-255/60 dark:border-slate-800 text-slate-650 dark:text-slate-300 hover:text-[#00f3ff] transition"
                    title="تعديل تفاصيل الزر"
                  >
                    ✏️
                  </button>

                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-850 mx-1"></div>

                  {/* أسهم الترتيب */}
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#1a1d29] dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-50 dark:disabled:hover:bg-[#1a1d29] text-slate-600 dark:text-slate-400 transition"
                    title="تحريك للأعلى"
                  >
                    ⬆️
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === mergedTiles.length - 1}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#1a1d29] dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-50 dark:disabled:hover:bg-[#1a1d29] text-slate-600 dark:text-slate-400 transition"
                    title="تحريك للأسفل"
                  >
                    ⬇️
                  </button>

                  {/* زر حذف للزر المخصص فقط */}
                  {isCustom && (
                    <>
                      <div className="h-6 w-px bg-slate-200 dark:bg-slate-850 mx-1"></div>
                      <button
                        type="button"
                        onClick={() => removeCustomTile(tile.slug)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-650 dark:text-red-400 transition"
                        title="حذف هذا الزر"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. نافذة تعديل الزر المنبثقة (Edit Modal) */}
      {isEditModalOpen && editingSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-all duration-300 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-[#131520] border border-slate-250 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* رأس النافذة */}
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-850 pb-4">
              <h3 className="text-lg font-black text-slate-850 dark:text-slate-100 flex items-center gap-2">
                ⚙️ تعديل بيانات الزر
              </h3>
              <button
                type="button"
                onClick={cancelEdit}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 transition"
              >
                ✕
              </button>
            </div>

            {/* محتوى الحقول */}
            <div className="space-y-4">
              {/* اسم الزر */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-650 dark:text-slate-350 block">اسم الزر الجديد:</label>
                <input
                  type="text"
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  className="w-full px-4 py-3 text-xs sm:text-sm font-bold bg-slate-50 dark:bg-[#1a1d29] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#00f3ff] transition-all"
                  autoFocus
                />
              </div>

              {/* حقول إضافية للزر المخصص فقط */}
              {editingSlug.startsWith("custom-") && (
                <>
                  {/* رابط التوجيه */}
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-bold text-slate-650 dark:text-slate-350 block">رابط التوجيه (Href):</label>
                    <input
                      type="text"
                      value={editingHref}
                      onChange={(e) => setEditingHref(e.target.value)}
                      className="w-full px-4 py-3 text-xs sm:text-sm font-bold bg-slate-50 dark:bg-[#1a1d29] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#00f3ff] transition-all ltr text-left"
                    />
                  </div>

                  {/* اختيار الأيقونة للزر المخصص */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-bold text-slate-650 dark:text-slate-350 block">تعديل الأيقونة أو الرمز التعبيري:</label>
                    
                    {/* قائمة الأيقونات المتاحة بشكل شبكة سهلة الاختيار */}
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[160px] overflow-y-auto p-2 bg-slate-50 dark:bg-[#1a1d29] rounded-xl border border-slate-200 dark:border-slate-800">
                      {AVAILABLE_ICONS.map((icon) => (
                        <button
                          key={icon.key}
                          type="button"
                          onClick={() => setEditingIconKey(icon.key)}
                          className={`p-2 rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 ${
                            editingIconKey === icon.key
                              ? "bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]"
                              : "hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <DynamicIcon iconKey={icon.key} config={globalIcons} className="w-5 h-5" fallback="📁" />
                        </button>
                      ))}
                    </div>

                    {/* حقل مخصص لكتابة رمز تعبيري يدوي */}
                    <div className="space-y-1 mt-2">
                      <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 block">أو اكتب رمزاً تعبيرياً يدوياً (مثل ⭐):</label>
                      <input
                        type="text"
                        value={editingIconKey}
                        onChange={(e) => setEditingIconKey(e.target.value)}
                        placeholder="أدخل رمز تعبيري أو مفتاح أيقونة"
                        className="w-full px-4 py-2 text-xs font-bold bg-slate-50 dark:bg-[#1a1d29] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#00f3ff] transition-all"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* أزرار التحكم */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-150 dark:border-slate-855">
              <button
                type="button"
                onClick={cancelEdit}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1d29] dark:hover:bg-slate-800 text-slate-650 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-black transition active:scale-95"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => saveTile(editingSlug)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black transition active:scale-95 shadow-md shadow-emerald-500/20"
              >
                حفظ التغييرات
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. نافذة إضافة زر مخصص جديد (Add Modal) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-all duration-300 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-[#131520] border border-slate-250 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* رأس النافذة */}
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-850 pb-4">
              <h3 className="text-lg font-black text-slate-850 dark:text-slate-100 flex items-center gap-2">
                ➕ إضافة زر مخصص جديد
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-855 dark:hover:bg-slate-800 text-slate-500 transition"
              >
                ✕
              </button>
            </div>

            {/* محتوى الحقول */}
            <div className="space-y-4">
              {/* اسم الزر */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-650 dark:text-slate-350 block">اسم الزر الجديد:</label>
                <input
                  type="text"
                  placeholder="مثال: متجرنا الثاني"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full px-4 py-3 text-xs sm:text-sm font-bold bg-slate-50 dark:bg-[#1a1d29] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#00f3ff] transition-all"
                  autoFocus
                />
              </div>

              {/* رابط التوجيه */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-slate-650 dark:text-slate-350 block">رابط التوجيه (Href):</label>
                <input
                  type="text"
                  placeholder="مثال: /orders"
                  value={newHref}
                  onChange={(e) => setNewHref(e.target.value)}
                  className="w-full px-4 py-3 text-xs sm:text-sm font-bold bg-slate-50 dark:bg-[#1a1d29] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#00f3ff] transition-all ltr text-left"
                />
              </div>

              {/* اختيار الأيقونة */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-bold text-slate-650 dark:text-slate-350 block">اختر أيقونة للزر:</label>
                
                {/* قائمة الأيقونات المتاحة بشكل شبكة سهلة الاختيار */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[160px] overflow-y-auto p-2 bg-slate-50 dark:bg-[#1a1d29] rounded-xl border border-slate-200 dark:border-slate-800">
                  {AVAILABLE_ICONS.map((icon) => (
                    <button
                      key={icon.key}
                      type="button"
                      onClick={() => setNewIconKey(icon.key)}
                      className={`p-2 rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 ${
                        newIconKey === icon.key
                          ? "bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]"
                          : "hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <DynamicIcon iconKey={icon.key} config={globalIcons} className="w-5 h-5" fallback="📁" />
                    </button>
                  ))}
                </div>

                {/* حقل مخصص لكتابة رمز تعبيري يدوي */}
                <div className="space-y-1 mt-2">
                  <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 block">أو اكتب رمزاً تعبيرياً يدوياً (مثل ⭐):</label>
                  <input
                    type="text"
                    value={newIconKey}
                    onChange={(e) => setNewIconKey(e.target.value)}
                    placeholder="أدخل رمز تعبيري أو مفتاح أيقونة"
                    className="w-full px-4 py-2 text-xs font-bold bg-slate-50 dark:bg-[#1a1d29] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#00f3ff] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* أزرار التحكم */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-150 dark:border-slate-855">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1d29] dark:hover:bg-slate-800 text-slate-650 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-black transition active:scale-95"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={addCustomTile}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black transition active:scale-95 shadow-md shadow-emerald-500/20"
              >
                إضافة الزر وحفظه
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
