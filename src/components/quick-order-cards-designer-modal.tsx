"use client";

import React, { useState, useEffect } from "react";
import {
  type OrderCardDesignerConfig,
  type CustomElementConfig,
  type CustomAddedElement,
  type ElementActionType,
  RenderCustomElementsLayer,
  getElementStyle,
  getCardContainerStyle,
} from "@/lib/order-card-customizer";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentScope?: "admin" | "mandoub";
  canSwitchScope?: boolean; // للمدير فقط
  initialConfig?: OrderCardDesignerConfig | null;
  onConfigSaved?: (savedConfig: OrderCardDesignerConfig, scope: "admin" | "mandoub") => void;
  orderSample?: any;
};

type CardTab = "shop_card" | "customer_card" | "order_info" | "money_flow";

export function QuickOrderCardsDesignerModal({
  isOpen,
  onClose,
  currentScope = "admin",
  canSwitchScope = true,
  initialConfig,
  onConfigSaved,
  orderSample,
}: Props) {
  const [scope, setScope] = useState<"admin" | "mandoub">(currentScope);
  const [activeCard, setActiveCard] = useState<CardTab>("shop_card");
  const [config, setConfig] = useState<OrderCardDesignerConfig | null>(initialConfig || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [selectedElementKey, setSelectedElementKey] = useState<string>("btnCall");

  // جلب إعدادات النطاق المحدد عند التبديل
  const fetchScopeConfig = async (targetScope: "admin" | "mandoub") => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/order-cards-designer-config?scope=${targetScope}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.error("Error loading scope config:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchScopeConfig(scope);
    }
  }, [isOpen, scope]);

  if (!isOpen) return null;

  // قائمة العناصر المتاحة للتحكم بحسب الكارت النشط
  const getCardElementsList = (): { key: string; label: string; isCustom?: boolean }[] => {
    if (!config) return [];
    if (activeCard === "shop_card") {
      const list = [
        { key: "btnCall", label: "📞 زر الاتصال" },
        { key: "btnWhatsApp", label: "💬 زر الواتساب" },
        { key: "btnLocation", label: "📍 زر الموقع" },
        { key: "btnDoorCamera", label: "📷 كاميرا باب المحل" },
        { key: "btnDoorGallery", label: "🖼️ معرض باب المحل" },
        { key: "btnDoorZoom", label: "🔍 تكبير باب المحل" },
        { key: "shopNameBadge", label: "🏷️ اسم المحل" },
        { key: "ownerNameBadge", label: "👤 اسم صاحب المحل" },
        { key: "regionBadge", label: "📍 منطقة المحل" },
        { key: "phoneBadge", label: "📱 هاتف المحل" },
      ];
      (config.shopCard?.customElements || []).forEach((el) => {
        list.push({ key: `custom_${el.id}`, label: `✨ ${el.title || (el.type === "text" ? el.textContent : "عنصر مخصص")}`, isCustom: true });
      });
      return list;
    }
    if (activeCard === "customer_card") {
      const list = [
        { key: "btnCall", label: "📞 زر الاتصال" },
        { key: "btnWhatsApp", label: "💬 زر الواتساب" },
        { key: "btnLocation", label: "📍 زر الموقع" },
        { key: "btnAltPhone", label: "📱 الهاتف البديل" },
        { key: "btnDoorCamera", label: "📷 كاميرا باب الزبون" },
        { key: "btnDoorGallery", label: "🖼️ معرض باب الزبون" },
        { key: "btnDoorZoom", label: "🔍 تكبير باب الزبون" },
        { key: "customerNameBadge", label: "👤 اسم الزبون" },
        { key: "customerRegionBadge", label: "📍 منطقة الزبون" },
        { key: "landmarkBadge", label: "🏛️ نقطة دالة / ملاحظة" },
        { key: "phoneBadge", label: "📱 هاتف الزبون" },
        { key: "deliveryPriceBadge", label: "💵 سعر التوصيل" },
      ];
      (config.customerCard?.customElements || []).forEach((el) => {
        list.push({ key: `custom_${el.id}`, label: `✨ ${el.title || (el.type === "text" ? el.textContent : "عنصر مخصص")}`, isCustom: true });
      });
      return list;
    }
    if (activeCard === "order_info") {
      const list = [
        { key: "orderNumberBadge", label: "🔢 رقم الطلب" },
        { key: "orderTotalBadge", label: "💰 المبلغ الكلي" },
        { key: "orderStatusBadge", label: "🔄 حالة الطلب" },
        { key: "courierNameBadge", label: "🛵 اسم المندوب" },
        { key: "orderNotesBadge", label: "📝 ملاحظات الطلب" },
        { key: "btnQuickImage", label: "📸 صورة الطلب السريعة" },
        { key: "btnVoiceNote", label: "🎙️ الملاحظة الصوتية" },
      ];
      (config.orderInfoCard?.customElements || []).forEach((el) => {
        list.push({ key: `custom_${el.id}`, label: `✨ ${el.title || (el.type === "text" ? el.textContent : "عنصر مخصص")}`, isCustom: true });
      });
      return list;
    }
    if (activeCard === "money_flow") {
      const list = [
        { key: "btnSaderAction", label: "📤 زر الصادر" },
        { key: "btnWardAction", label: "📥 زر الوارد" },
        { key: "totalCollectedBadge", label: "💵 إجمالي المستلم" },
        { key: "deliveryFeeBadge", label: "🛵 أجور التوصيل" },
      ];
      (config.moneyFlowCard?.customElements || []).forEach((el) => {
        list.push({ key: `custom_${el.id}`, label: `✨ ${el.title || (el.type === "text" ? el.textContent : "عنصر مخصص")}`, isCustom: true });
      });
      return list;
    }
    return [];
  };

  // استخراج النمط الحالي للعنصر المحدد
  const getSelectedElementConfig = (): CustomElementConfig => {
    if (!config) return {};
    if (selectedElementKey.startsWith("custom_")) {
      const customId = selectedElementKey.replace("custom_", "");
      const cardConfig = (config as any)[activeCard === "order_info" ? "orderInfoCard" : activeCard === "money_flow" ? "moneyFlowCard" : activeCard];
      const elem = (cardConfig?.customElements || []).find((e: CustomAddedElement) => e.id === customId);
      return elem?.style || {};
    }
    const cardConfig = (config as any)[activeCard === "order_info" ? "orderInfoCard" : activeCard === "money_flow" ? "moneyFlowCard" : activeCard];
    return cardConfig?.[selectedElementKey] || {};
  };

  // تعديل خاصية في العنصر المحدد
  const updateSelectedElementField = (field: keyof CustomElementConfig, value: any) => {
    if (!config) return;
    setConfig((prev) => {
      if (!prev) return prev;
      const targetCardKey = activeCard === "order_info" ? "orderInfoCard" : activeCard === "money_flow" ? "moneyFlowCard" : activeCard;
      const currentCard = (prev as any)[targetCardKey] || {};

      if (selectedElementKey.startsWith("custom_")) {
        const customId = selectedElementKey.replace("custom_", "");
        const currentCustoms: CustomAddedElement[] = currentCard.customElements || [];
        const updatedCustoms = currentCustoms.map((el) => {
          if (el.id === customId) {
            return {
              ...el,
              style: {
                ...(el.style || {}),
                [field]: value,
              },
            };
          }
          return el;
        });
        return {
          ...prev,
          [targetCardKey]: {
            ...currentCard,
            customElements: updatedCustoms,
          },
        };
      }

      const currentElem = currentCard[selectedElementKey] || {};
      return {
        ...prev,
        [targetCardKey]: {
          ...currentCard,
          [selectedElementKey]: {
            ...currentElem,
            [field]: value,
          },
        },
      };
    });
  };

  // تحريك العنصر بواسطة أزرار الـ D-Pad
  const handleShift = (dx: number, dy: number) => {
    const current = getSelectedElementConfig();
    const curX = current.offsetX || 0;
    const curY = current.offsetY || 0;
    updateSelectedElementField("offsetX", curX + dx);
    updateSelectedElementField("offsetY", curY + dy);
  };

  // إعادة ضبط الموضع للمركز
  const handleResetPosition = () => {
    updateSelectedElementField("offsetX", 0);
    updateSelectedElementField("offsetY", 0);
  };

  // إضافة عنصر نصي أو صورة مخصصة
  const handleAddCustomElement = (type: "text" | "image") => {
    if (!config) return;
    const newId = "c_" + Date.now().toString(36);
    const newElement: CustomAddedElement = {
      id: newId,
      type,
      title: type === "text" ? "نص جديد" : "صورة جديدة",
      textContent: type === "text" ? "اكتب هنا..." : undefined,
      actionType: "none",
      style: {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        color: "#ffffff",
        fontSize: 13,
        hasShadow: true,
        shadowBlur: 4,
      },
    };

    setConfig((prev) => {
      if (!prev) return prev;
      const targetCardKey = activeCard === "order_info" ? "orderInfoCard" : activeCard === "money_flow" ? "moneyFlowCard" : activeCard;
      const currentCard = (prev as any)[targetCardKey] || {};
      const currentCustoms = currentCard.customElements || [];
      return {
        ...prev,
        [targetCardKey]: {
          ...currentCard,
          customElements: [...currentCustoms, newElement],
        },
      };
    });

    setSelectedElementKey(`custom_${newId}`);
  };

  // حفظ التعديلات وإرسالها للتزامن الفوري
  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const res = await fetch("/api/order-cards-designer-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, scope }),
      });

      if (res.ok) {
        setSaveSuccessMsg(`تم حفظ وتزامن كروت ${scope === "admin" ? "الإدارة 🖥️" : "المندوبين 📱"} بنجاح!`);
        if (onConfigSaved) {
          onConfigSaved(config, scope);
        }
        setTimeout(() => {
          setSaveSuccessMsg(null);
        }, 4000);
      } else {
        alert("فشل الحفظ في السيرفر، يرجى المحاولة ثانية.");
      }
    } catch (e) {
      console.error("Save error:", e);
      alert("حدث خطأ أثناء الحفظ.");
    } finally {
      setIsSaving(false);
    }
  };

  // نسخ التنسيق بين الإدارة والمندوبين
  const handleCopyScope = async (fromScope: "admin" | "mandoub", toScope: "admin" | "mandoub") => {
    const fromName = fromScope === "admin" ? "كروت الإدارة 🖥️" : "كروت المندوبين 📱";
    const toName = toScope === "admin" ? "كروت الإدارة 🖥️" : "كروت المندوبين 📱";
    if (!confirm(`هل أنت متأكد من نسخ كامل تصميم وتنسيق (${fromName}) وتطبيقه على (${toName})؟`)) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/order-cards-designer-config?scope=${fromScope}`, { cache: "no-store" });
      if (res.ok) {
        const sourceConfig = await res.json();
        const saveRes = await fetch("/api/order-cards-designer-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: sourceConfig, scope: toScope }),
        });
        if (saveRes.ok) {
          alert(`تم بنجاح نسخ تنسيق ${fromName} وتطبيقه وتزامنه على ${toName}! ✅`);
          if (scope === toScope) {
            setConfig(sourceConfig);
          }
        }
      }
    } catch (e) {
      console.error("Copy scope error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedStyle = getSelectedElementConfig();
  const elementsList = getCardElementsList();
  const isSelectedCustom = selectedElementKey.startsWith("custom_");
  const selectedCustomElement = isSelectedCustom && config
    ? ((config as any)[activeCard === "order_info" ? "orderInfoCard" : activeCard === "money_flow" ? "moneyFlowCard" : activeCard]?.customElements || []).find(
        (e: CustomAddedElement) => e.id === selectedElementKey.replace("custom_", "")
      )
    : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* شريط العنوان والتبديل العلوي */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-950/90 border-b border-amber-500/20 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎨</span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-amber-300">
                استوديو ترتيب وتخصيص كروت الطلب
              </h3>
              <p className="text-xs font-bold text-slate-400">
                تعديل وتزامن فوري ومستقل
              </p>
            </div>
          </div>

          {/* تبديل نطاق التزامن (للمدير) */}
          {canSwitchScope && (
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-2xl border border-amber-500/30">
              <button
                type="button"
                onClick={() => setScope("admin")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  scope === "admin"
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-md"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <span>🖥️ كروت الإدارة</span>
              </button>
              <button
                type="button"
                onClick={() => setScope("mandoub")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  scope === "mandoub"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-black shadow-md"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <span>📱 كروت المندوبين</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center font-bold text-lg transition"
            title="إغلاق"
          >
            ✕
          </button>
        </div>

        {/* إشعار النجاح */}
        {saveSuccessMsg && (
          <div className="bg-emerald-600/90 text-white text-center py-2 px-4 text-xs sm:text-sm font-black animate-pulse flex items-center justify-center gap-2">
            <span>✅</span>
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* شريط اختيار الكارت */}
        <div className="flex items-center gap-2 p-2.5 bg-slate-900/60 border-b border-slate-800 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveCard("shop_card")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition flex items-center gap-1.5 ${
              activeCard === "shop_card"
                ? "bg-blue-600 text-white shadow-md border border-blue-400"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span>🏢 كارت المحل</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCard("customer_card")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition flex items-center gap-1.5 ${
              activeCard === "customer_card"
                ? "bg-purple-600 text-white shadow-md border border-purple-400"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span>👤 كارت الزبون</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCard("order_info")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition flex items-center gap-1.5 ${
              activeCard === "order_info"
                ? "bg-amber-600 text-white shadow-md border border-amber-400"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span>📦 كارت الطلبية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveCard("money_flow")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition flex items-center gap-1.5 ${
              activeCard === "money_flow"
                ? "bg-emerald-600 text-white shadow-md border border-emerald-400"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span>💰 حركة الأموال</span>
          </button>

          {canSwitchScope && (
            <button
              type="button"
              onClick={() => handleCopyScope(scope === "admin" ? "admin" : "mandoub", scope === "admin" ? "mandoub" : "admin")}
              className="mr-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1"
              title="نسخ التصميم للجهة الأخرى"
            >
              <span>📋 نسخ التصميم لـ {scope === "admin" ? "المندوبين" : "الإدارة"}</span>
            </button>
          )}
        </div>

        {/* محتوى الاستوديو الرئيسي */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-amber-400 font-bold">
              ⏳ جاري تحميل الإعدادات والتزامن...
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              
              {/* العمود الأيمن: قائمة العناصر وإضافة عناصر جديدة */}
              <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-black text-amber-400">قائمة العناصر والأزرار</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleAddCustomElement("text")}
                      className="px-2 py-1 bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[11px] font-black transition"
                      title="إضافة نص مخصص"
                    >
                      ➕ نص
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddCustomElement("image")}
                      className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-[11px] font-black transition"
                      title="إضافة صورة أو أيقونة مخصصة"
                    >
                      ➕ صورة
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1 max-h-[220px] sm:max-h-[300px] overflow-y-auto pr-1">
                  {elementsList.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedElementKey(item.key)}
                      className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                        selectedElementKey === item.key
                          ? "bg-amber-500 text-black shadow-md font-black"
                          : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {selectedElementKey === item.key && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* العمود الأيسر: لوحة التحكم المباشرة (D-Pad، الحجم، اللون، الإجراء) */}
              <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-4">
                
                {/* عنوان العنصر النشط */}
                <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-black text-sm">العنصر المحدد:</span>
                    <span className="text-white font-black text-sm">
                      {elementsList.find((i) => i.key === selectedElementKey)?.label || selectedElementKey}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSelectedElementField("hidden", !selectedStyle.hidden)}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                      selectedStyle.hidden
                        ? "bg-rose-600 text-white"
                        : "bg-emerald-600/80 text-white"
                    }`}
                  >
                    {selectedStyle.hidden ? "👁️ مخفي (إظهار)" : "👁️ ظاهر (إخفاء)"}
                  </button>
                </div>

                {/* لوحة الأسهم D-Pad لتعديل الموقع بدقة */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  
                  {/* أزرار التحريك D-Pad */}
                  <div className="flex flex-col items-center justify-center p-3 bg-slate-950 rounded-2xl border border-slate-800/80">
                    <span className="text-[11px] font-black text-slate-400 mb-2">🕹️ تحريك الموقع (X / Y)</span>
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleShift(0, -3)}
                        className="w-12 h-10 bg-slate-800 hover:bg-amber-500 hover:text-black text-white font-black rounded-xl active:scale-90 transition shadow-sm"
                        title="أعلى"
                      >
                        ▲
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleShift(3, 0)}
                          className="w-12 h-10 bg-slate-800 hover:bg-amber-500 hover:text-black text-white font-black rounded-xl active:scale-90 transition shadow-sm"
                          title="يمين"
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          onClick={handleResetPosition}
                          className="w-10 h-10 bg-slate-900 border border-amber-500/40 text-amber-300 text-[10px] font-black rounded-xl active:scale-90 transition shadow-sm"
                          title="إعادة للمركز"
                        >
                          🎯
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShift(-3, 0)}
                          className="w-12 h-10 bg-slate-800 hover:bg-amber-500 hover:text-black text-white font-black rounded-xl active:scale-90 transition shadow-sm"
                          title="يسار"
                        >
                          ◀
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleShift(0, 3)}
                        className="w-12 h-10 bg-slate-800 hover:bg-amber-500 hover:text-black text-white font-black rounded-xl active:scale-90 transition shadow-sm"
                        title="أسفل"
                      >
                        ▼
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-slate-400">
                      <span>X: {selectedStyle.offsetX || 0}px</span>
                      <span>Y: {selectedStyle.offsetY || 0}px</span>
                    </div>
                  </div>

                  {/* الحجم والتدوير والظل */}
                  <div className="space-y-3 bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
                        <span>🔍 الحجم والتكبير:</span>
                        <span className="font-mono text-amber-400">{Math.round((selectedStyle.scale ?? 1) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="2.5"
                        step="0.05"
                        value={selectedStyle.scale ?? 1}
                        onChange={(e) => updateSelectedElementField("scale", parseFloat(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
                        <span>🔄 زاوية التدوير:</span>
                        <span className="font-mono text-amber-400">{selectedStyle.rotate || 0}°</span>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="5"
                        value={selectedStyle.rotate ?? 0}
                        onChange={(e) => updateSelectedElementField("rotate", parseInt(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedStyle.hasShadow ?? false}
                          onChange={(e) => updateSelectedElementField("hasShadow", e.target.checked)}
                          className="accent-amber-500 h-4 w-4 rounded"
                        />
                        <span>تشغيل ظل أنيق</span>
                      </label>
                      <input
                        type="color"
                        value={selectedStyle.color || "#ffffff"}
                        onChange={(e) => updateSelectedElementField("color", e.target.value)}
                        className="h-7 w-12 bg-transparent rounded cursor-pointer border border-slate-700"
                        title="تغيير اللون"
                      />
                    </div>
                  </div>
                </div>

                {/* إذا كان العنصر مخصصاً (نص أو صورة مضافة) */}
                {isSelectedCustom && selectedCustomElement && (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-amber-500/30 space-y-3">
                    <span className="text-xs font-black text-amber-300">✨ إعدادات العنصر المخصص والإجراء التفاعلي</span>
                    
                    {selectedCustomElement.type === "text" ? (
                      <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1">محتوى النص:</label>
                        <input
                          type="text"
                          value={selectedCustomElement.textContent || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConfig((prev) => {
                              if (!prev) return prev;
                              const targetCardKey = activeCard === "order_info" ? "orderInfoCard" : activeCard === "money_flow" ? "moneyFlowCard" : activeCard;
                              const currentCard = (prev as any)[targetCardKey] || {};
                              const updated = (currentCard.customElements || []).map((el: CustomAddedElement) =>
                                el.id === selectedCustomElement.id ? { ...el, textContent: val } : el
                              );
                              return { ...prev, [targetCardKey]: { ...currentCard, customElements: updated } };
                            });
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                          placeholder="اكتب النص الذي تريده..."
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1">رابط الصورة (URL):</label>
                        <input
                          type="text"
                          value={selectedCustomElement.imageUrl || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConfig((prev) => {
                              if (!prev) return prev;
                              const targetCardKey = activeCard === "order_info" ? "orderInfoCard" : activeCard === "money_flow" ? "moneyFlowCard" : activeCard;
                              const currentCard = (prev as any)[targetCardKey] || {};
                              const updated = (currentCard.customElements || []).map((el: CustomAddedElement) =>
                                el.id === selectedCustomElement.id ? { ...el, imageUrl: val } : el
                              );
                              return { ...prev, [targetCardKey]: { ...currentCard, customElements: updated } };
                            });
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                          placeholder="https://..."
                        />
                      </div>
                    )}

                    {/* نوع الإجراء (Action Type) */}
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">الإجراء عند الضغط:</label>
                      <select
                        value={selectedCustomElement.actionType || "none"}
                        onChange={(e) => {
                          const val = e.target.value as ElementActionType;
                          setConfig((prev) => {
                            if (!prev) return prev;
                            const targetCardKey = activeCard === "order_info" ? "orderInfoCard" : activeCard === "money_flow" ? "moneyFlowCard" : activeCard;
                            const currentCard = (prev as any)[targetCardKey] || {};
                            const updated = (currentCard.customElements || []).map((el: CustomAddedElement) =>
                              el.id === selectedCustomElement.id ? { ...el, actionType: val } : el
                            );
                            return { ...prev, [targetCardKey]: { ...currentCard, customElements: updated } };
                          });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold"
                      >
                        <option value="none">عنصر زينة وشكل فقط (بدون إجراء)</option>
                        <option value="open_url">🌐 فتح رابط موقع (URL)</option>
                        <option value="call_phone">📞 اتصال برقم هاتف</option>
                        <option value="whatsapp">💬 فتح محادثة واتساب</option>
                        <option value="google_maps">📍 فتح لوكيشن في خرائط جوجل</option>
                        <option value="copy_text">📋 نسخ نص للحافظة</option>
                        <option value="zoom_image">🔍 تكبير الصورة</option>
                        <option value="show_alert">⚠️ إظهار تنبيه ورسالة منبثقة</option>
                      </select>
                    </div>

                    {/* زر حذف العنصر المخصص */}
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm("هل أنت متأكد من حذف هذا العنصر؟")) return;
                          setConfig((prev) => {
                            if (!prev) return prev;
                            const targetCardKey = activeCard === "order_info" ? "orderInfoCard" : activeCard === "money_flow" ? "moneyFlowCard" : activeCard;
                            const currentCard = (prev as any)[targetCardKey] || {};
                            const updated = (currentCard.customElements || []).filter((el: CustomAddedElement) => el.id !== selectedCustomElement.id);
                            return { ...prev, [targetCardKey]: { ...currentCard, customElements: updated } };
                          });
                          setSelectedElementKey("btnCall");
                        }}
                        className="px-3 py-1.5 bg-rose-600/20 border border-rose-600/40 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-black transition"
                      >
                        🗑️ حذف العنصر
                      </button>
                    </div>

                  </div>
                )}

              </div>

            </div>
          )}

        </div>

        {/* الشريط السفلي: أزرار الحفظ والإغلاق */}
        <div className="flex items-center justify-between gap-3 p-4 bg-slate-950/90 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-black transition"
          >
            إغلاق
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="animate-spin">🔄</span>
                <span>جاري الحفظ والتزامن...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>حفظ وتزامن فوري ({scope === "admin" ? "للإدارة 🖥️" : "للمندوبين 📱"})</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
