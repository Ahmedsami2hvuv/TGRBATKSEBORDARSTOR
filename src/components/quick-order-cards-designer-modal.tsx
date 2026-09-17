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
  const [moveStep, setMoveStep] = useState<number>(3); // خطوة التحريك بالبكسل

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
        { key: "btnWhatsapp", label: "💬 زر الواتساب" },
        { key: "btnShopLocation", label: "📍 زر موقع المحل" },
        { key: "headerShopInfo", label: "🏷️ كبسولة عنوان المحل" },
        { key: "iconShopName", label: "🏢 أيقونة اسم المحل" },
        { key: "textShopName", label: "✍️ نص اسم المحل" },
        { key: "iconCustomerName", label: "👤 أيقونة اسم صاحب المحل" },
        { key: "textCustomerName", label: "✍️ نص اسم صاحب المحل" },
        { key: "iconRegion", label: "📍 أيقونة المنطقة" },
        { key: "textRegion", label: "✍️ نص المنطقة" },
        { key: "iconPhone", label: "📱 أيقونة رقم الهاتف" },
        { key: "textPhone", label: "✍️ نص رقم الهاتف" },
        { key: "photoContainer", label: "🖼️ إطار صورة باب المحل" },
        { key: "btnCamera", label: "📷 زر كاميرا الباب" },
        { key: "btnGallery", label: "🖼️ زر معرض الباب" },
      ];
      (config.shopCard?.customElements || []).forEach((el) => {
        list.push({ key: `custom_${el.id}`, label: `✨ ${el.title || (el.type === "text" ? el.textContent : "عنصر مخصص")}`, isCustom: true });
      });
      return list;
    }
    if (activeCard === "customer_card") {
      const list = [
        { key: "btnCall", label: "📞 زر الاتصال" },
        { key: "btnWhatsapp", label: "💬 زر الواتساب" },
        { key: "btnLocation", label: "📍 زر موقع الزبون" },
        { key: "headerCustomerInfo", label: "🏷️ كبسولة عنوان الزبون" },
        { key: "iconCustomerName", label: "👤 أيقونة اسم الزبون" },
        { key: "textCustomerName", label: "✍️ نص اسم الزبون" },
        { key: "iconRegion", label: "📍 أيقونة المنطقة" },
        { key: "textRegion", label: "✍️ نص المنطقة" },
        { key: "iconPhone", label: "📱 أيقونة رقم الهاتف" },
        { key: "textPhone", label: "✍️ نص رقم الهاتف" },
        { key: "photoContainer", label: "🖼️ إطار صورة باب الزبون" },
        { key: "btnCamera", label: "📷 زر كاميرا الباب" },
        { key: "btnGallery", label: "🖼️ زر معرض الباب" },
      ];
      (config.customerCard?.customElements || []).forEach((el) => {
        list.push({ key: `custom_${el.id}`, label: `✨ ${el.title || (el.type === "text" ? el.textContent : "عنصر مخصص")}`, isCustom: true });
      });
      return list;
    }
    if (activeCard === "order_info") {
      const list = [
        { key: "headerInfo", label: "🏷️ رأس كارت الطلبية" },
        { key: "iconOrderBox", label: "📦 أيقونة صندوق الطلب" },
        { key: "textOrderType", label: "✍️ نص نوع الطلب" },
        { key: "iconClock", label: "⏰ أيقونة التوقيت" },
        { key: "textOrderTime", label: "✍️ نص وقت الطلب" },
        { key: "iconCoins", label: "🪙 أيقونة العملات" },
        { key: "blockSubtotal", label: "💵 بلوك سعر المواد" },
        { key: "blockDelivery", label: "🛵 بلوك أجور التوصيل" },
        { key: "blockDebt", label: "💳 بلوك الديون" },
        { key: "blockTotal", label: "💰 بلوك الحساب الكلي" },
        { key: "photoContainer", label: "🖼️ إطار صورة الطلبية" },
        { key: "btnCamera", label: "📷 زر كاميرا الطلبية" },
        { key: "btnGallery", label: "🖼️ زر معرض الطلبية" },
      ];
      (config.orderInfoCard?.customElements || []).forEach((el) => {
        list.push({ key: `custom_${el.id}`, label: `✨ ${el.title || (el.type === "text" ? el.textContent : "عنصر مخصص")}`, isCustom: true });
      });
      return list;
    }
    if (activeCard === "money_flow") {
      const list = [
        { key: "badgeSader", label: "📤 شارة الصادر" },
        { key: "badgeWard", label: "📥 شارة الوارد" },
        { key: "btnSaderAction", label: "📤 زر تسليم صادر" },
        { key: "btnWardAction", label: "📥 زر استلام وارد" },
        { key: "recordItemCard", label: "📄 كارت السجل المالي" },
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
    updateSelectedElementField("offsetX", Math.round(curX + dx));
    updateSelectedElementField("offsetY", Math.round(curY + dy));
  };

  // إعادة ضبط الموضع للمركز
  const handleResetPosition = () => {
    updateSelectedElementField("offsetX", 0);
    updateSelectedElementField("offsetY", 0);
  };

  // تعديل التكبير الأفقي ScaleX
  const adjustScaleX = (delta: number) => {
    const current = getSelectedElementConfig();
    const cur = current.scaleX ?? 1;
    const nextVal = Math.max(0.1, Math.min(3, Math.round((cur + delta) * 100) / 100));
    updateSelectedElementField("scaleX", nextVal);
  };

  // تعديل التكبير العمودي ScaleY
  const adjustScaleY = (delta: number) => {
    const current = getSelectedElementConfig();
    const cur = current.scaleY ?? 1;
    const nextVal = Math.max(0.1, Math.min(3, Math.round((cur + delta) * 100) / 100));
    updateSelectedElementField("scaleY", nextVal);
  };

  // تعديل التكبير الكلي Scale
  const adjustScale = (delta: number) => {
    const current = getSelectedElementConfig();
    const cur = current.scale ?? 1;
    const nextVal = Math.max(0.2, Math.min(3, Math.round((cur + delta) * 100) / 100));
    updateSelectedElementField("scale", nextVal);
  };

  // تعديل زاوية التدوير Rotate
  const adjustRotate = (delta: number) => {
    const current = getSelectedElementConfig();
    const cur = current.rotate ?? 0;
    const nextVal = Math.round(cur + delta);
    updateSelectedElementField("rotate", nextVal);
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
        scaleX: 1,
        scaleY: 1,
        rotate: 0,
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

  // مكون مساعد لتغليف كل عنصر في المعاينة وجعله قابلاً للنقر والتحديد البصري المباشر
  const InteractiveElement = ({
    elemKey,
    title,
    cfg,
    children,
    className = "",
    styleOverride,
  }: {
    elemKey: string;
    title: string;
    cfg?: CustomElementConfig;
    children: React.ReactNode;
    className?: string;
    styleOverride?: React.CSSProperties;
  }) => {
    const isSelected = selectedElementKey === elemKey;
    const isHidden = cfg?.hidden;

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          setSelectedElementKey(elemKey);
        }}
        title={`انقر لتحديد (${title}) وتعديل موضعه وتكبيره وتدويره`}
        className={`relative group cursor-pointer transition-all duration-200 select-none ${
          isSelected
            ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950 rounded-xl shadow-[0_0_15px_rgba(245,215,127,0.8)] z-30"
            : "hover:ring-1 hover:ring-amber-400/60 hover:rounded-lg"
        } ${isHidden ? "opacity-30 grayscale dashed border border-rose-500/50" : ""} ${className}`}
        style={{
          ...getElementStyle(cfg),
          ...styleOverride,
        }}
      >
        {isSelected && (
          <div className="absolute -top-5 right-0 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow-md pointer-events-none whitespace-nowrap z-40 animate-bounce">
            ★ {title}
          </div>
        )}
        {children}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-1 sm:p-3 overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        
        {/* شريط العنوان والتبديل العلوي */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 sm:p-4 bg-slate-950/90 border-b border-amber-500/20 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎨</span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-amber-300">
                استوديو التعديل البصري المباشر لكروت الطلب
              </h3>
              <p className="text-xs font-bold text-slate-400">
                انقر على أي زر لتحديده وتحريكه وتدويره وتكبيره فوراً 🎯
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

        {/* خيار تفعيل / تعطيل الستايل الملكي في حساب المندوب */}
        {canSwitchScope && config && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚚</span>
              <div>
                <span className="text-xs sm:text-sm font-black text-amber-300 block">
                  تفعيل الستايل الملكي في حساب المندوب:
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {config.enabledPortals?.mandoub !== false ? (
                    <span className="text-emerald-400 font-black">✅ مفعّل للمندوبين حالياً</span>
                  ) : (
                    <span className="text-rose-400 font-black">⛔ معطّل للمندوبين (يظهر لهم الستايل الكلاسيكي القديم)</span>
                  )}
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabledPortals?.mandoub !== false}
                onChange={(e) => {
                  const val = e.target.checked;
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          enabledPortals: {
                            ...(prev.enabledPortals || { admin: true, mandoub: true, preparer: false }),
                            mandoub: val,
                          },
                        }
                      : null
                  );
                }}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        )}

        {/* إشعار النجاح */}
        {saveSuccessMsg && (
          <div className="bg-emerald-600/90 text-white text-center py-2 px-4 text-xs sm:text-sm font-black animate-pulse flex items-center justify-center gap-2">
            <span>✅</span>
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* شريط اختيار الكارت والأزرار السريعة */}
        <div className="flex items-center gap-2 p-2 bg-slate-900/80 border-b border-slate-800 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveCard("shop_card");
              setSelectedElementKey("btnCall");
            }}
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
            onClick={() => {
              setActiveCard("customer_card");
              setSelectedElementKey("btnCall");
            }}
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
            onClick={() => {
              setActiveCard("order_info");
              setSelectedElementKey("blockTotal");
            }}
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
            onClick={() => {
              setActiveCard("money_flow");
              setSelectedElementKey("btnSaderAction");
            }}
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
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4">
          
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-amber-400 font-bold">
              ⏳ جاري تحميل الإعدادات والتزامن...
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* ================= 1. قسم المعاينة التفاعلية البصرية الحية (Live Interactive Visual Preview) ================= */}
              <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-3 sm:p-4 shadow-xl">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-black text-xs sm:text-sm">👁️ المعاينة الحية المباشرة:</span>
                    <span className="text-[11px] text-slate-400 font-bold">
                      (انقر مباشرة على أي زر أو عنصر لتحديده والتحكم به)
                    </span>
                  </div>
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

                {/* كارت المعاينة التفاعلي بحسب الكارت النشط */}
                <div className="relative max-w-2xl mx-auto p-1 sm:p-2 bg-slate-900/40 rounded-2xl border border-slate-800">
                  
                  {/* --- كارت المحل (Shop Card) --- */}
                  {activeCard === "shop_card" && (
                    <div
                      className="relative w-full rounded-[20px] bg-no-repeat bg-[length:100%_100%] shadow-2xl p-3 sm:p-4 min-h-[220px]"
                      style={getCardContainerStyle(
                        config?.shopCard?.frameConfig,
                        config?.shopCard?.frameBgUrl || "/images/order-luxury/shop-card/shop-card-frame.webp"
                      )}
                    >
                      {/* العناصر المخصصة المضافة */}
                      {(config?.shopCard?.customElements || []).map((el) => (
                        <InteractiveElement
                          key={el.id}
                          elemKey={`custom_${el.id}`}
                          title={el.title || "عنصر مخصص"}
                          cfg={el.style}
                          className="absolute z-20"
                        >
                          {el.type === "text" ? (
                            <span className="font-bold text-xs">{el.textContent || "نص مخصص"}</span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={el.imageUrl || "/images/placeholder.png"} alt="صورة" className="h-7 w-auto object-contain" />
                          )}
                        </InteractiveElement>
                      ))}

                      <div className="grid grid-cols-2 gap-2 sm:gap-4 items-start relative z-10">
                        {/* الجانب الأيمن */}
                        <div className="flex flex-col gap-2">
                          <InteractiveElement
                            elemKey="headerShopInfo"
                            title="كبسولة عنوان المحل"
                            cfg={config?.shopCard?.headerShopInfo}
                            className="w-fit"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={config?.shopCard?.headerShopInfo?.imageUrl || "/images/order-luxury/shop-card/header-shop-info.webp"}
                              alt="المحل"
                              className="h-8 sm:h-9 w-auto object-contain pointer-events-none"
                            />
                          </InteractiveElement>

                          {/* بيانات المحل */}
                          <div className="space-y-1.5 py-0.5">
                            {/* اسم المحل */}
                            <div className="flex items-center gap-1.5">
                              <InteractiveElement elemKey="iconShopName" title="أيقونة اسم المحل" cfg={config?.shopCard?.iconShopName}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/images/order-luxury/shop-card/icon-shop-name.webp" alt="" className="w-6 h-6 object-contain pointer-events-none" />
                              </InteractiveElement>
                              <InteractiveElement elemKey="textShopName" title="نص اسم المحل" cfg={config?.shopCard?.textShopName}>
                                <span className="font-black text-xs sm:text-sm text-[#F5D77F]">متجر النور الملكي</span>
                              </InteractiveElement>
                            </div>

                            {/* اسم العميل / صاحب المحل */}
                            <div className="flex items-center gap-1.5">
                              <InteractiveElement elemKey="iconCustomerName" title="أيقونة صاحب المحل" cfg={config?.shopCard?.iconCustomerName}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/images/order-luxury/shop-card/icon-customer-name.webp" alt="" className="w-6 h-6 object-contain pointer-events-none" />
                              </InteractiveElement>
                              <InteractiveElement elemKey="textCustomerName" title="نص صاحب المحل" cfg={config?.shopCard?.textCustomerName}>
                                <span className="font-black text-xs text-emerald-300">أحمد سامي</span>
                              </InteractiveElement>
                            </div>

                            {/* المنطقة */}
                            <div className="flex items-center gap-1.5">
                              <InteractiveElement elemKey="iconRegion" title="أيقونة المنطقة" cfg={config?.shopCard?.iconRegion}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/images/order-luxury/shop-card/icon-region.webp" alt="" className="w-6 h-6 object-contain pointer-events-none" />
                              </InteractiveElement>
                              <InteractiveElement elemKey="textRegion" title="نص المنطقة" cfg={config?.shopCard?.textRegion}>
                                <span className="font-bold text-xs text-[#FFF8F0]">بغداد - الكرادة</span>
                              </InteractiveElement>
                            </div>

                            {/* الهاتف */}
                            <div className="flex items-center gap-1.5">
                              <InteractiveElement elemKey="iconPhone" title="أيقونة الهاتف" cfg={config?.shopCard?.iconPhone}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/images/order-luxury/shop-card/icon-phone.webp" alt="" className="w-6 h-6 object-contain pointer-events-none" />
                              </InteractiveElement>
                              <InteractiveElement elemKey="textPhone" title="نص الهاتف" cfg={config?.shopCard?.textPhone}>
                                <span className="font-mono font-black text-xs text-[#F5D77F]">07701234567</span>
                              </InteractiveElement>
                            </div>
                          </div>

                          {/* زر موقع المحل */}
                          <InteractiveElement
                            elemKey="btnShopLocation"
                            title="زر موقع المحل"
                            cfg={config?.shopCard?.btnShopLocation}
                            className="w-fit"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={config?.shopCard?.btnShopLocation?.imageUrl || "/images/order-luxury/shop-card/btn-shop-location.webp"}
                              alt="موقع المحل"
                              className="h-7 sm:h-8 w-auto object-contain pointer-events-none"
                            />
                          </InteractiveElement>

                          {/* أزرار الاتصال والواتساب */}
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <InteractiveElement elemKey="btnCall" title="زر الاتصال" cfg={config?.shopCard?.btnCall}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={config?.shopCard?.btnCall?.imageUrl || "/images/order-luxury/shop-card/btn-call.webp"}
                                alt="اتصال"
                                className="h-7 sm:h-8 w-auto object-contain pointer-events-none"
                              />
                            </InteractiveElement>
                            <InteractiveElement elemKey="btnWhatsapp" title="زر الواتساب" cfg={config?.shopCard?.btnWhatsapp}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={config?.shopCard?.btnWhatsapp?.imageUrl || "/images/order-luxury/shop-card/btn-whatsapp.webp"}
                                alt="واتساب"
                                className="h-7 sm:h-8 w-auto object-contain pointer-events-none"
                              />
                            </InteractiveElement>
                          </div>
                        </div>

                        {/* الجانب الأيسر (صورة الباب وأزرار الكاميرا) */}
                        <div className="flex flex-col items-center gap-2">
                          <InteractiveElement
                            elemKey="photoContainer"
                            title="إطار صورة باب المحل"
                            cfg={config?.shopCard?.photoContainer}
                            className="w-full"
                          >
                            <div className="w-full aspect-[4/3] rounded-xl border border-amber-500/40 bg-slate-900/80 flex items-center justify-center overflow-hidden">
                              <span className="text-2xl">🚪</span>
                            </div>
                          </InteractiveElement>

                          <div className="grid grid-cols-2 gap-1.5 w-full">
                            <InteractiveElement elemKey="btnCamera" title="زر كاميرا الباب" cfg={config?.shopCard?.btnCamera}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={config?.shopCard?.btnCamera?.imageUrl || "/images/order-luxury/shop-card/btn-camera.webp"}
                                alt="كاميرا"
                                className="h-7 w-auto object-contain pointer-events-none mx-auto"
                              />
                            </InteractiveElement>
                            <InteractiveElement elemKey="btnGallery" title="زر معرض الباب" cfg={config?.shopCard?.btnGallery}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={config?.shopCard?.btnGallery?.imageUrl || "/images/order-luxury/shop-card/btn-gallery.webp"}
                                alt="معرض"
                                className="h-7 w-auto object-contain pointer-events-none mx-auto"
                              />
                            </InteractiveElement>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- كارت الزبون (Customer Card) --- */}
                  {activeCard === "customer_card" && (
                    <div
                      className="relative w-full rounded-[20px] bg-no-repeat bg-[length:100%_100%] shadow-2xl p-3 sm:p-4 min-h-[220px]"
                      style={getCardContainerStyle(
                        config?.customerCard?.frameConfig,
                        config?.customerCard?.frameBgUrl || "/images/order-luxury/customer-card/customer-card-frame.webp"
                      )}
                    >
                      {/* العناصر المخصصة المضافة */}
                      {(config?.customerCard?.customElements || []).map((el) => (
                        <InteractiveElement
                          key={el.id}
                          elemKey={`custom_${el.id}`}
                          title={el.title || "عنصر مخصص"}
                          cfg={el.style}
                          className="absolute z-20"
                        >
                          {el.type === "text" ? (
                            <span className="font-bold text-xs">{el.textContent || "نص مخصص"}</span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={el.imageUrl || "/images/placeholder.png"} alt="صورة" className="h-7 w-auto object-contain" />
                          )}
                        </InteractiveElement>
                      ))}

                      <div className="grid grid-cols-2 gap-2 sm:gap-4 items-start relative z-10">
                        {/* الجانب الأيمن */}
                        <div className="flex flex-col gap-2">
                          <InteractiveElement
                            elemKey="headerCustomerInfo"
                            title="كبسولة عنوان الزبون"
                            cfg={config?.customerCard?.headerCustomerInfo}
                            className="w-fit"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={config?.customerCard?.headerCustomerInfo?.imageUrl || "/images/order-luxury/customer-card/header-customer-info.webp"}
                              alt="الزبون"
                              className="h-8 sm:h-9 w-auto object-contain pointer-events-none"
                            />
                          </InteractiveElement>

                          {/* بيانات الزبون */}
                          <div className="space-y-1.5 py-0.5">
                            {/* اسم الزبون */}
                            <div className="flex items-center gap-1.5">
                              <InteractiveElement elemKey="iconCustomerName" title="أيقونة اسم الزبون" cfg={config?.customerCard?.iconCustomerName}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/images/order-luxury/customer-card/icon-customer-name.webp" alt="" className="w-6 h-6 object-contain pointer-events-none" />
                              </InteractiveElement>
                              <InteractiveElement elemKey="textCustomerName" title="نص اسم الزبون" cfg={config?.customerCard?.textCustomerName}>
                                <span className="font-black text-xs sm:text-sm text-purple-300">سارة علي محمد</span>
                              </InteractiveElement>
                            </div>

                            {/* منطقة الزبون */}
                            <div className="flex items-center gap-1.5">
                              <InteractiveElement elemKey="iconRegion" title="أيقونة المنطقة" cfg={config?.customerCard?.iconRegion}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/images/order-luxury/customer-card/icon-region.webp" alt="" className="w-6 h-6 object-contain pointer-events-none" />
                              </InteractiveElement>
                              <InteractiveElement elemKey="textRegion" title="نص المنطقة" cfg={config?.customerCard?.textRegion}>
                                <span className="font-bold text-xs text-[#FFF8F0]">بغداد - المنصور - شارع 14 رمضان</span>
                              </InteractiveElement>
                            </div>

                            {/* هاتف الزبون */}
                            <div className="flex items-center gap-1.5">
                              <InteractiveElement elemKey="iconPhone" title="أيقونة الهاتف" cfg={config?.customerCard?.iconPhone}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/images/order-luxury/customer-card/icon-phone.webp" alt="" className="w-6 h-6 object-contain pointer-events-none" />
                              </InteractiveElement>
                              <InteractiveElement elemKey="textPhone" title="نص الهاتف" cfg={config?.customerCard?.textPhone}>
                                <span className="font-mono font-black text-xs text-purple-300">07809876543</span>
                              </InteractiveElement>
                            </div>
                          </div>

                          {/* زر موقع الزبون */}
                          <InteractiveElement
                            elemKey="btnLocation"
                            title="زر موقع الزبون"
                            cfg={config?.customerCard?.btnLocation}
                            className="w-fit"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={config?.customerCard?.btnLocation?.imageUrl || "/images/order-luxury/customer-card/btn-location.webp"}
                              alt="موقع الزبون"
                              className="h-7 sm:h-8 w-auto object-contain pointer-events-none"
                            />
                          </InteractiveElement>

                          {/* أزرار الاتصال والواتساب */}
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <InteractiveElement elemKey="btnCall" title="زر الاتصال" cfg={config?.customerCard?.btnCall}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={config?.customerCard?.btnCall?.imageUrl || "/images/order-luxury/customer-card/btn-call.webp"}
                                alt="اتصال"
                                className="h-7 sm:h-8 w-auto object-contain pointer-events-none"
                              />
                            </InteractiveElement>
                            <InteractiveElement elemKey="btnWhatsapp" title="زر الواتساب" cfg={config?.customerCard?.btnWhatsapp}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={config?.customerCard?.btnWhatsapp?.imageUrl || "/images/order-luxury/customer-card/btn-whatsapp.webp"}
                                alt="واتساب"
                                className="h-7 sm:h-8 w-auto object-contain pointer-events-none"
                              />
                            </InteractiveElement>
                          </div>
                        </div>

                        {/* الجانب الأيسر (صورة باب الزبون) */}
                        <div className="flex flex-col items-center gap-2">
                          <InteractiveElement
                            elemKey="photoContainer"
                            title="إطار صورة باب الزبون"
                            cfg={config?.customerCard?.photoContainer}
                            className="w-full"
                          >
                            <div className="w-full aspect-[4/3] rounded-xl border border-purple-500/40 bg-slate-900/80 flex items-center justify-center overflow-hidden">
                              <span className="text-2xl">🏡</span>
                            </div>
                          </InteractiveElement>

                          <div className="grid grid-cols-2 gap-1.5 w-full">
                            <InteractiveElement elemKey="btnCamera" title="زر كاميرا الزبون" cfg={config?.customerCard?.btnCamera}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={config?.customerCard?.btnCamera?.imageUrl || "/images/order-luxury/customer-card/btn-camera.webp"}
                                alt="كاميرا"
                                className="h-7 w-auto object-contain pointer-events-none mx-auto"
                              />
                            </InteractiveElement>
                            <InteractiveElement elemKey="btnGallery" title="زر معرض الزبون" cfg={config?.customerCard?.btnGallery}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={config?.customerCard?.btnGallery?.imageUrl || "/images/order-luxury/customer-card/btn-gallery.webp"}
                                alt="معرض"
                                className="h-7 w-auto object-contain pointer-events-none mx-auto"
                              />
                            </InteractiveElement>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- كارت الطلبية (Order Info Card) --- */}
                  {activeCard === "order_info" && (
                    <div
                      className="relative w-full rounded-[20px] bg-no-repeat bg-[length:100%_100%] shadow-2xl p-3 sm:p-4 min-h-[220px]"
                      style={getCardContainerStyle(
                        config?.orderInfoCard?.frameConfig,
                        config?.orderInfoCard?.frameBgUrl || "/images/order-luxury/order-info-card/order-card-frame.webp"
                      )}
                    >
                      {/* العناصر المخصصة المضافة */}
                      {(config?.orderInfoCard?.customElements || []).map((el) => (
                        <InteractiveElement
                          key={el.id}
                          elemKey={`custom_${el.id}`}
                          title={el.title || "عنصر مخصص"}
                          cfg={el.style}
                          className="absolute z-20"
                        >
                          {el.type === "text" ? (
                            <span className="font-bold text-xs">{el.textContent || "نص مخصص"}</span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={el.imageUrl || "/images/placeholder.png"} alt="صورة" className="h-7 w-auto object-contain" />
                          )}
                        </InteractiveElement>
                      ))}

                      <div className="grid grid-cols-2 gap-2 sm:gap-4 items-start relative z-10">
                        <div className="flex flex-col gap-2">
                          <InteractiveElement elemKey="headerInfo" title="رأس كارت الطلبية" cfg={config?.orderInfoCard?.headerInfo} className="w-fit">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/images/order-luxury/order-info-card/header-order-info.webp" alt="معلومات الطلب" className="h-8 sm:h-9 w-auto object-contain pointer-events-none" />
                          </InteractiveElement>

                          <div className="space-y-1 py-0.5">
                            <div className="flex items-center gap-1.5">
                              <InteractiveElement elemKey="iconOrderBox" title="أيقونة صندوق الطلب" cfg={config?.orderInfoCard?.iconOrderBox}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/images/order-luxury/order-info-card/icon-order-box.webp" alt="" className="w-6 h-6 object-contain pointer-events-none" />
                              </InteractiveElement>
                              <InteractiveElement elemKey="textOrderType" title="نص نوع الطلب" cfg={config?.orderInfoCard?.textOrderType}>
                                <span className="font-black text-xs text-amber-300">طلب عادي (شحنة ملابس)</span>
                              </InteractiveElement>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <InteractiveElement elemKey="iconClock" title="أيقونة التوقيت" cfg={config?.orderInfoCard?.iconClock}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/images/order-luxury/order-info-card/icon-clock.webp" alt="" className="w-6 h-6 object-contain pointer-events-none" />
                              </InteractiveElement>
                              <InteractiveElement elemKey="textOrderTime" title="نص وقت الطلب" cfg={config?.orderInfoCard?.textOrderTime}>
                                <span className="font-bold text-xs text-slate-300">اليوم - 04:30 مساءً</span>
                              </InteractiveElement>
                            </div>
                          </div>

                          {/* الحسابات والأسعار */}
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <InteractiveElement elemKey="blockSubtotal" title="بلوك سعر المواد" cfg={config?.orderInfoCard?.blockSubtotal}>
                              <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-1.5 text-center">
                                <span className="text-[10px] text-slate-400 block">سعر المواد</span>
                                <span className="text-xs font-black text-emerald-400">45,000 د.ع</span>
                              </div>
                            </InteractiveElement>
                            <InteractiveElement elemKey="blockDelivery" title="بلوك التوصيل" cfg={config?.orderInfoCard?.blockDelivery}>
                              <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-1.5 text-center">
                                <span className="text-[10px] text-slate-400 block">التوصيل</span>
                                <span className="text-xs font-black text-amber-400">5,000 د.ع</span>
                              </div>
                            </InteractiveElement>
                          </div>

                          <InteractiveElement elemKey="blockTotal" title="المبلغ الكلي النهائي" cfg={config?.orderInfoCard?.blockTotal} className="w-full">
                            <div className="bg-gradient-to-r from-amber-600/30 to-amber-500/20 border border-amber-500/50 rounded-xl p-2 text-center">
                              <span className="text-[10px] text-amber-300 font-bold block">المبلغ الكلي المطلوب</span>
                              <span className="text-sm sm:text-base font-black text-amber-300">50,000 د.ع</span>
                            </div>
                          </InteractiveElement>
                        </div>

                        {/* صورة الطلبية السريعة */}
                        <div className="flex flex-col items-center gap-2">
                          <InteractiveElement elemKey="photoContainer" title="إطار صورة الطلبية" cfg={config?.orderInfoCard?.photoContainer} className="w-full">
                            <div className="w-full aspect-[4/3] rounded-xl border border-amber-500/40 bg-slate-900/80 flex items-center justify-center overflow-hidden">
                              <span className="text-2xl">📦</span>
                            </div>
                          </InteractiveElement>
                          <div className="grid grid-cols-2 gap-1.5 w-full">
                            <InteractiveElement elemKey="btnCamera" title="زر كاميرا الطلبية" cfg={config?.orderInfoCard?.btnCamera}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/images/order-luxury/order-info-card/btn-camera.webp" alt="كاميرا" className="h-7 w-auto object-contain pointer-events-none mx-auto" />
                            </InteractiveElement>
                            <InteractiveElement elemKey="btnGallery" title="زر معرض الطلبية" cfg={config?.orderInfoCard?.btnGallery}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/images/order-luxury/order-info-card/btn-gallery.webp" alt="معرض" className="h-7 w-auto object-contain pointer-events-none mx-auto" />
                            </InteractiveElement>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* --- كارت حركة الأموال (Money Flow Card) --- */}
                  {activeCard === "money_flow" && (
                    <div
                      className="relative w-full rounded-[20px] bg-no-repeat bg-[length:100%_100%] shadow-2xl p-3 sm:p-4 min-h-[180px]"
                      style={getCardContainerStyle(
                        config?.moneyFlowCard?.frameConfig,
                        config?.moneyFlowCard?.frameBgUrl || "/images/order-luxury/money-card/money-card-frame.webp"
                      )}
                    >
                      {/* العناصر المخصصة المضافة */}
                      {(config?.moneyFlowCard?.customElements || []).map((el) => (
                        <InteractiveElement
                          key={el.id}
                          elemKey={`custom_${el.id}`}
                          title={el.title || "عنصر مخصص"}
                          cfg={el.style}
                          className="absolute z-20"
                        >
                          {el.type === "text" ? (
                            <span className="font-bold text-xs">{el.textContent || "نص مخصص"}</span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={el.imageUrl || "/images/placeholder.png"} alt="صورة" className="h-7 w-auto object-contain" />
                          )}
                        </InteractiveElement>
                      ))}

                      <div className="flex flex-col gap-3 relative z-10">
                        <div className="flex items-center justify-around gap-2">
                          <InteractiveElement elemKey="badgeSader" title="شارة الصادر" cfg={config?.moneyFlowCard?.badgeSader}>
                            <div className="px-3 py-1 bg-rose-600/30 border border-rose-500/60 rounded-xl text-rose-300 text-xs font-black">
                              📤 الصادر (تسليم للمحل): 45,000 د.ع
                            </div>
                          </InteractiveElement>
                          <InteractiveElement elemKey="badgeWard" title="شارة الوارد" cfg={config?.moneyFlowCard?.badgeWard}>
                            <div className="px-3 py-1 bg-emerald-600/30 border border-emerald-500/60 rounded-xl text-emerald-300 text-xs font-black">
                              📥 الوارد (استلام من الزبون): 50,000 د.ع
                            </div>
                          </InteractiveElement>
                        </div>

                        {/* أزرار الإجراء */}
                        <div className="grid grid-cols-2 gap-2">
                          <InteractiveElement elemKey="btnSaderAction" title="زر تسليم صادر" cfg={config?.moneyFlowCard?.btnSaderAction}>
                            <button type="button" className="w-full py-2 bg-gradient-to-r from-rose-600 to-rose-700 text-white font-black text-xs rounded-xl shadow">
                              📤 تأكيد تسليم الصادر للمحل
                            </button>
                          </InteractiveElement>
                          <InteractiveElement elemKey="btnWardAction" title="زر استلام وارد" cfg={config?.moneyFlowCard?.btnWardAction}>
                            <button type="button" className="w-full py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-black text-xs rounded-xl shadow">
                              📥 تأكيد استلام الوارد من الزبون
                            </button>
                          </InteractiveElement>
                        </div>

                        {/* كارت السجل */}
                        <InteractiveElement elemKey="recordItemCard" title="كارت السجل المالي" cfg={config?.moneyFlowCard?.recordItemCard}>
                          <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-2 text-center text-xs text-slate-300 font-bold">
                            📄 حركة مسجلة: تم استلام 50,000 د.ع بنجاح
                          </div>
                        </InteractiveElement>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* ================= 2. لوحة التحكم المباشرة بالعنصر المحدد (Live Control Panel) ================= */}
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-3 sm:p-4 space-y-4">
                
                {/* رأس لوحة التحكم: العنصر النشط + القائمة السريعة + إخفاء/إظهار */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-black text-xs sm:text-sm">🎯 العنصر المحدد حالياً:</span>
                    <select
                      value={selectedElementKey}
                      onChange={(e) => setSelectedElementKey(e.target.value)}
                      className="bg-slate-900 border border-amber-500/40 text-amber-300 font-black text-xs sm:text-sm rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-amber-400"
                    >
                      {elementsList.map((i) => (
                        <option key={i.key} value={i.key}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateSelectedElementField("hidden", !selectedStyle.hidden)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                        selectedStyle.hidden
                          ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                          : "bg-emerald-600/80 text-white hover:bg-emerald-600"
                      }`}
                    >
                      <span>{selectedStyle.hidden ? "👁️ مخفي (إظهار)" : "👁️ ظاهر (إخفاء)"}</span>
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
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                      title="إعادة ضبط الحجم والموضع الافتراضي"
                    >
                      🔄 ضبط افتراضي
                    </button>
                  </div>
                </div>

                {/* شبكة الأدوات التفاعلية: التحريك D-Pad + التكبير الأفقي/العمودي + التدوير والألوان */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  
                  {/* --- لوحة 1: أزرار التحريك D-Pad والموقع --- */}
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col items-center justify-between">
                    <div className="w-full flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-amber-300">🕹️ تحريك الموقع (X / Y)</span>
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

                    {/* D-Pad Buttons */}
                    <div className="flex flex-col items-center gap-1.5 my-1">
                      <button
                        type="button"
                        onClick={() => handleShift(0, -moveStep)}
                        className="w-14 h-10 bg-slate-800 hover:bg-amber-500 hover:text-black text-white font-black rounded-xl active:scale-90 transition shadow-md flex items-center justify-center text-base"
                        title="تحريك لأعلى"
                      >
                        ▲
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleShift(moveStep, 0)}
                          className="w-14 h-10 bg-slate-800 hover:bg-amber-500 hover:text-black text-white font-black rounded-xl active:scale-90 transition shadow-md flex items-center justify-center text-base"
                          title="تحريك لليمين"
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          onClick={handleResetPosition}
                          className="w-10 h-10 bg-slate-900 border border-amber-500/40 text-amber-300 text-xs font-black rounded-xl active:scale-90 transition shadow-md flex items-center justify-center"
                          title="إعادة للمركز (0, 0)"
                        >
                          🎯
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShift(-moveStep, 0)}
                          className="w-14 h-10 bg-slate-800 hover:bg-amber-500 hover:text-black text-white font-black rounded-xl active:scale-90 transition shadow-md flex items-center justify-center text-base"
                          title="تحريك لليسار"
                        >
                          ◀
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleShift(0, moveStep)}
                        className="w-14 h-10 bg-slate-800 hover:bg-amber-500 hover:text-black text-white font-black rounded-xl active:scale-90 transition shadow-md flex items-center justify-center text-base"
                        title="تحريك لأسفل"
                      >
                        ▼
                      </button>
                    </div>

                    <div className="w-full flex items-center justify-around mt-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-300">
                      <span>X (أفقي): <strong className="text-amber-400">{selectedStyle.offsetX || 0}px</strong></span>
                      <span>Y (عمودي): <strong className="text-amber-400">{selectedStyle.offsetY || 0}px</strong></span>
                    </div>
                  </div>

                  {/* --- لوحة 2: التكبير الأفقي والتكبير العمودي والتكبير الكلي --- */}
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2.5">
                    <span className="text-xs font-black text-amber-300 block">📐 التكبير والتصغير والمقاسات</span>

                    {/* 1. التكبير الأفقي (ScaleX / العرض) */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1">
                        <span>↔️ التكبير الأفقي (العرض):</span>
                        <span className="font-mono text-amber-400">{Math.round((selectedStyle.scaleX ?? 1) * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustScaleX(-0.05)}
                          className="w-7 h-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded text-xs"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="0.2"
                          max="2.5"
                          step="0.05"
                          value={selectedStyle.scaleX ?? 1}
                          onChange={(e) => updateSelectedElementField("scaleX", parseFloat(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => adjustScaleX(0.05)}
                          className="w-7 h-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* 2. التكبير العمودي (ScaleY / الارتفاع) */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1">
                        <span>↕️ التكبير العمودي (الارتفاع):</span>
                        <span className="font-mono text-amber-400">{Math.round((selectedStyle.scaleY ?? 1) * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustScaleY(-0.05)}
                          className="w-7 h-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded text-xs"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="0.2"
                          max="2.5"
                          step="0.05"
                          value={selectedStyle.scaleY ?? 1}
                          onChange={(e) => updateSelectedElementField("scaleY", parseFloat(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => adjustScaleY(0.05)}
                          className="w-7 h-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* 3. التكبير الكلي المتناسق (Scale) */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1">
                        <span>🔍 الحجم الكلي العام:</span>
                        <span className="font-mono text-amber-400">{Math.round((selectedStyle.scale ?? 1) * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustScale(-0.05)}
                          className="w-7 h-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded text-xs"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="0.3"
                          max="2.5"
                          step="0.05"
                          value={selectedStyle.scale ?? 1}
                          onChange={(e) => updateSelectedElementField("scale", parseFloat(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => adjustScale(0.05)}
                          className="w-7 h-6 bg-slate-800 hover:bg-slate-700 text-white font-black rounded text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* --- لوحة 3: التدوير واللون والظل --- */}
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2.5">
                    <span className="text-xs font-black text-amber-300 block">🔄 التدوير والألوان والظلال</span>

                    {/* التدوير السلس والأزرار السريعة */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1">
                        <span>🔄 زاوية التدوير:</span>
                        <span className="font-mono text-amber-400">{selectedStyle.rotate || 0}°</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustRotate(-5)}
                          className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded text-[10px]"
                        >
                          -5°
                        </button>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="1"
                          value={selectedStyle.rotate ?? 0}
                          onChange={(e) => updateSelectedElementField("rotate", parseInt(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => adjustRotate(5)}
                          className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded text-[10px]"
                        >
                          +5°
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-1.5">
                        <button
                          type="button"
                          onClick={() => updateSelectedElementField("rotate", 0)}
                          className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-white rounded"
                        >
                          0° استقامة
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelectedElementField("rotate", 90)}
                          className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-white rounded"
                        >
                          90° عمودي
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelectedElementField("rotate", 180)}
                          className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-white rounded"
                        >
                          180° مقلوب
                        </button>
                      </div>
                    </div>

                    {/* اللون والظل */}
                    <div className="pt-1 space-y-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-300">لون النص / الأيقونة:</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={selectedStyle.color || "#ffffff"}
                            onChange={(e) => updateSelectedElementField("color", e.target.value)}
                            className="w-20 bg-slate-900 border border-slate-700 text-[10px] font-mono text-center rounded px-1 py-0.5 text-white"
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
                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedStyle.hasShadow ?? false}
                            onChange={(e) => updateSelectedElementField("hasShadow", e.target.checked)}
                            className="accent-amber-500 h-4 w-4 rounded"
                          />
                          <span>تشغيل ظل أنيق</span>
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
                        <option value="url">🌐 فتح رابط موقع (URL)</option>
                        <option value="call">📞 اتصال برقم هاتف</option>
                        <option value="whatsapp">💬 فتح محادثة واتساب</option>
                        <option value="map">📍 فتح لوكيشن في الخرائط</option>
                        <option value="copy">📋 نسخ نص للحافظة</option>
                        <option value="image_zoom">🔍 تكبير الصورة</option>
                        <option value="alert_modal">⚠️ إظهار تنبيه ورسالة منبثقة</option>
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
        <div className="flex items-center justify-between gap-3 p-3 sm:p-4 bg-slate-950/90 border-t border-slate-800 shrink-0">
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
