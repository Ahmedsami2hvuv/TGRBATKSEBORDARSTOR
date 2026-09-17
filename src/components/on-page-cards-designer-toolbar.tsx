"use client";

import React, { useState } from "react";
import {
  type OrderCardDesignerConfig,
  type CustomElementConfig,
  type CustomAddedElement,
  type ElementActionType,
} from "@/lib/order-card-customizer";

type Props = {
  config: OrderCardDesignerConfig;
  onChangeConfig: (newConfig: OrderCardDesignerConfig) => void;
  selectedCard: "shopCard" | "customerCard" | "orderInfoCard" | "moneyFlowCard";
  selectedElementKey: string;
  onSelectElement: (key: string, cardType?: "shopCard" | "customerCard" | "orderInfoCard" | "moneyFlowCard") => void;
  currentScope?: "admin" | "mandoub";
  onScopeChange?: (scope: "admin" | "mandoub") => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  saveSuccessMsg: string | null;
};

type ToolTab = "move" | "size" | "rotate" | "custom";

export function OnPageCardsDesignerToolbar({
  config,
  onChangeConfig,
  selectedCard,
  selectedElementKey,
  onSelectElement,
  currentScope = "admin",
  onScopeChange,
  onSave,
  onClose,
  isSaving,
  saveSuccessMsg,
}: Props) {
  const [activeTool, setActiveTool] = useState<ToolTab>("move");
  const [moveStep, setMoveStep] = useState<number>(3);

  // قائمة العناصر حسب الكارت النشط
  const getCardElementsList = (): { key: string; label: string; card: "shopCard" | "customerCard" | "orderInfoCard" | "moneyFlowCard"; isCustom?: boolean }[] => {
    const list: { key: string; label: string; card: "shopCard" | "customerCard" | "orderInfoCard" | "moneyFlowCard"; isCustom?: boolean }[] = [];

    if (selectedCard === "shopCard") {
      list.push(
        { key: "btnCall", label: "📞 زر الاتصال (المحل)", card: "shopCard" },
        { key: "btnWhatsapp", label: "💬 زر الواتساب (المحل)", card: "shopCard" },
        { key: "btnShopLocation", label: "📍 زر موقع المحل", card: "shopCard" },
        { key: "headerShopInfo", label: "🏷️ كبسولة عنوان المحل", card: "shopCard" },
        { key: "iconShopName", label: "🏢 أيقونة اسم المحل", card: "shopCard" },
        { key: "textShopName", label: "✍️ نص اسم المحل", card: "shopCard" },
        { key: "iconCustomerName", label: "👤 أيقونة اسم صاحب المحل", card: "shopCard" },
        { key: "textCustomerName", label: "✍️ نص اسم صاحب المحل", card: "shopCard" },
        { key: "iconRegion", label: "📍 أيقونة المنطقة", card: "shopCard" },
        { key: "textRegion", label: "✍️ نص المنطقة", card: "shopCard" },
        { key: "iconPhone", label: "📱 أيقونة رقم الهاتف", card: "shopCard" },
        { key: "textPhone", label: "✍️ نص رقم الهاتف", card: "shopCard" },
        { key: "photoContainer", label: "🖼️ إطار صورة باب المحل", card: "shopCard" },
        { key: "btnCamera", label: "📷 زر كاميرا الباب", card: "shopCard" },
        { key: "btnGallery", label: "🖼️ زر معرض الباب", card: "shopCard" }
      );
      (config.shopCard?.customElements || []).forEach((el) => {
        list.push({ key: `custom_${el.id}`, label: `✨ ${el.title || "عنصر مخصص"}`, card: "shopCard", isCustom: true });
      });
    } else if (selectedCard === "customerCard") {
      list.push(
        { key: "btnCall", label: "📞 زر الاتصال (الزبون)", card: "customerCard" },
        { key: "btnWhatsapp", label: "💬 زر الواتساب (الزبون)", card: "customerCard" },
        { key: "btnLocation", label: "📍 زر موقع الزبون", card: "customerCard" },
        { key: "headerCustomerInfo", label: "🏷️ كبسولة عنوان الزبون", card: "customerCard" },
        { key: "iconCustomerName", label: "👤 أيقونة اسم الزبون", card: "customerCard" },
        { key: "textCustomerName", label: "✍️ نص اسم الزبون", card: "customerCard" },
        { key: "iconRegion", label: "📍 أيقونة المنطقة", card: "customerCard" },
        { key: "textRegion", label: "✍️ نص المنطقة", card: "customerCard" },
        { key: "iconPhone", label: "📱 أيقونة رقم الهاتف", card: "customerCard" },
        { key: "textPhone", label: "✍️ نص رقم الهاتف", card: "customerCard" },
        { key: "photoContainer", label: "🖼️ إطار صورة باب الزبون", card: "customerCard" },
        { key: "btnCamera", label: "📷 زر كاميرا الباب", card: "customerCard" },
        { key: "btnGallery", label: "🖼️ زر معرض الباب", card: "customerCard" }
      );
      (config.customerCard?.customElements || []).forEach((el) => {
        list.push({ key: `custom_${el.id}`, label: `✨ ${el.title || "عنصر مخصص"}`, card: "customerCard", isCustom: true });
      });
    } else if (selectedCard === "orderInfoCard") {
      list.push(
        { key: "headerInfo", label: "🏷️ رأس كارت الطلبية", card: "orderInfoCard" },
        { key: "iconOrderBox", label: "📦 أيقونة نوع الطلب", card: "orderInfoCard" },
        { key: "textOrderType", label: "✍️ نص نوع الطلب", card: "orderInfoCard" },
        { key: "iconClock", label: "⏰ أيقونة التوقيت", card: "orderInfoCard" },
        { key: "textOrderTime", label: "✍️ نص وقت الطلب", card: "orderInfoCard" },
        { key: "blockSubtotal", label: "💵 بلوك سعر المواد", card: "orderInfoCard" },
        { key: "blockDelivery", label: "🛵 بلوك أجور التوصيل", card: "orderInfoCard" },
        { key: "blockDebt", label: "💳 بلوك الديون", card: "orderInfoCard" },
        { key: "blockTotal", label: "💰 بلوك الحساب الكلي", card: "orderInfoCard" },
        { key: "photoContainer", label: "🖼️ إطار صورة الطلبية", card: "orderInfoCard" },
        { key: "btnCamera", label: "📷 زر كاميرا الطلبية", card: "orderInfoCard" },
        { key: "btnGallery", label: "🖼️ زر معرض الطلبية", card: "orderInfoCard" }
      );
      (config.orderInfoCard?.customElements || []).forEach((el) => {
        list.push({ key: `custom_${el.id}`, label: `✨ ${el.title || "عنصر مخصص"}`, card: "orderInfoCard", isCustom: true });
      });
    } else if (selectedCard === "moneyFlowCard") {
      list.push(
        { key: "badgeSader", label: "📤 شارة الصادر", card: "moneyFlowCard" },
        { key: "badgeWard", label: "📥 شارة الوارد", card: "moneyFlowCard" },
        { key: "btnSaderAction", label: "📤 زر تسليم صادر", card: "moneyFlowCard" },
        { key: "btnWardAction", label: "📥 زر استلام وارد", card: "moneyFlowCard" },
        { key: "recordItemCard", label: "📄 كارت السجل المالي", card: "moneyFlowCard" }
      );
      (config.moneyFlowCard?.customElements || []).forEach((el) => {
        list.push({ key: `custom_${el.id}`, label: `✨ ${el.title || "عنصر مخصص"}`, card: "moneyFlowCard", isCustom: true });
      });
    }

    return list;
  };

  const getSelectedElementConfig = (): CustomElementConfig => {
    if (!config) return {};
    const cardData = (config as any)[selectedCard] || {};
    if (selectedElementKey.startsWith("custom_")) {
      const customId = selectedElementKey.replace("custom_", "");
      const elem = (cardData.customElements || []).find((e: CustomAddedElement) => e.id === customId);
      return elem?.style || {};
    }
    return cardData[selectedElementKey] || {};
  };

  const updateSelectedElementField = (field: keyof CustomElementConfig, value: any) => {
    const cardData = (config as any)[selectedCard] || {};
    if (selectedElementKey.startsWith("custom_")) {
      const customId = selectedElementKey.replace("custom_", "");
      const currentCustoms: CustomAddedElement[] = cardData.customElements || [];
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
      onChangeConfig({
        ...config,
        [selectedCard]: {
          ...cardData,
          customElements: updatedCustoms,
        },
      });
      return;
    }

    const currentElem = cardData[selectedElementKey] || {};
    onChangeConfig({
      ...config,
      [selectedCard]: {
        ...cardData,
        [selectedElementKey]: {
          ...currentElem,
          [field]: value,
        },
      },
    });
  };

  const handleShift = (dx: number, dy: number) => {
    const current = getSelectedElementConfig();
    const curX = current.offsetX || 0;
    const curY = current.offsetY || 0;
    updateSelectedElementField("offsetX", Math.round(curX + dx));
    updateSelectedElementField("offsetY", Math.round(curY + dy));
  };

  const handleResetPosition = () => {
    updateSelectedElementField("offsetX", 0);
    updateSelectedElementField("offsetY", 0);
  };

  const adjustScaleX = (delta: number) => {
    const current = getSelectedElementConfig();
    const cur = current.scaleX ?? 1;
    const nextVal = Math.max(0.1, Math.min(3, Math.round((cur + delta) * 100) / 100));
    updateSelectedElementField("scaleX", nextVal);
  };

  const adjustScaleY = (delta: number) => {
    const current = getSelectedElementConfig();
    const cur = current.scaleY ?? 1;
    const nextVal = Math.max(0.1, Math.min(3, Math.round((cur + delta) * 100) / 100));
    updateSelectedElementField("scaleY", nextVal);
  };

  const adjustScale = (delta: number) => {
    const current = getSelectedElementConfig();
    const cur = current.scale ?? 1;
    const nextVal = Math.max(0.2, Math.min(3, Math.round((cur + delta) * 100) / 100));
    updateSelectedElementField("scale", nextVal);
  };

  const adjustRotate = (delta: number) => {
    const current = getSelectedElementConfig();
    const cur = current.rotate ?? 0;
    const nextVal = Math.round(cur + delta);
    updateSelectedElementField("rotate", nextVal);
  };

  const selectedStyle = getSelectedElementConfig();
  const elementsList = getCardElementsList();
  const isSelectedCustom = selectedElementKey.startsWith("custom_");
  const selectedCustomElement = isSelectedCustom
    ? (((config as any)[selectedCard]?.customElements || []) as CustomAddedElement[]).find(
        (e) => e.id === selectedElementKey.replace("custom_", "")
      )
    : null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-gradient-to-t from-slate-950 via-slate-950/98 to-slate-950/95 backdrop-blur-md border-t-2 border-amber-500/60 shadow-[0_-15px_40px_rgba(0,0,0,0.85)] p-2 sm:p-3 text-white max-w-4xl mx-auto rounded-t-3xl animate-fadeIn">
      
      {/* إشعار النجاح */}
      {saveSuccessMsg && (
        <div className="bg-emerald-600/95 text-white text-center py-1.5 px-3 mb-2 rounded-xl text-xs font-black animate-pulse flex items-center justify-center gap-2">
          <span>✅</span>
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* الشريط العلوي: العنوان + تبديل النطاق + زر الحفظ وزر الإغلاق */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-amber-500/30">
        <div className="flex items-center gap-2">
          <span className="text-xl animate-bounce">🎯</span>
          <div>
            <span className="text-xs sm:text-sm font-black text-amber-300 block">
              وضع تعديل الأيقونات المباشر بالطلب
            </span>
            <span className="text-[10px] text-slate-300 font-bold hidden sm:inline">
              انقر على أي زر في الصفحة أعلاه وسيتحرك ويتعدل مباشرة أمامك!
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onScopeChange && (
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-700 text-[11px]">
              <button
                type="button"
                onClick={() => onScopeChange("admin")}
                className={`px-2 py-1 rounded-lg font-black transition ${
                  currentScope === "admin" ? "bg-amber-500 text-black shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                🖥️ الإدارة
              </button>
              <button
                type="button"
                onClick={() => onScopeChange("mandoub")}
                className={`px-2 py-1 rounded-lg font-black transition ${
                  currentScope === "mandoub" ? "bg-emerald-500 text-black shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                📱 المندوب
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl shadow-md active:scale-95 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? <span>🔄 جاري الحفظ...</span> : <span>💾 حفظ وتزامن</span>}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-8 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition flex items-center gap-1"
            title="إنهاء وضع التعديل"
          >
            <span>✕</span>
            <span className="hidden sm:inline">إنهاء</span>
          </button>
        </div>
      </div>

      {/* صف اختيار العنصر + سويتش إخفاء/إظهار + ضبط افتراضي */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="hidden sm:flex items-center gap-1 text-amber-400 font-black text-xs shrink-0">
          العنصر المحدد:
        </span>
        <select
          value={selectedElementKey}
          onChange={(e) => onSelectElement(e.target.value)}
          className="flex-1 min-w-0 bg-slate-900 border border-amber-500/40 text-amber-300 font-black text-[11px] sm:text-xs rounded-xl px-2 py-1.5 focus:ring-2 focus:ring-amber-400"
        >
          {elementsList.map((i) => (
            <option key={i.key} value={i.key}>
              {i.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => updateSelectedElementField("hidden", !selectedStyle.hidden)}
          className={`shrink-0 h-8 px-2.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
            selectedStyle.hidden
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
              : "bg-emerald-600/80 text-white hover:bg-emerald-600"
          }`}
          title={selectedStyle.hidden ? "إظهار العنصر" : "إخفاء العنصر"}
        >
          <span>{selectedStyle.hidden ? "🙈 مخفي" : "👁️ ظاهر"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            updateSelectedElementField("offsetX", 0);
            updateSelectedElementField("offsetY", 0);
            updateSelectedElementField("scale", 1);
            updateSelectedElementField("scaleX", 1);
            updateSelectedElementField("scaleY", 1);
            updateSelectedElementField("rotate", 0);
          }}
          className="shrink-0 h-8 w-8 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition flex items-center justify-center"
          title="إعادة ضبط افتراضي"
        >
          🔄
        </button>
      </div>

      {/* شريط تبويبات الأدوات */}
      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 mb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTool("move")}
          className={`flex-1 min-w-[62px] px-2 py-1.5 rounded-lg text-[11px] font-black whitespace-nowrap transition ${
            activeTool === "move" ? "bg-amber-500 text-black shadow" : "text-slate-400 hover:text-white"
          }`}
        >
          🕹️ تحريك
        </button>
        <button
          type="button"
          onClick={() => setActiveTool("size")}
          className={`flex-1 min-w-[62px] px-2 py-1.5 rounded-lg text-[11px] font-black whitespace-nowrap transition ${
            activeTool === "size" ? "bg-amber-500 text-black shadow" : "text-slate-400 hover:text-white"
          }`}
        >
          📐 الحجم
        </button>
        <button
          type="button"
          onClick={() => setActiveTool("rotate")}
          className={`flex-1 min-w-[62px] px-2 py-1.5 rounded-lg text-[11px] font-black whitespace-nowrap transition ${
            activeTool === "rotate" ? "bg-amber-500 text-black shadow" : "text-slate-400 hover:text-white"
          }`}
        >
          🔄 دوران/لون
        </button>
        {isSelectedCustom && (
          <button
            type="button"
            onClick={() => setActiveTool("custom")}
            className={`flex-1 min-w-[62px] px-2 py-1.5 rounded-lg text-[11px] font-black whitespace-nowrap transition ${
              activeTool === "custom" ? "bg-amber-500 text-black shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            ✨ مخصص
          </button>
        )}
      </div>

      {/* محتوى التبويب النشط */}
      <div className="max-h-[30vh] overflow-y-auto">
        
        {/* تبويب التحريك D-Pad */}
        {activeTool === "move" && (
          <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-black text-amber-300">تحريك الموقع (D-Pad)</span>
              <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400">الخطوة:</span>
                {[1, 3, 10].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setMoveStep(step)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      moveStep === step ? "bg-amber-500 text-black font-black" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {step}px
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleShift(0, -moveStep)}
                  className="w-12 h-8 bg-slate-800 hover:bg-amber-500 hover:text-black text-white font-black rounded-lg active:scale-90 transition flex items-center justify-center text-sm"
                  title="أعلى"
                >
                  ▲
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleShift(moveStep, 0)}
                    className="w-12 h-8 bg-slate-800 hover:bg-amber-500 hover:text-black text-white font-black rounded-lg active:scale-90 transition flex items-center justify-center text-sm"
                    title="يمين"
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPosition}
                    className="w-8 h-8 bg-slate-900 border border-amber-500/40 text-amber-300 text-xs font-black rounded-lg active:scale-90 transition flex items-center justify-center"
                    title="مركز"
                  >
                    🎯
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShift(-moveStep, 0)}
                    className="w-12 h-8 bg-slate-800 hover:bg-amber-500 hover:text-black text-white font-black rounded-lg active:scale-90 transition flex items-center justify-center text-sm"
                    title="يسار"
                  >
                    ◀
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleShift(0, moveStep)}
                  className="w-12 h-8 bg-slate-800 hover:bg-amber-500 hover:text-black text-white font-black rounded-lg active:scale-90 transition flex items-center justify-center text-sm"
                  title="أسفل"
                >
                  ▼
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-300 space-y-1 text-center">
                <div>X: <strong className="text-amber-400">{selectedStyle.offsetX || 0}px</strong></div>
                <div>Y: <strong className="text-amber-400">{selectedStyle.offsetY || 0}px</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* تبويب الحجم والمقاسات */}
        {activeTool === "size" && (
          <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 space-y-2">
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-0.5">
                <span>↔️ التكبير الأفقي (العرض)</span>
                <span className="font-mono text-amber-400">{Math.round((selectedStyle.scaleX ?? 1) * 100)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => adjustScaleX(-0.05)} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded text-xs">-</button>
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.05"
                  value={selectedStyle.scaleX ?? 1}
                  onChange={(e) => updateSelectedElementField("scaleX", parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <button type="button" onClick={() => adjustScaleX(0.05)} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded text-xs">+</button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-0.5">
                <span>↕️ التكبير العمودي (الارتفاع)</span>
                <span className="font-mono text-amber-400">{Math.round((selectedStyle.scaleY ?? 1) * 100)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => adjustScaleY(-0.05)} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded text-xs">-</button>
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.05"
                  value={selectedStyle.scaleY ?? 1}
                  onChange={(e) => updateSelectedElementField("scaleY", parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <button type="button" onClick={() => adjustScaleY(0.05)} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded text-xs">+</button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-0.5">
                <span>🔍 الحجم الكلي العام</span>
                <span className="font-mono text-amber-400">{Math.round((selectedStyle.scale ?? 1) * 100)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => adjustScale(-0.05)} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded text-xs">-</button>
                <input
                  type="range"
                  min="0.3"
                  max="2.5"
                  step="0.05"
                  value={selectedStyle.scale ?? 1}
                  onChange={(e) => updateSelectedElementField("scale", parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <button type="button" onClick={() => adjustScale(0.05)} className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded text-xs">+</button>
              </div>
            </div>
          </div>
        )}

        {/* تبويب التدوير واللون والظل */}
        {activeTool === "rotate" && (
          <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 space-y-2">
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-0.5">
                <span>🔄 زاوية التدوير</span>
                <span className="font-mono text-amber-400">{selectedStyle.rotate || 0}°</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => adjustRotate(-5)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded text-[10px]">-5°</button>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={selectedStyle.rotate ?? 0}
                  onChange={(e) => updateSelectedElementField("rotate", parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <button type="button" onClick={() => adjustRotate(5)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded text-[10px]">+5°</button>
              </div>
              <div className="flex items-center justify-between gap-1 mt-1">
                <button type="button" onClick={() => updateSelectedElementField("rotate", 0)} className="flex-1 px-1 py-0.5 bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-white rounded">0° استقامة</button>
                <button type="button" onClick={() => updateSelectedElementField("rotate", 90)} className="flex-1 px-1 py-0.5 bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-white rounded">90° عمودي</button>
                <button type="button" onClick={() => updateSelectedElementField("rotate", 180)} className="flex-1 px-1 py-0.5 bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-white rounded">180° مقلوب</button>
              </div>
            </div>

            <div className="pt-1.5 space-y-1.5 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300">لون النص / الأيقونة:</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={selectedStyle.color || "#ffffff"}
                    onChange={(e) => updateSelectedElementField("color", e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700 text-[10px] font-mono text-center rounded px-1 py-0.5 text-white"
                  />
                  <input
                    type="color"
                    value={selectedStyle.color || "#ffffff"}
                    onChange={(e) => updateSelectedElementField("color", e.target.value)}
                    className="h-6 w-8 bg-transparent rounded cursor-pointer border border-slate-700"
                    title="تغيير اللون"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStyle.hasShadow ?? false}
                    onChange={(e) => updateSelectedElementField("hasShadow", e.target.checked)}
                    className="accent-amber-500 h-3.5 w-3.5 rounded"
                  />
                  <span>ظل أنيق</span>
                </label>
                {selectedStyle.hasShadow && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">قوة:</span>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      value={selectedStyle.shadowBlur ?? 3}
                      onChange={(e) => updateSelectedElementField("shadowBlur", parseInt(e.target.value))}
                      className="w-16 accent-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* تبويب العنصر المخصص */}
        {activeTool === "custom" && isSelectedCustom && selectedCustomElement && (
          <div className="bg-slate-950 p-2.5 rounded-2xl border border-amber-500/30 space-y-2">
            {selectedCustomElement.type === "text" ? (
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">محتوى النص:</label>
                <input
                  type="text"
                  value={selectedCustomElement.textContent || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cardData = (config as any)[selectedCard] || {};
                    const updated = (cardData.customElements || []).map((el: CustomAddedElement) =>
                      el.id === selectedCustomElement.id ? { ...el, textContent: val } : el
                    );
                    onChangeConfig({ ...config, [selectedCard]: { ...cardData, customElements: updated } });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-bold"
                />
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">رابط الصورة:</label>
                <input
                  type="text"
                  value={selectedCustomElement.imageUrl || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cardData = (config as any)[selectedCard] || {};
                    const updated = (cardData.customElements || []).map((el: CustomAddedElement) =>
                      el.id === selectedCustomElement.id ? { ...el, imageUrl: val } : el
                    );
                    onChangeConfig({ ...config, [selectedCard]: { ...cardData, customElements: updated } });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                />
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
