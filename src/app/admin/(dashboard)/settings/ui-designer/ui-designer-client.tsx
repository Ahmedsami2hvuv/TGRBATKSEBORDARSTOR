"use client";

import { useState, useTransition, useEffect } from "react";
import { UISectionConfig, UIBlockConfig } from "@/lib/ui-settings";
import { updateUISectionAction } from "./actions";
import { useRouter } from "next/navigation";

type Props = {
  initialTarget: string;
  initialSection: string;
  initialConfig: UISectionConfig;
};

const TARGETS = [
  { id: "mandoub", label: "تطبيق المناديب" },
  { id: "preparer", label: "تطبيق المجهزين" },
  { id: "admin", label: "لوحة الإدارة" },
];

const SECTIONS_MAP: Record<string, { id: string; label: string }[]> = {
  mandoub: [
    { id: "order_details", label: "تفاصيل الطلبية (كاملة)" },
    { id: "wallet_block", label: "المحفظة (المربعات الحسابية)" },
    { id: "order_card", label: "كرت الطلبية في القائمة" },
  ],
  preparer: [
    { id: "order_details", label: "تفاصيل الطلبية (كاملة)" },
    { id: "wallet_block", label: "محفظة المجهز" },
  ],
  admin: [
    { id: "order_card", label: "كرت الطلبية في لوحة التحكم" },
    { id: "accounting", label: "البلوكات الحسابية في التقارير" },
  ]
};

const AVAILABLE_BLOCKS: Record<string, { id: string; label: string }[]> = {
  "order_details": [
    { id: "shop_info", label: "معلومات المحل" },
    { id: "customer_info", label: "معلومات الزبون" },
    { id: "price_details", label: "تفاصيل الأسعار والصور" },
    { id: "notes_summary", label: "الملاحظات والمواد" },
    { id: "money_flow", label: "حركة الأموال (التسديد)" },
  ],
  "wallet_block": [
    { id: "wallet_in_out", label: "الوارد والصادر" },
    { id: "site_and_remain", label: "الموقع والمتبقي" },
    { id: "cash_in_hand", label: "الموجود عندي (كاش)" },
    { id: "earnings_and_admin", label: "أرباحي وللإدارة" },
    { id: "tips_blocks", label: "الإكراميات" },
  ]
};

