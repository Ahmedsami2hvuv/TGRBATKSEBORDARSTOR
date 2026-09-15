"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  OrderCardDesignerConfig,
  CustomElementConfig,
  getElementStyle,
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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("saved");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // مراجع للتحكم بالحفظ التلقائي
  const isFirstMount = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadCallbackRef = useRef<((url: string) => void) | null>(null);

  // دالة الحفظ الفعلي بالسيرفر
  const performSave = useCallback(async (currentConfig: OrderCardDesignerConfig) => {
    setSaveStatus("saving");
    try {
      const res = await updateOrderCardsDesignerAction(currentConfig);
      if (res.ok) {
        setSaveStatus("saved");
      } else {
        console.error("Auto-save error:", res.error);
        setSaveStatus("error");
      }
    } catch (err) {
      console.error("Auto-save exception:", err);
      setSaveStatus("error");
    }
  }, []);

  // تشغيل الحفظ التلقائي عند أي تغيير في config
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    setSaveStatus("saving");
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      void performSave(config);
    }, 450); // 450 ميلي ثانية بعد توقف المستخدم عن السحب

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [config, performSave]);

  // دالة رفع الصور والتحويل التلقائي لـ WEBP مع الحفظ التلقائي
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

  const shopCustom = config.shopCard;
  const frameBg = shopCustom?.frameBgUrl || "/images/order-luxury/shop-card/shop-card-frame.webp";

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

      {/* الرأس الملكي للصفحة مع مؤشر الحفظ التلقائي */}
      <div className="sticky top-2 z-30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] p-4 sm:p-5 rounded-[22px] border-2 border-[#C9A86A] shadow-2xl backdrop-blur-md">
        <div>
          <h1 className="text-base sm:text-xl font-black text-[#F5D77F] flex items-center gap-2">
            <span>🎨</span> استوديو تصميم كروت الطلبات والأزرار الملكية
          </h1>
          <p className="text-[11px] sm:text-xs text-emerald-200 mt-0.5 font-bold">
            قص الفراغات والشفافية المحيطة تلقائياً ✂️، تحويل فوري لـ WEBP ⚡، تكبير وحجم حر بجميع الاتجاهات، وحفظ تلقائي فوري 💾.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {saveStatus === "saving" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 border border-amber-400 text-amber-300 rounded-xl text-xs font-black animate-pulse">
              <span className="animate-spin">🔄</span> جاري الحفظ تلقائياً...
            </div>
          )}
          {saveStatus === "saved" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700/30 border border-emerald-400 text-emerald-300 rounded-xl text-xs font-black shadow-sm">
              <span>✅</span> تم الحفظ تلقائياً
            </div>
          )}
          {saveStatus === "error" && (
            <button
              type="button"
              onClick={() => void performSave(config)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-700/40 border border-rose-400 text-rose-300 rounded-xl text-xs font-black cursor-pointer hover:bg-rose-700/60"
            >
              <span>❌</span> فشل الحفظ - انقر لإعادة المحاولة
            </button>
          )}

          <button
            type="button"
            onClick={() => void performSave(config)}
            className="px-3.5 py-1.5 bg-[#0F4D3A] text-[#F5D77F] rounded-xl text-xs font-black border border-[#C9A86A] hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            💾 حفظ يدوي
          </button>
        </div>
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
          💬 أزرار الواتساب المخصصة
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. تبويب كارت المحل (المرسل) */}
      {/* ========================================================================= */}
      {activeTab === "shop_card" && (
        <div className="space-y-6">
          {/* قسم المعاينة المباشرة لكارت المحل */}
          <div className="bg-[#06281D]/80 border-2 border-[#C9A86A] rounded-[24px] p-4 sm:p-6 shadow-2xl">
            <h3 className="text-xs sm:text-sm font-black text-[#F5D77F] mb-3 flex items-center gap-1.5">
              <span>👁️</span> معاينة حية مباشرة لتصميم كارت المحل (المرسل):
            </h3>

            {/* الإطار الملكي */}
            <div
              className="relative w-full rounded-[22px] sm:rounded-[28px] bg-no-repeat bg-[length:100%_100%] shadow-2xl overflow-hidden p-3.5 sm:p-6 md:p-7 transition-all"
              style={{
                backgroundImage: `url('${frameBg}')`,
              }}
            >
              <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:gap-7 items-start min-w-0">
                {/* الجانب الأيمن: البيانات والتواصل */}
                <div className="flex flex-col justify-between gap-2 sm:gap-3 min-w-0">
                  {/* الرأس: كبسولة المحل */}
                  <div className="flex justify-start" style={getElementStyle(shopCustom?.headerShopInfo)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.headerShopInfo?.imageUrl || "/images/order-luxury/shop-card/header-shop-info.webp"}
                      alt="المحل"
                      className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md"
                    />
                  </div>

                  {/* البيانات */}
                  <div className="space-y-1.5 sm:space-y-2.5 py-0.5">
                    {/* 1. اسم المحل */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0" style={getElementStyle(shopCustom?.iconShopName)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.iconShopName?.imageUrl || "/images/order-luxury/shop-card/icon-shop-name.webp"}
                        alt="اسم المحل"
                        className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm"
                      />
                      <span className="font-black text-xs sm:text-sm md:text-base text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                        أزياء الأمير الملكي
                      </span>
                    </div>

                    {/* 2. اسم العميل / المسؤول */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0" style={getElementStyle(shopCustom?.iconCustomerName)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.iconCustomerName?.imageUrl || "/images/order-luxury/shop-card/icon-customer-name.webp"}
                        alt="اسم العميل"
                        className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm"
                      />
                      <span className="font-black text-xs sm:text-sm md:text-base text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                        أحمد سامي (المدير)
                      </span>
                    </div>

                    {/* 3. اسم المنطقة */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0" style={getElementStyle(shopCustom?.iconRegion)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.iconRegion?.imageUrl || "/images/order-luxury/shop-card/icon-region.webp"}
                        alt="المنطقة"
                        className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm"
                      />
                      <span className="font-bold text-xs sm:text-sm md:text-base text-[#FFF8F0] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                        بغداد — الكرادة
                      </span>
                    </div>

                    {/* 4. رقم الهاتف */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0" style={getElementStyle(shopCustom?.iconPhone)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.iconPhone?.imageUrl || "/images/order-luxury/shop-card/icon-phone.webp"}
                        alt="الهاتف"
                        className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm"
                      />
                      <span className="font-mono font-black text-xs sm:text-sm md:text-base text-[#F5D77F] tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                        07701234567
                      </span>
                    </div>
                  </div>

                  {/* زر موقع المحل */}
                  <div className="pt-0.5" style={getElementStyle(shopCustom?.btnShopLocation)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.btnShopLocation?.imageUrl || "/images/order-luxury/shop-card/btn-shop-location.webp"}
                      alt="موقع المحل"
                      className="h-7 sm:h-9 md:h-10 w-auto object-contain drop-shadow-lg cursor-pointer"
                    />
                  </div>

                  {/* أزرار الاتصال والواتساب */}
                  <div className="flex items-center gap-1.5 sm:gap-2.5 pt-1 flex-wrap">
                    <div style={getElementStyle(shopCustom?.btnCall)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.btnCall?.imageUrl || "/images/order-luxury/shop-card/btn-call.webp"}
                        alt="اتصال"
                        className="h-8 sm:h-10 md:h-11 w-auto object-contain drop-shadow-xl cursor-pointer"
                      />
                    </div>
                    <div style={getElementStyle(shopCustom?.btnWhatsapp)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.btnWhatsapp?.imageUrl || "/images/order-luxury/shop-card/btn-whatsapp.webp"}
                        alt="واتس اب"
                        className="h-8 sm:h-10 md:h-11 w-auto object-contain drop-shadow-xl cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* الجانب الأيسر: صورة المحل وأزرار الرفع */}
                <div className="flex flex-col items-center justify-between gap-2 sm:gap-3 min-w-0 h-full">
                  <div className="flex justify-center w-full" style={getElementStyle(shopCustom?.headerShopPhoto)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.headerShopPhoto?.imageUrl || "/images/order-luxury/shop-card/header-shop-photo.webp"}
                      alt="صورة المحل"
                      className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md"
                    />
                  </div>

                  <div className="w-full max-w-[160px] sm:max-w-[220px] md:max-w-[260px] flex items-center justify-center py-0.5" style={getElementStyle(shopCustom?.placeholderNoPhoto)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.placeholderNoPhoto?.imageUrl || "/images/order-luxury/shop-card/placeholder-no-photo.webp"}
                      alt="لا توجد صورة"
                      className="w-full h-auto max-h-[110px] sm:max-h-[150px] md:max-h-[180px] object-contain drop-shadow-xl opacity-95"
                    />
                  </div>

                  <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 pt-1 w-full flex-wrap">
                    <div style={getElementStyle(shopCustom?.btnCamera)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.btnCamera?.imageUrl || "/images/order-luxury/shop-card/btn-camera.webp"}
                        alt="كاميرا"
                        className="h-8 sm:h-10 md:h-11 w-auto object-contain drop-shadow-xl cursor-pointer"
                      />
                    </div>
                    <div style={getElementStyle(shopCustom?.btnGallery)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.btnGallery?.imageUrl || "/images/order-luxury/shop-card/btn-gallery.webp"}
                        alt="معرض"
                        className="h-8 sm:h-10 md:h-11 w-auto object-contain drop-shadow-xl cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* لوحة التحكم بعناصر كارت المحل */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-[#F5D77F]">⚙️ تخصيص أزرار وعناصر كارت المحل:</h3>

            {/* خلفية الإطار الملكي */}
            <div className="bg-[#0A3D2E]/90 border border-[#C9A86A]/60 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4">
              <div>
                <h4 className="font-black text-sm text-[#F5D77F]">خلفية إطار كارت المحل (الإطار الملكي)</h4>
                <p className="text-xs text-emerald-200">تغيير الصورة الخلفية للإطار المحيط بكارت المحل</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    triggerImageUpload((url) => {
                      setConfig((prev) => ({
                        ...prev,
                        shopCard: { ...prev.shopCard, frameBgUrl: url },
                      }));
                    })
                  }
                  className="px-3.5 py-1.5 bg-[#0F4D3A] text-[#F5D77F] border border-[#C9A86A] rounded-xl text-xs font-bold hover:scale-105 transition cursor-pointer"
                >
                  📤 تغيير صورة الإطار (WEBP)
                </button>
                {shopCustom?.frameBgUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        shopCard: { ...prev.shopCard, frameBgUrl: "" },
                      }))
                    }
                    className="text-xs text-rose-300 hover:text-rose-200 underline cursor-pointer"
                  >
                    استعادة الافتراضي
                  </button>
                )}
              </div>
            </div>

            {/* شبكة التحكم بباقي الأزرار والعناصر */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ElementControlCard
                title="كبسولة عنوان المحل (المرسل)"
                defaultImg="/images/order-luxury/shop-card/header-shop-info.webp"
                config={shopCustom?.headerShopInfo}
                onChange={(field, val) => updateShopElement("headerShopInfo", field, val)}
                onUploadImg={() => triggerImageUpload((url) => updateShopElement("headerShopInfo", "imageUrl", url))}
              />

              <ElementControlCard
                title="كبسولة عنوان صورة المحل"
                defaultImg="/images/order-luxury/shop-card/header-shop-photo.webp"
                config={shopCustom?.headerShopPhoto}
                onChange={(field, val) => updateShopElement("headerShopPhoto", field, val)}
                onUploadImg={() => triggerImageUpload((url) => updateShopElement("headerShopPhoto", "imageUrl", url))}
              />

              <ElementControlCard
                title="أيقونة اسم المحل"
                defaultImg="/images/order-luxury/shop-card/icon-shop-name.webp"
                config={shopCustom?.iconShopName}
                onChange={(field, val) => updateShopElement("iconShopName", field, val)}
                onUploadImg={() => triggerImageUpload((url) => updateShopElement("iconShopName", "imageUrl", url))}
              />

              <ElementControlCard
                title="أيقونة اسم العميل / المسؤول"
                defaultImg="/images/order-luxury/shop-card/icon-customer-name.webp"
                config={shopCustom?.iconCustomerName}
                onChange={(field, val) => updateShopElement("iconCustomerName", field, val)}
                onUploadImg={() => triggerImageUpload((url) => updateShopElement("iconCustomerName", "imageUrl", url))}
              />

              <ElementControlCard
                title="أيقونة منطقة المحل"
                defaultImg="/images/order-luxury/shop-card/icon-region.webp"
                config={shopCustom?.iconRegion}
                onChange={(field, val) => updateShopElement("iconRegion", field, val)}
                onUploadImg={() => triggerImageUpload((url) => updateShopElement("iconRegion", "imageUrl", url))}
              />

              <ElementControlCard
                title="أيقونة هاتف المحل"
                defaultImg="/images/order-luxury/shop-card/icon-phone.webp"
                config={shopCustom?.iconPhone}
                onChange={(field, val) => updateShopElement("iconPhone", field, val)}
                onUploadImg={() => triggerImageUpload((url) => updateShopElement("iconPhone", "imageUrl", url))}
              />

              <ElementControlCard
                title="زر موقع المحل على الخريطة"
                defaultImg="/images/order-luxury/shop-card/btn-shop-location.webp"
                config={shopCustom?.btnShopLocation}
                onChange={(field, val) => updateShopElement("btnShopLocation", field, val)}
                onUploadImg={() => triggerImageUpload((url) => updateShopElement("btnShopLocation", "imageUrl", url))}
              />

              <ElementControlCard
                title="أيقونة لا توجد صورة باب"
                defaultImg="/images/order-luxury/shop-card/placeholder-no-photo.webp"
                config={shopCustom?.placeholderNoPhoto}
                onChange={(field, val) => updateShopElement("placeholderNoPhoto", field, val)}
                onUploadImg={() => triggerImageUpload((url) => updateShopElement("placeholderNoPhoto", "imageUrl", url))}
              />

              <ElementControlCard
                title="زر الاتصال الهاتفي 📞"
                defaultImg="/images/order-luxury/shop-card/btn-call.webp"
                config={shopCustom?.btnCall}
                onChange={(field, val) => updateShopElement("btnCall", field, val)}
                onUploadImg={() => triggerImageUpload((url) => updateShopElement("btnCall", "imageUrl", url))}
              />

              <ElementControlCard
                title="زر مراسلة واتساب 💬"
                defaultImg="/images/order-luxury/shop-card/btn-whatsapp.webp"
                config={shopCustom?.btnWhatsapp}
                onChange={(field, val) => updateShopElement("btnWhatsapp", field, val)}
                onUploadImg={() => triggerImageUpload((url) => updateShopElement("btnWhatsapp", "imageUrl", url))}
              />

              <ElementControlCard
                title="زر التقاط الكاميرا 📷"
                defaultImg="/images/order-luxury/shop-card/btn-camera.webp"
                config={shopCustom?.btnCamera}
                onChange={(field, val) => updateShopElement("btnCamera", field, val)}
                onUploadImg={() => triggerImageUpload((url) => updateShopElement("btnCamera", "imageUrl", url))}
              />

              <ElementControlCard
                title="زر اختيار من المعرض 🖼️"
                defaultImg="/images/order-luxury/shop-card/btn-gallery.webp"
                config={shopCustom?.btnGallery}
                onChange={(field, val) => updateShopElement("btnGallery", field, val)}
                onUploadImg={() => triggerImageUpload((url) => updateShopElement("btnGallery", "imageUrl", url))}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. تبويب كارت الزبون (المستلم) */}
      {/* ========================================================================= */}
      {activeTab === "customer_card" && (
        <div className="space-y-6">
          <div className="bg-[#0A3D2E]/90 border border-[#C9A86A]/60 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4">
            <div>
              <h4 className="font-black text-sm text-[#F5D77F]">خلفية إطار كارت الزبون</h4>
              <p className="text-xs text-emerald-200">تخصيص صورة خلفية إطار كارت الزبون (المستلم)</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  triggerImageUpload((url) => {
                    setConfig((prev) => ({
                      ...prev,
                      customerCard: { ...prev.customerCard, frameBgUrl: url },
                    }));
                  })
                }
                className="px-3.5 py-1.5 bg-[#0F4D3A] text-[#F5D77F] border border-[#C9A86A] rounded-xl text-xs font-bold hover:scale-105 transition cursor-pointer"
              >
                📤 رفع خلفية الإطار (WEBP)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ElementControlCard
              title="كبسولة عنوان الزبون (المستلم)"
              defaultImg="/images/order-luxury/shop-card/header-shop-info.webp"
              config={config.customerCard?.headerCustomerInfo}
              onChange={(field, val) => updateCustomerElement("headerCustomerInfo", field, val)}
              onUploadImg={() => triggerImageUpload((url) => updateCustomerElement("headerCustomerInfo", "imageUrl", url))}
            />

            <ElementControlCard
              title="كبسولة عنوان صورة باب الزبون"
              defaultImg="/images/order-luxury/shop-card/header-shop-photo.webp"
              config={config.customerCard?.headerDoorPhoto}
              onChange={(field, val) => updateCustomerElement("headerDoorPhoto", field, val)}
              onUploadImg={() => triggerImageUpload((url) => updateCustomerElement("headerDoorPhoto", "imageUrl", url))}
            />

            <ElementControlCard
              title="أيقونة اسم الزبون"
              defaultImg="/images/order-luxury/shop-card/icon-customer-name.webp"
              config={config.customerCard?.iconCustomerName}
              onChange={(field, val) => updateCustomerElement("iconCustomerName", field, val)}
              onUploadImg={() => triggerImageUpload((url) => updateCustomerElement("iconCustomerName", "imageUrl", url))}
            />

            <ElementControlCard
              title="أيقونة منطقة الزبون"
              defaultImg="/images/order-luxury/shop-card/icon-region.webp"
              config={config.customerCard?.iconRegion}
              onChange={(field, val) => updateCustomerElement("iconRegion", field, val)}
              onUploadImg={() => triggerImageUpload((url) => updateCustomerElement("iconRegion", "imageUrl", url))}
            />

            <ElementControlCard
              title="أيقونة هاتف الزبون"
              defaultImg="/images/order-luxury/shop-card/icon-phone.webp"
              config={config.customerCard?.iconPhone}
              onChange={(field, val) => updateCustomerElement("iconPhone", field, val)}
              onUploadImg={() => triggerImageUpload((url) => updateCustomerElement("iconPhone", "imageUrl", url))}
            />

            <ElementControlCard
              title="زر موقع الزبون (اللوكيشن)"
              defaultImg="/images/order-luxury/shop-card/btn-shop-location.webp"
              config={config.customerCard?.btnLocation}
              onChange={(field, val) => updateCustomerElement("btnLocation", field, val)}
              onUploadImg={() => triggerImageUpload((url) => updateCustomerElement("btnLocation", "imageUrl", url))}
            />

            <ElementControlCard
              title="زر الاتصال بهاتف الزبون 📞"
              defaultImg="/images/order-luxury/shop-card/btn-call.webp"
              config={config.customerCard?.btnCall}
              onChange={(field, val) => updateCustomerElement("btnCall", field, val)}
              onUploadImg={() => triggerImageUpload((url) => updateCustomerElement("btnCall", "imageUrl", url))}
            />

            <ElementControlCard
              title="زر مراسلة الزبون واتساب 💬"
              defaultImg="/images/order-luxury/shop-card/btn-whatsapp.webp"
              config={config.customerCard?.btnWhatsapp}
              onChange={(field, val) => updateCustomerElement("btnWhatsapp", field, val)}
              onUploadImg={() => triggerImageUpload((url) => updateCustomerElement("btnWhatsapp", "imageUrl", url))}
            />

            <ElementControlCard
              title="زر كاميرا تصوير باب الزبون 📷"
              defaultImg="/images/order-luxury/shop-card/btn-camera.webp"
              config={config.customerCard?.btnCamera}
              onChange={(field, val) => updateCustomerElement("btnCamera", field, val)}
              onUploadImg={() => triggerImageUpload((url) => updateCustomerElement("btnCamera", "imageUrl", url))}
            />

            <ElementControlCard
              title="زر اختيار صورة باب الزبون من المعرض 🖼️"
              defaultImg="/images/order-luxury/shop-card/btn-gallery.webp"
              config={config.customerCard?.btnGallery}
              onChange={(field, val) => updateCustomerElement("btnGallery", field, val)}
              onUploadImg={() => triggerImageUpload((url) => updateCustomerElement("btnGallery", "imageUrl", url))}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. تبويب أزرار الواتساب المخصصة */}
      {/* ========================================================================= */}
      {activeTab === "wa_buttons" && (
        <div className="space-y-4">
          <div className="bg-[#0A3D2E]/90 border border-[#C9A86A]/60 rounded-2xl p-4 shadow-xl">
            <h4 className="font-black text-sm text-[#F5D77F]">تخصيص شكل وصور أزرار الواتساب المخصصة</h4>
            <p className="text-xs text-emerald-200 mt-1">
              يمكنك رفع صورة مخصصة لكل زر واتساب وتحويلها تلقائياً إلى WEBP وتحديد أبعادها وإزاحتها ونطاق ظهورها.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {waButtons.map((btn) => {
              const btnCustom = config.waButtonsConfig?.[btn.id] || {};
              return (
                <ElementControlCard
                  key={btn.id}
                  title={`زر واتساب: ${btn.label}`}
                  config={btnCustom}
                  onChange={(field, val) => updateWaButtonConfig(btn.id, field, val)}
                  onUploadImg={() => triggerImageUpload((url) => updateWaButtonConfig(btn.id, "imageUrl", url))}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// كارت التحكم بالعنصر المنفرد مع أدوات التكبير الحرة والإزاحة ونقطة الارتكاز
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
  const currentScaleX = config?.scaleX ?? 1;
  const currentScaleY = config?.scaleY ?? 1;
  const currentOffsetX = config?.offsetX ?? 0;
  const currentOffsetY = config?.offsetY ?? 0;
  const currentOrigin = config?.transformOrigin || "center";

  // حساب الأنماط للمعاينة المصغرة
  const previewStyle = getElementStyle(config);

  const origins = [
    { label: "⬑ أعلى يمين", value: "top right" },
    { label: "⬆️ أعلى", value: "top center" },
    { label: "⬏ أعلى يسار", value: "top left" },
    { label: "➡️ يمين", value: "center right" },
    { label: "🎯 الوسط", value: "center" },
    { label: "⬅️ يسار", value: "center left" },
    { label: "⬎ أسفل يمين", value: "bottom right" },
    { label: "⬇️ أسفل", value: "bottom center" },
    { label: "⬍ أسفل يسار", value: "bottom left" },
  ];

  return (
    <div className="bg-[#0A3D2E]/90 border border-[#C9A86A]/60 rounded-2xl p-4 shadow-xl space-y-3.5">
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
        {/* صندوق المعاينة الحية للعنصر نفسه */}
        <div className="w-20 h-16 rounded-xl border border-[#C9A86A]/60 bg-black/50 flex items-center justify-center overflow-hidden shrink-0 p-1 relative">
          {currentImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentImg}
              alt={title}
              style={previewStyle}
              className="max-h-full max-w-full object-contain transition-transform duration-75"
            />
          ) : (
            <span className="text-[10px] text-white/50">أصلي</span>
          )}
        </div>

        <div className="flex-1 space-y-1">
          <button
            type="button"
            onClick={onUploadImg}
            className="w-full px-3 py-1.5 bg-[#0F4D3A] text-[#F5D77F] border border-[#C9A86A] rounded-xl text-xs font-bold hover:scale-[1.02] active:scale-95 transition cursor-pointer"
          >
            📤 رفع صورة جديدة (قص الفراغات + WEBP)
          </button>
        </div>
      </div>

      {/* أشرطة التحكم المتقدمة */}
      <div className="space-y-3 pt-2 border-t border-[#C9A86A]/20">
        
        {/* 1. التكبير العام الكلي */}
        <div className="space-y-1 bg-black/20 p-2 rounded-xl border border-[#C9A86A]/20">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F5D77F] font-bold">🔍 التكبير الكلي (تناسبي):</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-emerald-300 font-bold">
                {Math.round(currentScale * 100)}%
              </span>
              {currentScale !== 1 && (
                <button
                  type="button"
                  onClick={() => onChange("scale", 1)}
                  className="text-[10px] text-amber-300 hover:underline cursor-pointer"
                >
                  (إعادة ضبط)
                </button>
              )}
            </div>
          </div>
          <input
            type="range"
            dir="ltr"
            min="0.3"
            max="3"
            step="0.05"
            value={currentScale}
            onChange={(e) => onChange("scale", parseFloat(e.target.value))}
            className="w-full accent-[#C9A86A] cursor-pointer"
          />
        </div>

        {/* 2. تحكم حر بالأبعاد: العرض (أفقي) والارتفاع (عمودي) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-black/20 p-2 rounded-xl border border-[#C9A86A]/20">
          {/* تمديد العرض (Scale X) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-200 font-bold">↔️ العرض (أفقي):</span>
              <span className="font-mono text-emerald-300 font-bold">
                {Math.round(currentScaleX * 100)}%
              </span>
            </div>
            <input
              type="range"
              dir="ltr"
              min="0.3"
              max="3"
              step="0.05"
              value={currentScaleX}
              onChange={(e) => onChange("scaleX", parseFloat(e.target.value))}
              className="w-full accent-[#C9A86A] cursor-pointer"
            />
          </div>

          {/* تمديد الارتفاع (Scale Y) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-200 font-bold">↕️ الارتفاع (عمودي):</span>
              <span className="font-mono text-emerald-300 font-bold">
                {Math.round(currentScaleY * 100)}%
              </span>
            </div>
            <input
              type="range"
              dir="ltr"
              min="0.3"
              max="3"
              step="0.05"
              value={currentScaleY}
              onChange={(e) => onChange("scaleY", parseFloat(e.target.value))}
              className="w-full accent-[#C9A86A] cursor-pointer"
            />
          </div>
        </div>

        {/* 3. اتجاه الارتكاز للتكبير (من اليمين أو اليسار أو الأعلى أو الأسفل) */}
        <div className="space-y-1.5 bg-black/20 p-2 rounded-xl border border-[#C9A86A]/20">
          <label className="text-[11px] text-[#F5D77F] font-bold block">
            📍 اتجاه التمدد والارتكاز (من أين يكبر العنصر؟):
          </label>
          <div className="grid grid-cols-3 gap-1">
            {origins.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange("transformOrigin", o.value)}
                className={`text-[10px] py-1 px-1 rounded font-bold transition ${
                  currentOrigin === o.value
                    ? "bg-[#C9A86A] text-[#06281D] shadow-sm font-black scale-[1.02]"
                    : "bg-[#06281D] text-white/80 hover:bg-[#0F4D3A]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. الإزاحة الأفقية X (يمين / يسار) مع أزرار خطوة دقيقة */}
        <div className="space-y-1 bg-black/20 p-2 rounded-xl border border-[#C9A86A]/20">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F5D77F] font-bold">➡️ إزاحة أفقية (يمين / يسار):</span>
            <span className="font-mono text-emerald-300 font-bold">
              {currentOffsetX > 0
                ? `+${currentOffsetX}px (يمين ▶)`
                : currentOffsetX < 0
                ? `${currentOffsetX}px (◀ يسار)`
                : "0px (وسط)"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange("offsetX", currentOffsetX - 2)}
              className="px-2 py-1 bg-[#06281D] border border-[#C9A86A]/50 text-white rounded text-xs font-bold hover:bg-[#0F4D3A] cursor-pointer"
              title="تحريك يسار"
            >
              ◀ يسار
            </button>

            <input
              type="range"
              dir="ltr"
              min="-80"
              max="80"
              step="1"
              value={currentOffsetX}
              onChange={(e) => onChange("offsetX", parseInt(e.target.value))}
              className="flex-1 accent-[#C9A86A] cursor-pointer"
            />

            <button
              type="button"
              onClick={() => onChange("offsetX", currentOffsetX + 2)}
              className="px-2 py-1 bg-[#06281D] border border-[#C9A86A]/50 text-white rounded text-xs font-bold hover:bg-[#0F4D3A] cursor-pointer"
              title="تحريك يمين"
            >
              يمين ▶
            </button>
          </div>
          {currentOffsetX !== 0 && (
            <div className="text-center pt-0.5">
              <button
                type="button"
                onClick={() => onChange("offsetX", 0)}
                className="text-[10px] text-amber-300 hover:underline cursor-pointer"
              >
                (إعادة للوسط 0px)
              </button>
            </div>
          )}
        </div>

        {/* 5. الإزاحة الرأسية Y (أعلى / أسفل) مع أزرار خطوة دقيقة */}
        <div className="space-y-1 bg-black/20 p-2 rounded-xl border border-[#C9A86A]/20">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F5D77F] font-bold">↕️ إزاحة رأسية (أعلى / أسفل):</span>
            <span className="font-mono text-emerald-300 font-bold">
              {currentOffsetY > 0
                ? `+${currentOffsetY}px (أسفل ▼)`
                : currentOffsetY < 0
                ? `${currentOffsetY}px (▲ أعلى)`
                : "0px (وسط)"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange("offsetY", currentOffsetY - 2)}
              className="px-2 py-1 bg-[#06281D] border border-[#C9A86A]/50 text-white rounded text-xs font-bold hover:bg-[#0F4D3A] cursor-pointer"
              title="تحريك لأعلى"
            >
              ▲ أعلى
            </button>

            <input
              type="range"
              dir="ltr"
              min="-80"
              max="80"
              step="1"
              value={currentOffsetY}
              onChange={(e) => onChange("offsetY", parseInt(e.target.value))}
              className="flex-1 accent-[#C9A86A] cursor-pointer"
            />

            <button
              type="button"
              onClick={() => onChange("offsetY", currentOffsetY + 2)}
              className="px-2 py-1 bg-[#06281D] border border-[#C9A86A]/50 text-white rounded text-xs font-bold hover:bg-[#0F4D3A] cursor-pointer"
              title="تحريك لأسفل"
            >
              أسفل ▼
            </button>
          </div>
          {currentOffsetY !== 0 && (
            <div className="text-center pt-0.5">
              <button
                type="button"
                onClick={() => onChange("offsetY", 0)}
                className="text-[10px] text-amber-300 hover:underline cursor-pointer"
              >
                (إعادة للوسط 0px)
              </button>
            </div>
          )}
        </div>

        {/* 6. نطاق الظهور */}
        <div className="pt-1">
          <label className="text-xs text-[#F5D77F] font-bold block mb-1">
            👁️ نطاق الظهور:
          </label>
          <select
            value={config?.visibility || "all"}
            onChange={(e) => onChange("visibility", e.target.value)}
            className="w-full bg-[#06281D] border border-[#C9A86A] rounded-lg text-xs p-2 text-white font-bold"
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
