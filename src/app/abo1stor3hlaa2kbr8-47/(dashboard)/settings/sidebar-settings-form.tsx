"use client";

import { useState } from "react";
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

  // حقول إضافة زر جديد
  const [newLabel, setNewLabel] = useState("");
  const [newHref, setNewHref] = useState("");
  const [newIconKey, setNewIconKey] = useState("ui_link");

  // دمج الأزرار الحالية لعرضها في قائمة الترتيب
  const mergedTiles = getMergedSidebarTiles(config);

  // تحديث خيار الأعمدة
  const handleColumnsChange = (cols: 1 | 2 | 3) => {
    setConfig(prev => ({ ...prev, layoutColumns: cols }));
  };

  // تحديث شكل الأزرار
  const handleShapeChange = (shape: "square" | "rectangle") => {
    setConfig(prev => ({ ...prev, buttonShape: shape }));
  };

  // تحريك الزر للأعلى
  const moveUp = (index: number) => {
    if (index === 0) return;
    const slugs = [...config.orderedSlugs];
    // تأمين وجود السلاغات إذا لم تكن موجودة بالكامل في orderedSlugs
    const currentTiles = getMergedSidebarTiles(config);
    const orderedSlugs = currentTiles.map(t => t.slug);
    
    const temp = orderedSlugs[index];
    orderedSlugs[index] = orderedSlugs[index - 1];
    orderedSlugs[index - 1] = temp;

    setConfig(prev => ({ ...prev, orderedSlugs }));
  };

  // تحريك الزر للأسفل
  const moveDown = (index: number) => {
    const currentTiles = getMergedSidebarTiles(config);
    if (index === currentTiles.length - 1) return;
    
    const orderedSlugs = currentTiles.map(t => t.slug);
    const temp = orderedSlugs[index];
    orderedSlugs[index] = orderedSlugs[index + 1];
    orderedSlugs[index + 1] = temp;

    setConfig(prev => ({ ...prev, orderedSlugs }));
  };

  // إضافة زر مخصص جديد
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

    setConfig(prev => {
      const customTiles = [...prev.customTiles, newTile];
      const orderedSlugs = [...prev.orderedSlugs, newSlug];
      return { ...prev, customTiles, orderedSlugs };
    });

    setNewLabel("");
    setNewHref("");
    setNewIconKey("ui_link");
  };

  // حذف زر مخصص
  const removeCustomTile = (slug: string) => {
    setConfig(prev => {
      const customTiles = prev.customTiles.filter(t => t.slug !== slug);
      const orderedSlugs = prev.orderedSlugs.filter(s => s !== slug);
      return { ...prev, customTiles, orderedSlugs };
    });
  };

  // حفظ التغييرات كاملة لقاعدة البيانات
  const handleSave = async () => {
    setSaving(true);
    try {
      // إرسال الترتيب الحالي المستنبط من واجهة العرض ليكون دقيقاً
      const finalConfig: SidebarConfig = {
        ...config,
        orderedSlugs: getMergedSidebarTiles(config).map(t => t.slug)
      };

      const res = await saveSidebarConfigAction(finalConfig);
      if (res.ok) {
        alert("تم حفظ إعدادات القائمة الجانبية بنجاح وسيتم تطبيقها فوراً.");
        router.refresh();
      } else {
        alert(`فشل الحفظ: ${res.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ غير متوقع أثناء الحفظ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 bg-white dark:bg-[#09090b] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-4xl mx-auto" dir="rtl">
      
      {/* القسم الأول: تخطيط القائمة */}
      <div className="space-y-4">
        <h2 className="text-base font-black text-slate-850 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <span>📐</span> تخطيط وشكل القائمة الجانبية
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* خيار توزيع الأعمدة */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 block">عدد الأزرار في الصف الواحد:</label>
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
            <label className="text-xs font-black text-slate-500 block">شكل وتصميم الأزرار:</label>
            <div className="flex gap-2">
              {[
                { key: "rectangle", label: "مستطيل أفقي (النمط الكلاسيكي)" },
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

      {/* القسم الثاني: إعادة ترتيب الأزرار */}
      <div className="space-y-4">
        <h2 className="text-base font-black text-slate-850 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <span>🔄</span> إعادة ترتيب وتسلسل الأزرار
        </h2>
        <p className="text-[10px] text-slate-400 font-bold">
          استخدم الأسهم (⬆️ و ⬇️) بجانب كل قسم لرفع الزر للأعلى أو تنزيله للأسفل للحصول على التسلسل المناسب لك.
        </p>

        <div className="space-y-2 max-h-[400px] overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950/20">
          {mergedTiles.map((tile, index) => {
            const isCustom = tile.slug.startsWith("custom-");
            return (
              <div
                key={tile.slug}
                className="flex items-center justify-between bg-white dark:bg-[#131418] p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-sm transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <DynamicIcon iconKey={tile.iconKey} config={globalIcons} className="w-5 h-5" fallback="📁" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {tile.label}
                    </span>
                    {isCustom && (
                      <span className="block text-[8px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded mt-0.5 w-max">
                        زر مخصص: {tile.href}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* أزرار الأسهم للتحريك */}
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

                  {/* حذف إذا كان زراً مخصصاً */}
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
        <h2 className="text-base font-black text-slate-850 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <span>➕</span> إضافة زر/رابط مخصص للقائمة
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
          {/* اسم الزر */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500">اسم الزر (يظهر في القائمة):</label>
            <input
              type="text"
              placeholder="مثال: متجرنا الثاني"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl outline-none focus:border-[#00f3ff]"
            />
          </div>

          {/* رابط التوجيه */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500">رابط التوجيه (Href):</label>
            <input
              type="text"
              placeholder="مثال: /abo1stor3hlaa2kbr8-47/orders"
              value={newHref}
              onChange={(e) => setNewHref(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl outline-none focus:border-[#00f3ff] ltr text-left"
            />
          </div>

          {/* اختيار الأيقونة */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500">شكل الأيقونة:</label>
            <select
              value={newIconKey}
              onChange={(e) => setNewIconKey(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl outline-none focus:border-[#00f3ff]"
            >
              {AVAILABLE_ICONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* زر إضافة للجدول */}
          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={addCustomTile}
              className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-black font-black rounded-xl text-xs transition"
            >
              إدراج الزر المخصص في القائمة
            </button>
          </div>
        </div>
      </div>

      {/* زر الحفظ النهائي */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="w-full sm:w-auto px-12 py-3 bg-[#00f3ff] text-black font-black rounded-2xl text-sm shadow-md shadow-[#00f3ff]/20 active:scale-95 transition-all"
        >
          {saving ? "جاري حفظ التعديلات..." : "💾 حفظ كافة الإعدادات والترتيب"}
        </button>
      </div>

    </div>
  );
}