export function UIDesignerClient({ initialTarget, initialSection, initialConfig }: Props) {
  const router = useRouter();

  const [target, setTarget] = useState(initialTarget);
  const [section, setSection] = useState(initialSection);
  const [config, setConfig] = useState<UISectionConfig>(initialConfig);

  const [isPending, startTransition] = useTransition();

  const handleNavigation = (newTarget: string, newSection: string) => {
    const params = new URLSearchParams();
    params.set("target", newTarget);
    params.set("section", newSection);
    router.push(`/admin/settings/ui-designer?${params.toString()}`);
  };

  useEffect(() => {
    setTarget(initialTarget);
    setSection(initialSection);
    setConfig(initialConfig || {
      backgroundColor: "#ffffff",
      backgroundOpacity: 1,
      backgroundImageOpacity: 1,
      textColor: "#000000",
      borderRadius: "12px",
      padding: "1rem",
      layoutOrder: [],
      blockConfigs: {},
    });
  }, [initialTarget, initialSection, initialConfig]);

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateUISectionAction(target, section, config);
      if (res.ok) {
        alert("تم حفظ الستايل بنجاح!");
        router.refresh();
      } else {
        alert(res.error);
      }
    });
  };

  const updateConfig = (key: keyof UISectionConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateBlockConfig = (blockId: string, key: keyof UIBlockConfig, value: any) => {
    const blockConfigs = { ...(config.blockConfigs || {}) };
    blockConfigs[blockId] = { ...(blockConfigs[blockId] || { id: blockId }), [key]: value };
    updateConfig("blockConfigs", blockConfigs);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, status?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      updateConfig("backgroundImage", base64);
    };
    reader.readAsDataURL(file);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const layout = [...(config.layoutOrder || AVAILABLE_BLOCKS[section]?.map(b => b.id) || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= layout.length) return;
    [layout[index], layout[newIndex]] = [layout[newIndex], layout[index]];
    updateConfig("layoutOrder", layout);
  };

  const currentLayout = config.layoutOrder && config.layoutOrder.length > 0
    ? config.layoutOrder
    : (AVAILABLE_BLOCKS[section]?.map(b => b.id) || []);

  const renderRealisticBlock = (id: string) => {
    const bConf = config.blockConfigs?.[id] || {};
    if (bConf.hidden) return null;

    const blockStyle = {
      backgroundColor: bConf.backgroundColor || 'rgba(255,255,255,0.95)',
      fontSize: bConf.fontSize || '12px',
      gridColumn: bConf.fullWidth ? 'span 2' : 'span 1',
      color: '#1a1a1a',
    };

    if (section === "order_details") {
      switch (id) {
        case "shop_info":
          return (
            <div key={id} style={blockStyle} className="p-3 rounded-2xl shadow-sm border border-black/5">
              <p className="text-[9px] font-black text-emerald-700 mb-1">المحل</p>
              <p className="font-bold text-xs">بوتيك النجوم</p>
              <div className="flex gap-1 mt-2"><div className="bg-sky-600 text-white px-2 py-0.5 rounded-md text-[8px] font-bold">اتصال</div><div className="bg-emerald-600 text-white px-2 py-0.5 rounded-md text-[8px] font-bold">واتساب</div></div>
            </div>
          );
        case "customer_info":
          return (
            <div key={id} style={blockStyle} className="p-3 rounded-2xl shadow-sm border border-black/5">
              <p className="text-[9px] font-black text-blue-700 mb-1">الزبون</p>
              <p className="font-bold text-xs">محمد جاسم</p>
              <p className="text-[9px] opacity-60">بغداد - حي الجامعة</p>
              <div className="mt-2 bg-emerald-500 text-white text-[8px] p-1 rounded-md text-center font-bold">الموقع على الخريطة ↗</div>
            </div>
          );
        case "price_details":
          return (
            <div key={id} style={blockStyle} className="p-3 rounded-2xl shadow-sm border border-black/5 bg-violet-50">
              <div className="flex justify-between items-center mb-1 opacity-60"><span className="text-[8px] font-bold">تجهيز</span><span className="text-[8px] font-bold">14:30</span></div>
              <p className="text-base font-black text-center text-violet-950">35,000 د.ع</p>
            </div>
          );
        case "notes_summary":
          return (
            <div key={id} style={blockStyle} className="p-2 rounded-xl border border-black/5 bg-amber-50/50">
              <p className="text-[8px] font-black opacity-40 mb-1">ملاحظات</p>
              <p className="text-[9px] font-medium leading-tight">يرجى التأكد من استلام كامل المبلغ قبل التسليم.</p>
            </div>
          );
        case "money_flow":
          return (
            <div key={id} className="p-3 border-2 border-dashed border-slate-300 rounded-xl opacity-40 text-center text-[9px] font-bold italic">منطقة التسديدات</div>
          );
      }
    }

    if (section === "wallet_block") {
      switch (id) {
        case "wallet_in_out":
          return (
            <div key={id} className="grid grid-cols-2 gap-2" style={{ gridColumn: 'span 2' }}>
              <div style={blockStyle} className="p-3 rounded-xl border border-black/5 text-center"><p className="text-[8px] opacity-50">صادر</p><p className="font-black text-xs">120 </p></div>
              <div style={blockStyle} className="p-3 rounded-xl border border-black/5 text-center"><p className="text-[8px] opacity-50">وارد</p><p className="font-black text-xs text-emerald-600">350 </p></div>
            </div>
          );
        case "cash_in_hand":
          return (
            <div key={id} style={{ ...blockStyle, backgroundColor: '#10b981', color: 'white' }} className="p-4 rounded-2xl text-center shadow-lg"><p className="text-[9px] font-bold">الكاش الموجود</p><p className="text-xl font-black">230 </p></div>
          );
        case "site_and_remain":
          return (
            <div key={id} className="grid grid-cols-2 gap-2" style={{ gridColumn: 'span 2' }}>
              <div style={blockStyle} className="p-2 rounded-xl border border-black/5 text-center"><p className="text-[8px] opacity-50">الموقع</p><p className="font-bold text-[10px]">90 </p></div>
              <div style={blockStyle} className="p-2 rounded-xl border border-black/5 text-center"><p className="text-[8px] opacity-50">المتبقي</p><p className="font-bold text-[10px]">140 </p></div>
            </div>
          );
      }
    }

    return (
      <div key={id} style={blockStyle} className="p-4 border border-black/5 rounded-2xl text-center font-black shadow-sm min-h-[60px] flex items-center justify-center opacity-80">
        {AVAILABLE_BLOCKS[section]?.find(b => b.id === id)?.label || id}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" dir="rtl">
      {/* Sidebar Navigation */}
      <div className="lg:col-span-3 space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-4">اختيار النظام</h3>
          <div className="flex flex-col gap-2">
            {TARGETS.map(t => (
              <button key={t.id} onClick={() => handleNavigation(t.id, SECTIONS_MAP[t.id][0].id)} className={`text-right p-4 rounded-2xl font-black transition-all ${target === t.id ? 'bg-sky-600 text-white shadow-xl ring-4 ring-sky-50' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600'}`}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest mb-4">الأقسام المتاحة</h3>
          <div className="flex flex-col gap-2">
            {SECTIONS_MAP[target]?.map(s => (
              <button key={s.id} onClick={() => handleNavigation(target, s.id)} className={`text-right p-4 rounded-2xl text-sm font-bold transition-all ${section === s.id ? 'bg-indigo-600 text-white shadow-xl ring-4 ring-indigo-50' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600'}`}>{s.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="lg:col-span-5 space-y-6 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-y-auto max-h-[85vh]">
        <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
          <div><h2 className="text-xl font-black text-slate-900 dark:text-white">{SECTIONS_MAP[target]?.find(s=>s.id===section)?.label}</h2><p className="text-[10px] font-bold text-slate-400 mt-1">تخصيص الواجهة المباشر</p></div>
          <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-[10px] font-black">{target}</span>
        </div>

        <div className="space-y-4 p-5 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/20 dark:to-slate-900 rounded-[2rem] border border-sky-100 dark:border-sky-900">
          <h3 className="font-black text-sm text-sky-800 dark:text-sky-400 flex items-center gap-2">🏞️ صورة الخلفية</h3>
          {config.backgroundImage && (
            <div className="relative aspect-video rounded-2xl overflow-hidden border-4 border-white shadow-md bg-slate-200">
              <img src={config.backgroundImage} className="w-full h-full object-cover" />
              <button onClick={() => updateConfig("backgroundImage", "")} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full text-xs shadow-lg font-black">حذف ✕</button>
            </div>
          )}
          <label className="flex flex-col items-center justify-center w-full h-24 border-4 border-dashed border-sky-200 rounded-[2rem] cursor-pointer hover:border-sky-400 transition-all">
            <span className="text-2xl mb-1">📸</span>
            <p className="text-[10px] font-black text-sky-700">ارفع صورة من جهازك</p>
            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e)} />
          </label>
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-500 uppercase">قوة ظهور الصورة</label>
              <span className="text-xs font-black text-sky-600">{Math.round((config.backgroundImageOpacity ?? 1) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.backgroundImageOpacity ?? 1}
              onChange={e => updateConfig("backgroundImageOpacity", parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
            />
          </div>
        </div>

        {AVAILABLE_BLOCKS[section] && (
          <div className="space-y-4">
            <h3 className="font-black text-sm text-amber-600 flex items-center gap-2">🏗️ ترتيب وتخصيص البلوكات</h3>
            <div className="space-y-3">
              {currentLayout.map((blockId, index) => {
                const blockInfo = AVAILABLE_BLOCKS[section].find(b => b.id === blockId);
                const blockConf = config.blockConfigs?.[blockId] || {};
                return (
                  <div key={blockId} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 space-y-4 transition-all hover:border-amber-400 group">
                    <div className="flex items-center justify-between border-b pb-3 dark:border-slate-700">
                      <span className="font-black text-sm text-slate-700 dark:text-slate-200">⣿ {blockInfo?.label || blockId}</span>
                      <div className="flex gap-2">
                        <button onClick={() => moveBlock(index, 'up')} className="size-8 flex items-center justify-center bg-white dark:bg-slate-700 border dark:border-slate-600 hover:bg-amber-50 rounded-xl shadow-sm text-xs font-black">▲</button>
                        <button onClick={() => moveBlock(index, 'down')} className="size-8 flex items-center justify-center bg-white dark:bg-slate-700 border dark:border-slate-600 hover:bg-amber-50 rounded-xl shadow-sm text-xs font-black">▼</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!blockConf.fullWidth} onChange={e => updateBlockConfig(blockId, "fullWidth", e.target.checked)} className="size-5 rounded-lg accent-sky-600" /><span className="text-[11px] font-black">عرض كامل</span></label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!blockConf.hidden} onChange={e => updateBlockConfig(blockId, "hidden", e.target.checked)} className="size-5 rounded-lg accent-rose-600" /><span className="text-[11px] font-black">إخفاء</span></label>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">الخلفية</label><input type="color" value={blockConf.backgroundColor || "#ffffff"} onChange={e => updateBlockConfig(blockId, "backgroundColor", e.target.value)} className="w-full h-9 rounded-xl cursor-pointer border-none" /></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">الخط</label><input type="text" placeholder="14px" value={blockConf.fontSize || ""} onChange={e => updateBlockConfig(blockId, "fontSize", e.target.value)} className="w-full h-9 text-[11px] font-black p-1 rounded-xl border dark:bg-slate-700 dark:border-slate-600 text-center" /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-4 pt-6 border-t dark:border-slate-800">
          <h3 className="font-black text-sm text-sky-600 flex items-center gap-2">🎨 الألوان الكلية</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">خلفية القسم</label><input type="color" value={config.backgroundColor || "#ffffff"} onChange={e => updateConfig("backgroundColor", e.target.value)} className="w-full h-12 rounded-2xl cursor-pointer border-none" /></div>
            <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">لون النص</label><input type="color" value={config.textColor || "#000000"} onChange={e => updateConfig("textColor", e.target.value)} className="w-full h-12 rounded-2xl cursor-pointer border-none" /></div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-500 uppercase">الشفافية</label><span className="text-xs font-black text-sky-600">{Math.round((config.backgroundOpacity || 1) * 100)}%</span></div>
            <input type="range" min="0" max="1" step="0.05" value={config.backgroundOpacity || 1} onChange={e => updateConfig("backgroundOpacity", parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600" />
          </div>
        </div>

        <button onClick={handleSave} disabled={isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-[2.5rem] shadow-2xl transition-all active:scale-[0.95] disabled:opacity-50 sticky bottom-0 z-10 border-t-4 border-emerald-800">
          {isPending ? "⏳ جاري الحفظ..." : "حفظ التصميم وتطبيقه الآن ✅"}
        </button>
      </div>

      {/* Realistic Mobile Preview Section */}
      <div className="lg:col-span-4 sticky top-4 self-start space-y-4">
        <h3 className="font-black text-sm text-center text-slate-400 flex items-center justify-center gap-2">📱 معاينة الهاتف الحية</h3>
        <div className="relative mx-auto w-full max-w-[280px] aspect-[9/18.5] bg-[#0a0a0a] rounded-[3.5rem] border-[10px] border-slate-900 shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-900 rounded-b-2xl z-30"></div>
          <div
            style={{
              backgroundColor: config.backgroundColor,
              color: config.textColor,
              opacity: config.backgroundOpacity,
              position: 'relative'
            }}
            className="w-full h-full p-6 pt-12 overflow-y-auto flex flex-col gap-4 transition-all duration-500 scrollbar-hide"
          >
            {config.backgroundImage && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${config.backgroundImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: config.backgroundImageOpacity ?? 1,
                  zIndex: 0
                }}
              />
            )}
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex justify-between items-center opacity-40 border-b border-current pb-2 mb-2"><span className="text-[9px] font-black uppercase tracking-tighter">Live Simulation</span><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div></div>
              {currentLayout.map(id => renderRealisticBlock(id))}
              <div className="h-12 w-full"></div>
            </div>
          </div>
        </div>
        <p className="text-[9px] text-center text-slate-400 font-bold px-6 leading-relaxed">💡 هذه المعاينة تحاكي شكل التطبيق الحقيقي للمناديب والمجهزين ببيانات واقعية.</p>
      </div>
    </div>
  );
}
