"use client";

import React, { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  OrderCardDesignerConfig,
  CustomElementConfig,
} from "@/lib/order-card-customizer";
import { updateOrderCardsDesignerAction } from "./actions";

type Props = {
  initialConfig: OrderCardDesignerConfig;
  waButtons: any[];
};

type TabType = "shop_card" | "customer_card" | "wa_buttons";

export function OrderCardsDesignerClient({ initialConfig, waButtons }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("shop_card");
  const [config, setConfig] = useState<OrderCardDesignerConfig>(initialConfig);
  const [isPending, startTransition] = useTransition();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // مرجع الرفع الخفي
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadCallbackRef = useRef<((url: string) => void) | null>(null);

  // دالة رفع الصور والتحويل التلقائي لـ WEBP
  const triggerImageUpload = (onUploaded: (url: string) => void) => {
    uploadCallbackRef.current = onUploaded;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingKey("uploading");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", "designer-assets");

    try {
      const res = await fetch("/api/abo1stor3hlaa2kbr8-47/settings/upload-luxury-asset", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.ok && data.url) {
        if (uploadCallbackRef.current) {
          uploadCallbackRef.current(data.url);
        }
      } else {
        alert(data.error || "فشل رفع الصورة.");
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء رفع الصورة: " + err.message);
    } finally {
      setUploadingKey(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // دوال تعديل إعدادات كارت المحل
  const updateShopElement = (
    key: keyof OrderCardDesignerConfig["shopCard"],
    field: keyof CustomElementConfig,
    value: any
  ) => {
    setConfig((prev) => {
      const currentElem = (prev.shopCard[key] as CustomElementConfig) || {};
      return {
        ...prev,
        shopCard: {
          ...prev.shopCard,
          [key]: {
            ...currentElem,
            [field]: value,
          },
        },
      };
    });
  };

  // دوال تعديل إعدادات كارت الزبون
  const updateCustomerElement = (
    key: keyof OrderCardDesignerConfig["customerCard"],
    field: keyof CustomElementConfig,
    value: any
  ) => {
    setConfig((prev) => {
      const currentElem = (prev.customerCard[key] as CustomElementConfig) || {};
      return {
        ...prev,
        customerCard: {
          ...prev.customerCard,
          [key]: {
            ...currentElem,
            [field]: value,
          },
        },
      };
    });
  };

  // دوال تعديل أزرار الواتساب
  const updateWaButtonConfig = (
    btnId: string,
    field: keyof CustomElementConfig,
    value: any
  ) => {
    setConfig((prev) => {
      const current = prev.waButtonsConfig?.[btnId] || {};
      return {
        ...prev,
        waButtonsConfig: {
          ...prev.waButtonsConfig,
          [btnId]: {
            ...current,
            [field]: value,
          },
        },
      };
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateOrderCardsDesignerAction(config);
      if (res.ok) {
        alert("✅ تم حفظ كافة تعديلات التصميم والتخصيص بنجاح!");
        router.refresh();
      } else {
        alert("❌ حدث خطأ: " + res.error);
      }
    });
  };

  return (
    <div className="space-y-6 text-[#FFF8F0] select-none" dir="rtl">
      {/* المدخل المخفي لرفع الصور */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only hidden"
        onChange={handleFileChange}
      />

      {/* الرأس الملكي للصفحة */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] p-4 sm:p-6 rounded-[22px] border-2 border-[#C9A86A] shadow-2xl">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-[#F5D77F] flex items-center gap-2">
            <span>🎨</span> استوديو تصميم كروت الطلبات والأزرار الملكية
          </h1>
          <p className="text-xs sm:text-sm text-emerald-200 mt-1 font-bold">
            قص الفراغات الزائدة تلقائياً ✂️، تحويل فوري لـ WEBP ⚡، تصغير الحجم، وتحريك وتكبير الأزرار يمنة ويسرة مع التكييش الفوري.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || uploadingKey !== null}
          className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl font-black text-sm shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#FFF8F0]/40"
        >
          {isPending ? "⏳ جاري الحفظ..." : "💾 حفظ كافة التعديلات"}
        </button>
      </div>

      {uploadingKey && (
        <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-3 text-center text-xs font-bold text-amber-300 animate-pulse">
          ⏳ جاري قص الفراغات والشفافية المحيطة تلقائياً ✂️، وضغط وتحويل الصورة إلى صيغة WEBP ورفعها للسيرفر...
        </div>
      )}

      {/* التبويبات الرئيسية */}
      <div className="flex items-center gap-2 border-b border-[#C9A86A]/40 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("shop_card")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "shop_card"
              ? "bg-[#C9A86A] text-[#06281D] shadow-lg scale-105"
              : "bg-[#0A3D2E] text-[#F5D77F] hover:bg-[#0F4D3A]"
          }`}
        >
          🏬 كارت المحل (المرسل)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("customer_card")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "customer_card"
              ? "bg-[#C9A86A] text-[#06281D] shadow-lg scale-105"
              : "bg-[#0A3D2E] text-[#F5D77F] hover:bg-[#0F4D3A]"
          }`}
        >
          👤 كارت الزبون (المستلم)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("wa_buttons")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "wa_buttons"
              ? "bg-[#C9A86A] text-[#06281D] shadow-lg scale-105"
              : "bg-[#0A3D2E] text-[#F5D77F] hover:bg-[#0F4D3A]"
          }`}
        >
          💬 أزرار الواتساب المخصصة ({waButtons.length})
        </button>
      </div>

      {/* محتوى التبويب 1: كارت المحل (المرسل) */}
      {activeTab === "shop_card" && (
        <div className="space-y-6">
          {/* قسم إطار وخلفية الكارت */}
          <div className="bg-[#0A3D2E]/90 border border-[#C9A86A]/60 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
            <h3 className="text-sm sm:text-base font-black text-[#F5D77F] flex items-center gap-2">
              <span>🖼️</span> خلفية وإطار كارت المحل
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-48 h-24 rounded-xl border border-[#C9A86A] overflow-hidden bg-black/40 flex items-center justify-center p-2 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.shopCard.frameBgUrl || "/images/order-luxury/shop-card/shop-card-frame.webp"}
                  alt="إطار المحل"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="flex-1 space-y-2 w-full">
                <button
                  type="button"
                  onClick={() =>
                    triggerImageUpload((url) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopCard: { ...prev.shopCard, frameBgUrl: url },
                      }))
                    )
                  }
                  className="px-4 py-2 bg-[#0F4D3A] text-[#F5D77F] border border-[#C9A86A] rounded-xl text-xs font-black shadow hover:scale-105 transition cursor-pointer"
                >
                  📤 رفع إطار جديد (تحويل فوري لـ WEBP)
                </button>
                <p className="text-[11px] text-emerald-300">
                  يمكنك رفع أي صورة إطار بصيغة PNG أو JPG أو WEBP وسيتم تحويلها لـ WEBP وضغطها تلقائياً.
                </p>
              </div>
            </div>
          </div>

          {/* قائمة عناصر وأزرار كارت المحل */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. كبسولة عنوان المحل */}
            <ElementControlCard
              title="كبسولة عنوان: المحل (المرسل)"
              defaultImg="/images/order-luxury/shop-card/header-shop-info.webp"
              config={config.shopCard.headerShopInfo}
              onChange={(field, val) => updateShopElement("headerShopInfo", field, val)}
              onUploadImg={() =>
                triggerImageUpload((url) => updateShopElement("headerShopInfo", "imageUrl", url))
              }
            />

            {/* 2. كبسولة عنوان صورة المحل */}
            <ElementControlCard
              title="كبسولة عنوان: صورة المحل"
              defaultImg="/images/order-luxury/shop-card/header-shop-photo.webp"
              config={config.shopCard.headerShopPhoto}
              onChange={(field, val) => updateShopElement("headerShopPhoto", field, val)}
              onUploadImg={() =>
                triggerImageUpload((url) => updateShopElement("headerShopPhoto", "imageUrl", url))
              }
            />

            {/* 3. مربع وبديل صورة المحل */}
            <ElementControlCard
              title="مربع صورة المحل / لا توجد صورة"
              defaultImg="/images/order-luxury/shop-card/placeholder-no-photo.webp"
              config={config.shopCard.placeholderNoPhoto}
              onChange={(field, val) => updateShopElement("placeholderNoPhoto", field, val)}
              onUploadImg={() =>
                triggerImageUpload((url) => updateShopElement("placeholderNoPhoto", "imageUrl", url))
              }
            />

            {/* 4. زر موقع المحل */}
            <ElementControlCard
              title="زر موقع المحل على الخريطة"
              defaultImg="/images/order-luxury/shop-card/btn-shop-location.webp"
              config={config.shopCard.btnShopLocation}
              onChange={(field, val) => updateShopElement("btnShopLocation", field, val)}
              onUploadImg={() =>
                triggerImageUpload((url) => updateShopElement("btnShopLocation", "imageUrl", url))
              }
            />

            {/* 5. زر الاتصال الهاتفي */}
            <ElementControlCard
              title="زر الاتصال الهاتفي (اتصال)"
              defaultImg="/images/order-luxury/shop-card/btn-call.webp"
              config={config.shopCard.btnCall}
              onChange={(field, val) => updateShopElement("btnCall", field, val)}
              onUploadImg={() =>
                triggerImageUpload((url) => updateShopElement("btnCall", "imageUrl", url))
              }
            />

            {/* 6. زر الواتساب */}
            <ElementControlCard
              title="زر الواتساب (واتس اب)"
              defaultImg="/images/order-luxury/shop-card/btn-whatsapp.webp"
              config={config.shopCard.btnWhatsapp}
              onChange={(field, val) => updateShopElement("btnWhatsapp", field, val)}
              onUploadImg={() =>
                triggerImageUpload((url) => updateShopElement("btnWhatsapp", "imageUrl", url))
              }
            />

            {/* 7. زر الكاميرا */}
            <ElementControlCard
              title="زر التقاط الصورة (كاميرا)"
              defaultImg="/images/order-luxury/shop-card/btn-camera.webp"
              config={config.shopCard.btnCamera}
              onChange={(field, val) => updateShopElement("btnCamera", field, val)}
              onUploadImg={() =>
                triggerImageUpload((url) => updateShopElement("btnCamera", "imageUrl", url))
              }
            />

            {/* 8. زر المعرض */}
            <ElementControlCard
              title="زر اختيار الصورة (معرض)"
              defaultImg="/images/order-luxury/shop-card/btn-gallery.webp"
              config={config.shopCard.btnGallery}
              onChange={(field, val) => updateShopElement("btnGallery", field, val)}
              onUploadImg={() =>
                triggerImageUpload((url) => updateShopElement("btnGallery", "imageUrl", url))
              }
            />
          </div>
        </div>
      )}

      {/* محتوى التبويب 2: كارت الزبون (المستلم) */}
      {activeTab === "customer_card" && (
        <div className="space-y-6">
          <div className="bg-[#0A3D2E]/90 border border-[#C9A86A]/60 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
            <h3 className="text-sm sm:text-base font-black text-[#F5D77F] flex items-center gap-2">
              <span>🖼️</span> إطار وخلفية كارت الزبون
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-48 h-24 rounded-xl border border-[#C9A86A] overflow-hidden bg-black/40 flex items-center justify-center p-2">
                {config.customerCard.frameBgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={config.customerCard.frameBgUrl}
                    alt="إطار الزبون"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-amber-200">الخلفية الافتراضية للزبون</span>
                )}
              </div>
              <div className="flex-1 space-y-2 w-full">
                <button
                  type="button"
                  onClick={() =>
                    triggerImageUpload((url) =>
                      setConfig((prev) => ({
                        ...prev,
                        customerCard: { ...prev.customerCard, frameBgUrl: url },
                      }))
                    )
                  }
                  className="px-4 py-2 bg-[#0F4D3A] text-[#F5D77F] border border-[#C9A86A] rounded-xl text-xs font-black shadow hover:scale-105 transition cursor-pointer"
                >
                  📤 رفع إطار جديد لكارت الزبون (WEBP)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ElementControlCard
              title="زر موقع الزبون على الخريطة"
              defaultImg=""
              config={config.customerCard.btnLocation}
              onChange={(field, val) => updateCustomerElement("btnLocation", field, val)}
              onUploadImg={() =>
                triggerImageUpload((url) => updateCustomerElement("btnLocation", "imageUrl", url))
              }
            />

            <ElementControlCard
              title="زر اتصال الزبون"
              defaultImg=""
              config={config.customerCard.btnCall}
              onChange={(field, val) => updateCustomerElement("btnCall", field, val)}
              onUploadImg={() =>
                triggerImageUpload((url) => updateCustomerElement("btnCall", "imageUrl", url))
              }
            />
          </div>
        </div>
      )}

      {/* محتوى التبويب 3: أزرار الواتساب المخصصة */}
      {activeTab === "wa_buttons" && (
        <div className="space-y-4">
          <div className="bg-[#0A3D2E]/90 border border-[#C9A86A]/60 rounded-2xl p-4 text-xs font-bold text-emerald-200">
            💡 يمكنك تخصيص صورة مخصصة لكل زر واتساب وتكبيره أو تعريضه وتحريكه وتحديد ظهوره عند (الإدارة فقط، أو الإدارة والمندوب، أو الجميع).
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {waButtons.map((btn) => {
              const btnCustom = config.waButtonsConfig?.[btn.id] || {};
              return (
                <div
                  key={btn.id}
                  className="bg-[#0A3D2E]/90 border border-[#C9A86A]/60 rounded-2xl p-4 shadow-xl space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{btn.iconKey || "💬"}</span>
                      <h4 className="font-black text-sm text-[#F5D77F]">{btn.label}</h4>
                    </div>
                    <span className="text-[11px] text-amber-300 bg-black/40 px-2 py-0.5 rounded-md">
                      {btn.recipient === "shop" ? "للمحل" : "للزبون"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-16 h-12 rounded-xl border border-[#C9A86A]/60 bg-black/30 flex items-center justify-center overflow-hidden shrink-0">
                      {btnCustom.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={btnCustom.imageUrl}
                          alt={btn.label}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-white/50">افتراضي</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        triggerImageUpload((url) =>
                          updateWaButtonConfig(btn.id, "imageUrl", url)
                        )
                      }
                      className="px-3 py-1 bg-[#0F4D3A] text-[#F5D77F] border border-[#C9A86A] rounded-lg text-xs font-bold hover:scale-105 transition cursor-pointer"
                    >
                      📤 رفع صورة (WEBP)
                    </button>
                    {btnCustom.imageUrl && (
                      <button
                        type="button"
                        onClick={() => updateWaButtonConfig(btn.id, "imageUrl", "")}
                        className="text-xs text-rose-300 hover:text-rose-200 underline cursor-pointer"
                      >
                        إلغاء الصورة
                      </button>
                    )}
                  </div>

                  {/* أشرطة التحكم: الحجم والإزاحة */}
                  <div className="space-y-2 pt-2 border-t border-[#C9A86A]/20">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#F5D77F]">🔍 الحجم والتكبير:</span>
                      <span className="font-mono text-emerald-300">
                        {Math.round((btnCustom.scale ?? 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.05"
                      value={btnCustom.scale ?? 1}
                      onChange={(e) =>
                        updateWaButtonConfig(btn.id, "scale", parseFloat(e.target.value))
                      }
                      className="w-full accent-[#C9A86A] cursor-pointer"
                    />

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-[#F5D77F]">↔️ إزاحة يمين / يسار (X):</span>
                      <span className="font-mono text-emerald-300">
                        {btnCustom.offsetX ?? 0}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="1"
                      value={btnCustom.offsetX ?? 0}
                      onChange={(e) =>
                        updateWaButtonConfig(btn.id, "offsetX", parseInt(e.target.value))
                      }
                      className="w-full accent-[#C9A86A] cursor-pointer"
                    />

                    {/* نطاق الظهور */}
                    <div className="pt-2">
                      <label className="text-xs text-[#F5D77F] block mb-1">
                        👁️ نطاق الظهور:
                      </label>
                      <select
                        value={btnCustom.visibility || "all"}
                        onChange={(e) =>
                          updateWaButtonConfig(btn.id, "visibility", e.target.value)
                        }
                        className="w-full bg-[#06281D] border border-[#C9A86A] rounded-lg text-xs p-1.5 text-white"
                      >
                        <option value="all">الكل (إدارة ومندوب ومجهز)</option>
                        <option value="admin">الإدارة فقط</option>
                        <option value="admin_mandoub">الإدارة والمندوب</option>
                        <option value="admin_mandoub_preparer">الإدارة والمندوب والمجهز</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// كارت التحكم بالعنصر المنفرد (أشرطة التكبير والإزاحة ورفع الصورة)
function ElementControlCard({
  title,
  defaultImg,
  config,
  onChange,
  onUploadImg,
}: {
  title: string;
  defaultImg?: string;
  config?: CustomElementConfig;
  onChange: (field: keyof CustomElementConfig, val: any) => void;
  onUploadImg: () => void;
}) {
  const currentImg = config?.imageUrl || defaultImg;
  const currentScale = config?.scale ?? 1;
  const currentOffsetX = config?.offsetX ?? 0;
  const currentOffsetY = config?.offsetY ?? 0;

  return (
    <div className="bg-[#0A3D2E]/90 border border-[#C9A86A]/60 rounded-2xl p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
        <h4 className="font-black text-xs sm:text-sm text-[#F5D77F]">{title}</h4>
        {config?.imageUrl && (
          <button
            type="button"
            onClick={() => onChange("imageUrl", "")}
            className="text-[10px] text-rose-300 hover:text-rose-200 underline cursor-pointer"
          >
            استعادة الصورة الأصلية
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="w-16 h-14 rounded-xl border border-[#C9A86A]/60 bg-black/40 flex items-center justify-center overflow-hidden shrink-0 p-1">
          {currentImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentImg}
              alt={title}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-[10px] text-white/50">أصلي</span>
          )}
        </div>

        <div className="flex-1 space-y-1">
          <button
            type="button"
            onClick={onUploadImg}
            className="px-3 py-1.5 bg-[#0F4D3A] text-[#F5D77F] border border-[#C9A86A] rounded-xl text-xs font-bold hover:scale-105 transition cursor-pointer"
          >
            📤 رفع صورة جديدة (WEBP)
          </button>
        </div>
      </div>

      {/* أشرطة التحكم: الحجم، إزاحة أفقية، إزاحة رأسية */}
      <div className="space-y-2 pt-2 border-t border-[#C9A86A]/20">
        {/* شريط الحجم */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F5D77F]">🔍 الحجم والتكبير:</span>
            <span className="font-mono text-emerald-300 font-bold">
              {Math.round(currentScale * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.05"
            value={currentScale}
            onChange={(e) => onChange("scale", parseFloat(e.target.value))}
            className="w-full accent-[#C9A86A] cursor-pointer"
          />
        </div>

        {/* شريط الإزاحة الأفقية X */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F5D77F]">↔️ إزاحة يمين / يسار (X):</span>
            <span className="font-mono text-emerald-300 font-bold">
              {currentOffsetX > 0 ? `+${currentOffsetX}px (يمين)` : currentOffsetX < 0 ? `${currentOffsetX}px (يسار)` : "0px"}
            </span>
          </div>
          <input
            type="range"
            min="-60"
            max="60"
            step="1"
            value={currentOffsetX}
            onChange={(e) => onChange("offsetX", parseInt(e.target.value))}
            className="w-full accent-[#C9A86A] cursor-pointer"
          />
        </div>

        {/* شريط الإزاحة الرأسية Y */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F5D77F]">↕️ إزاحة أعلى / أسفل (Y):</span>
            <span className="font-mono text-emerald-300 font-bold">
              {currentOffsetY > 0 ? `+${currentOffsetY}px (أسفل)` : currentOffsetY < 0 ? `${currentOffsetY}px (أعلى)` : "0px"}
            </span>
          </div>
          <input
            type="range"
            min="-60"
            max="60"
            step="1"
            value={currentOffsetY}
            onChange={(e) => onChange("offsetY", parseInt(e.target.value))}
            className="w-full accent-[#C9A86A] cursor-pointer"
          />
        </div>

        {/* نطاق الظهور */}
        <div className="pt-1">
          <label className="text-xs text-[#F5D77F] block mb-1">
            👁️ نطاق الظهور:
          </label>
          <select
            value={config?.visibility || "all"}
            onChange={(e) => onChange("visibility", e.target.value)}
            className="w-full bg-[#06281D] border border-[#C9A86A] rounded-lg text-xs p-1.5 text-white"
          >
            <option value="all">الكل (إدارة ومندوب ومجهز)</option>
            <option value="admin">الإدارة فقط</option>
            <option value="admin_mandoub">الإدارة والمندوب</option>
            <option value="admin_mandoub_preparer">الإدارة والمندوب والمجهز</option>
          </select>
        </div>
      </div>
    </div>
  );
}
