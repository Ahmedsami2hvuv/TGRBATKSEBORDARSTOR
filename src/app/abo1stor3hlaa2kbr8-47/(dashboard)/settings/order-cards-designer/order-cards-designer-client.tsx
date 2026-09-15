"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  OrderCardDesignerConfig,
  CustomElementConfig,
  CustomFrameConfig,
  getElementStyle,
  getCardContainerStyle,
} from "@/lib/order-card-customizer";
import { updateOrderCardsDesignerAction } from "./actions";

type Props = {
  initialConfig: OrderCardDesignerConfig;
  waButtons: any[];
};

type TabType = "shop_card" | "customer_card" | "wa_buttons";

type ElementDefinition = {
  id: string;
  title: string;
  category: TabType;
  defaultImg: string;
  description: string;
  isFrame?: boolean;
  getConfig: (cfg: OrderCardDesignerConfig) => CustomElementConfig | undefined;
  updateConfig: (
    prev: OrderCardDesignerConfig,
    field: keyof CustomElementConfig,
    val: any
  ) => OrderCardDesignerConfig;
  setImageUrl: (prev: OrderCardDesignerConfig, url: string) => OrderCardDesignerConfig;
};

export function OrderCardsDesignerClient({ initialConfig, waButtons }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("shop_card");
  const [config, setConfig] = useState<OrderCardDesignerConfig>(initialConfig);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("saved");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // إعدادات المعاينة الحية
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("mobile");
  const [previewZoom, setPreviewZoom] = useState<number>(0.85);
  const [isStickyPreview, setIsStickyPreview] = useState<boolean>(true);
  const [isCompactPreview, setIsCompactPreview] = useState<boolean>(false);

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
    }, 450); // 450ms بعد توقف المستخدم عن التعديل

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [config, performSave]);

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

  // تعديل خصائص الإطار ككل
  const updateFrameConfig = (
    category: "shopCard" | "customerCard",
    field: keyof CustomFrameConfig,
    value: any
  ) => {
    setConfig((prev) => {
      const currentFrame = prev[category]?.frameConfig || {};
      return {
        ...prev,
        [category]: {
          ...prev[category],
          frameConfig: {
            ...currentFrame,
            [field]: value,
          },
        },
      };
    });
  };

  // تعريف عناصر كارت المحل
  const shopElements: ElementDefinition[] = [
    {
      id: "shop_frame",
      title: "🖼️ خلفية وإطار كارت المحل (تطويل، تقصير، تعريض، وضغط الكارت)",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/shop-card-frame.webp",
      description: "التحكم في أبعاد وخلفية كارت المحل ككل، تطويل الكارت أو تقصيره، تعريضه أو ضغطه",
      isFrame: true,
      getConfig: () => undefined,
      updateConfig: (prev) => prev,
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          frameBgUrl: url,
          frameConfig: { ...(prev.shopCard?.frameConfig || {}), bgUrl: url },
        },
      }),
    },
    {
      id: "shop_headerShopInfo",
      title: "كبسولة عنوان المحل (المرسل)",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/header-shop-info.webp",
      description: "الشريط العلوي للجانب الأيمن الذي يحتوي عنوان المحل المرسل",
      getConfig: (c) => c.shopCard?.headerShopInfo,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          headerShopInfo: { ...(prev.shopCard?.headerShopInfo || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          headerShopInfo: { ...(prev.shopCard?.headerShopInfo || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "shop_headerShopPhoto",
      title: "كبسولة عنوان صورة المحل",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/header-shop-photo.webp",
      description: "الشريط العلوي للجانب الأيسر فوق صورة باب المحل",
      getConfig: (c) => c.shopCard?.headerShopPhoto,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          headerShopPhoto: { ...(prev.shopCard?.headerShopPhoto || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          headerShopPhoto: { ...(prev.shopCard?.headerShopPhoto || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "shop_iconShopName",
      title: "أيقونة اسم المحل",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/icon-shop-name.webp",
      description: "الأيقونة المجسمة لسطر اسم المحل التجاري",
      getConfig: (c) => c.shopCard?.iconShopName,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          iconShopName: { ...(prev.shopCard?.iconShopName || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          iconShopName: { ...(prev.shopCard?.iconShopName || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "shop_iconCustomerName",
      title: "أيقونة اسم العميل / المسؤول",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/icon-customer-name.webp",
      description: "الأيقونة المجسمة لسطر اسم صاحب المحل أو المسؤول",
      getConfig: (c) => c.shopCard?.iconCustomerName,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          iconCustomerName: { ...(prev.shopCard?.iconCustomerName || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          iconCustomerName: { ...(prev.shopCard?.iconCustomerName || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "shop_iconRegion",
      title: "أيقونة منطقة المحل",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/icon-region.webp",
      description: "الأيقونة المجسمة لسطر المنطقة الجغرافية للمحل",
      getConfig: (c) => c.shopCard?.iconRegion,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          iconRegion: { ...(prev.shopCard?.iconRegion || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          iconRegion: { ...(prev.shopCard?.iconRegion || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "shop_iconPhone",
      title: "أيقونة هاتف المحل",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/icon-phone.webp",
      description: "الأيقونة المجسمة لسطر رقم هاتف المحل",
      getConfig: (c) => c.shopCard?.iconPhone,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          iconPhone: { ...(prev.shopCard?.iconPhone || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          iconPhone: { ...(prev.shopCard?.iconPhone || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "shop_btnShopLocation",
      title: "زر موقع المحل على الخريطة",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/btn-shop-location.webp",
      description: "زر فتح موقع المحل الجغرافي على خرائط غوغل",
      getConfig: (c) => c.shopCard?.btnShopLocation,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          btnShopLocation: { ...(prev.shopCard?.btnShopLocation || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          btnShopLocation: { ...(prev.shopCard?.btnShopLocation || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "shop_placeholderNoPhoto",
      title: "أيقونة لا توجد صورة باب",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/placeholder-no-photo.webp",
      description: "الشعار المعروض في حالة عدم رفع صورة لباب المحل",
      getConfig: (c) => c.shopCard?.placeholderNoPhoto,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          placeholderNoPhoto: { ...(prev.shopCard?.placeholderNoPhoto || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          placeholderNoPhoto: { ...(prev.shopCard?.placeholderNoPhoto || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "shop_btnCall",
      title: "زر الاتصال الهاتفي 📞",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/btn-call.webp",
      description: "زر إجراء مكالمة هاتفية سريعة مع المحل",
      getConfig: (c) => c.shopCard?.btnCall,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          btnCall: { ...(prev.shopCard?.btnCall || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          btnCall: { ...(prev.shopCard?.btnCall || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "shop_btnWhatsapp",
      title: "زر مراسلة واتساب 💬",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/btn-whatsapp.webp",
      description: "زر فتح محادثة واتساب فورية مع المحل",
      getConfig: (c) => c.shopCard?.btnWhatsapp,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          btnWhatsapp: { ...(prev.shopCard?.btnWhatsapp || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          btnWhatsapp: { ...(prev.shopCard?.btnWhatsapp || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "shop_btnCamera",
      title: "زر التقاط الكاميرا 📷",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/btn-camera.webp",
      description: "زر فتح كاميرا الهاتف لتصوير باب المحل",
      getConfig: (c) => c.shopCard?.btnCamera,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          btnCamera: { ...(prev.shopCard?.btnCamera || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          btnCamera: { ...(prev.shopCard?.btnCamera || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "shop_btnGallery",
      title: "زر اختيار من المعرض 🖼️",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/btn-gallery.webp",
      description: "زر اختيار صورة لباب المحل من ألبوم الصور",
      getConfig: (c) => c.shopCard?.btnGallery,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          btnGallery: { ...(prev.shopCard?.btnGallery || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          btnGallery: { ...(prev.shopCard?.btnGallery || {}), imageUrl: url },
        },
      }),
    },
  ];

  // تعريف عناصر كارت الزبون
  const customerElements: ElementDefinition[] = [
    {
      id: "cust_frame",
      title: "🖼️ خلفية وإطار كارت الزبون (تطويل، تقصير، تعريض، وضغط الكارت)",
      category: "customer_card",
      defaultImg: "/images/order-luxury/shop-card/shop-card-frame.webp",
      description: "التحكم في أبعاد وخلفية كارت الزبون ككل، تطويل الكارت أو تقصيره، تعريضه أو ضغطه",
      isFrame: true,
      getConfig: () => undefined,
      updateConfig: (prev) => prev,
      setImageUrl: (prev, url) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          frameBgUrl: url,
          frameConfig: { ...(prev.customerCard?.frameConfig || {}), bgUrl: url },
        },
      }),
    },
    {
      id: "cust_headerCustomerInfo",
      title: "كبسولة عنوان الزبون (المستلم)",
      category: "customer_card",
      defaultImg: "/images/order-luxury/shop-card/header-shop-info.webp",
      description: "الشريط العلوي للجانب الأيمن الخاص ببيانات الزبون",
      getConfig: (c) => c.customerCard?.headerCustomerInfo,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          headerCustomerInfo: { ...(prev.customerCard?.headerCustomerInfo || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          headerCustomerInfo: { ...(prev.customerCard?.headerCustomerInfo || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "cust_headerDoorPhoto",
      title: "كبسولة عنوان صورة باب الزبون",
      category: "customer_card",
      defaultImg: "/images/order-luxury/shop-card/header-shop-photo.webp",
      description: "الشريط العلوي فوق صورة باب منزل أو عمارة الزبون",
      getConfig: (c) => c.customerCard?.headerDoorPhoto,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          headerDoorPhoto: { ...(prev.customerCard?.headerDoorPhoto || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          headerDoorPhoto: { ...(prev.customerCard?.headerDoorPhoto || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "cust_iconCustomerName",
      title: "أيقونة اسم الزبون",
      category: "customer_card",
      defaultImg: "/images/order-luxury/shop-card/icon-customer-name.webp",
      description: "الأيقونة المجسمة لسطر اسم الزبون المستلم",
      getConfig: (c) => c.customerCard?.iconCustomerName,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          iconCustomerName: { ...(prev.customerCard?.iconCustomerName || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          iconCustomerName: { ...(prev.customerCard?.iconCustomerName || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "cust_iconRegion",
      title: "أيقونة منطقة الزبون",
      category: "customer_card",
      defaultImg: "/images/order-luxury/shop-card/icon-region.webp",
      description: "الأيقونة المجسمة لسطر منطقة وسكن الزبون",
      getConfig: (c) => c.customerCard?.iconRegion,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          iconRegion: { ...(prev.customerCard?.iconRegion || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          iconRegion: { ...(prev.customerCard?.iconRegion || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "cust_iconPhone",
      title: "أيقونة هاتف الزبون",
      category: "customer_card",
      defaultImg: "/images/order-luxury/shop-card/icon-phone.webp",
      description: "الأيقونة المجسمة لسطر رقم هاتف الزبون",
      getConfig: (c) => c.customerCard?.iconPhone,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          iconPhone: { ...(prev.customerCard?.iconPhone || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          iconPhone: { ...(prev.customerCard?.iconPhone || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "cust_btnLocation",
      title: "زر موقع الزبون (اللوكيشن)",
      category: "customer_card",
      defaultImg: "/images/order-luxury/shop-card/btn-shop-location.webp",
      description: "زر فتح موقع الزبون على الخريطة",
      getConfig: (c) => c.customerCard?.btnLocation,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          btnLocation: { ...(prev.customerCard?.btnLocation || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          btnLocation: { ...(prev.customerCard?.btnLocation || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "cust_placeholderNoPhoto",
      title: "أيقونة لا توجد صورة باب",
      category: "customer_card",
      defaultImg: "/images/order-luxury/shop-card/placeholder-no-photo.webp",
      description: "الشعار المعروض في حالة عدم توفر صورة لباب الزبون",
      getConfig: (c) => c.customerCard?.placeholderNoPhoto,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          placeholderNoPhoto: { ...(prev.customerCard?.placeholderNoPhoto || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          placeholderNoPhoto: { ...(prev.customerCard?.placeholderNoPhoto || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "cust_btnCall",
      title: "زر الاتصال بهاتف الزبون 📞",
      category: "customer_card",
      defaultImg: "/images/order-luxury/shop-card/btn-call.webp",
      description: "زر الاتصال المباشر بهاتف الزبون",
      getConfig: (c) => c.customerCard?.btnCall,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          btnCall: { ...(prev.customerCard?.btnCall || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          btnCall: { ...(prev.customerCard?.btnCall || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "cust_btnWhatsapp",
      title: "زر مراسلة الزبون واتساب 💬",
      category: "customer_card",
      defaultImg: "/images/order-luxury/shop-card/btn-whatsapp.webp",
      description: "زر فتح شات واتساب فوري مع الزبون",
      getConfig: (c) => c.customerCard?.btnWhatsapp,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          btnWhatsapp: { ...(prev.customerCard?.btnWhatsapp || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          btnWhatsapp: { ...(prev.customerCard?.btnWhatsapp || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "cust_btnCamera",
      title: "زر تصوير باب الزبون بالكاميرا 📷",
      category: "customer_card",
      defaultImg: "/images/order-luxury/shop-card/btn-camera.webp",
      description: "زر تشغيل الكاميرا لتصوير باب الزبون",
      getConfig: (c) => c.customerCard?.btnCamera,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          btnCamera: { ...(prev.customerCard?.btnCamera || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          btnCamera: { ...(prev.customerCard?.btnCamera || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "cust_btnGallery",
      title: "زر اختيار صورة باب الزبون من المعرض 🖼️",
      category: "customer_card",
      defaultImg: "/images/order-luxury/shop-card/btn-gallery.webp",
      description: "زر اختيار صورة لباب الزبون من ألبوم الصور",
      getConfig: (c) => c.customerCard?.btnGallery,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          btnGallery: { ...(prev.customerCard?.btnGallery || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          btnGallery: { ...(prev.customerCard?.btnGallery || {}), imageUrl: url },
        },
      }),
    },
  ];

  // تعريف عناصر أزرار الواتساب
  const waElements: ElementDefinition[] = waButtons.map((btn) => ({
    id: `wa_${btn.id}`,
    title: `زر واتساب: ${btn.label}`,
    category: "wa_buttons",
    defaultImg: "",
    description: `زر واتساب مخصص بقالب: ${btn.label}`,
    getConfig: (c) => c.waButtonsConfig?.[btn.id],
    updateConfig: (prev, f, v) => ({
      ...prev,
      waButtonsConfig: {
        ...prev.waButtonsConfig,
        [btn.id]: { ...(prev.waButtonsConfig?.[btn.id] || {}), [f]: v },
      },
    }),
    setImageUrl: (prev, url) => ({
      ...prev,
      waButtonsConfig: {
        ...prev.waButtonsConfig,
        [btn.id]: { ...(prev.waButtonsConfig?.[btn.id] || {}), imageUrl: url },
      },
    }),
  }));

  const allElements = [...shopElements, ...customerElements, ...waElements];
  const currentTabElements =
    activeTab === "shop_card"
      ? shopElements
      : activeTab === "customer_card"
      ? customerElements
      : waElements;

  const currentSelectedDef = allElements.find((e) => e.id === selectedElementId);
  const currentSelectedConfig = currentSelectedDef?.getConfig(config);

  const currentIndex = currentTabElements.findIndex((e) => e.id === selectedElementId);
  const prevElement = currentIndex > 0 ? currentTabElements[currentIndex - 1] : null;
  const nextElement =
    currentIndex >= 0 && currentIndex < currentTabElements.length - 1
      ? currentTabElements[currentIndex + 1]
      : null;

  const shopCustom = config.shopCard;
  const custCustom = config.customerCard;
  const shopFrameBg = shopCustom?.frameBgUrl || "/images/order-luxury/shop-card/shop-card-frame.webp";
  const custFrameBg = custCustom?.frameBgUrl || "/images/order-luxury/shop-card/shop-card-frame.webp";

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
            التحكم الكامل بأبعاد وخلفية الكارت (تطويل، تقصير، تعريض، وضغط) 📐، تدوير حر للأزرار 🔄، وحفظ فوري 💾.
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
          onClick={() => {
            setActiveTab("shop_card");
            setSelectedElementId(null);
          }}
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
          onClick={() => {
            setActiveTab("customer_card");
            setSelectedElementId(null);
          }}
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
          onClick={() => {
            setActiveTab("wa_buttons");
            setSelectedElementId(null);
          }}
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
      {/* تخطيط الاستوديو المتجاوب (لوحة المعاينة الثابتة + لوحة الإعدادات المتحركة) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* 1. قسم المعاينة الحية المباشرة للكارت (Interactive Live Preview Studio) */}
        {/* ========================================================================= */}
        <div
          className={`lg:col-span-5 xl:col-span-5 transition-all ${
            isStickyPreview ? "sticky top-2 z-20" : "relative"
          }`}
        >
          <div className="bg-[#06281D]/95 border-2 border-[#C9A86A] rounded-[24px] p-3.5 sm:p-5 shadow-2xl space-y-3 backdrop-blur-md">
            <div className="flex flex-col gap-2.5 border-b border-[#C9A86A]/40 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg sm:text-xl shrink-0">👁️</span>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-black text-[#F5D77F] flex items-center gap-1.5 truncate">
                      <span>معاينة حية مباشرة</span>
                      {isStickyPreview && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] border border-amber-400/40 shrink-0">
                          📌 ثابتة
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-emerald-200 truncate">
                      ثابتة في مكانها أثناء تمرير الإعدادات بالأسفل
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* زر تثبيت/إلغاء تثبيت المعاينة */}
                  <button
                    type="button"
                    onClick={() => setIsStickyPreview((v) => !v)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black border transition flex items-center gap-1 cursor-pointer ${
                      isStickyPreview
                        ? "bg-[#C9A86A] text-[#06281D] border-[#F5D77F] shadow"
                        : "bg-[#0A3D2E] text-white/80 border-[#C9A86A]/50 hover:text-white"
                    }`}
                    title={isStickyPreview ? "إلغاء التثبيت" : "تثبيت المعاينة في الأعلى"}
                  >
                    <span>{isStickyPreview ? "📌 مثبتة" : "🔓 عادية"}</span>
                  </button>

                  {/* زر طي/توسيع للموبايل */}
                  <button
                    type="button"
                    onClick={() => setIsCompactPreview((v) => !v)}
                    className="lg:hidden px-2.5 py-1 rounded-xl text-xs font-black bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A]/50 hover:bg-[#0F4D3A] transition cursor-pointer"
                    title="طي أو توسيع المعاينة"
                  >
                    {isCompactPreview ? "🔽 إظهار" : "🔼 تصغير"}
                  </button>
                </div>
              </div>

              {/* أزرار ضبط شاشة المعاينة والزووم */}
              {!isCompactPreview && (
                <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                  <div className="flex items-center bg-[#0A3D2E] border border-[#C9A86A]/60 rounded-xl p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("mobile")}
                      className={`px-2 py-0.5 rounded-lg transition ${
                        previewMode === "mobile" ? "bg-[#C9A86A] text-[#06281D] font-black" : "text-white/80 hover:text-white"
                      }`}
                    >
                      📱 جوال
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("desktop")}
                      className={`px-2 py-0.5 rounded-lg transition ${
                        previewMode === "desktop" ? "bg-[#C9A86A] text-[#06281D] font-black" : "text-white/80 hover:text-white"
                      }`}
                    >
                      💻 كمبيوتر
                    </button>
                  </div>

                  {/* زووم المعاينة */}
                  <div className="flex items-center bg-[#0A3D2E] border border-[#C9A86A]/60 rounded-xl p-0.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(0.7)}
                      className={`px-1.5 py-0.5 rounded-lg transition ${
                        previewZoom === 0.7 ? "bg-[#C9A86A] text-[#06281D] font-black" : "text-white/80"
                      }`}
                    >
                      70%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(0.85)}
                      className={`px-1.5 py-0.5 rounded-lg transition ${
                        previewZoom === 0.85 ? "bg-[#C9A86A] text-[#06281D] font-black" : "text-white/80"
                      }`}
                    >
                      85%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(1)}
                      className={`px-1.5 py-0.5 rounded-lg transition ${
                        previewZoom === 1 ? "bg-[#C9A86A] text-[#06281D] font-black" : "text-white/80"
                      }`}
                    >
                      100%
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* حاوية المعاينة مع تطبيق getCardContainerStyle الشامل */}
            {!isCompactPreview && (
              <div className="flex items-center justify-center p-2 bg-black/50 rounded-2xl border border-[#C9A86A]/20 overflow-x-auto overflow-y-auto max-h-[38vh] sm:max-h-[48vh] lg:max-h-[calc(100vh-12rem)]">
                <div
                  className="transition-all duration-150 origin-top"
                  style={{
                    width: previewMode === "mobile" ? "420px" : "100%",
                    maxWidth: "100%",
                    transform: `scale(${previewZoom})`,
                  }}
                >
                  {/* 1. كارت المحل في المعاينة */}
                  {activeTab === "shop_card" && (
              <div
                onClick={() => !selectedElementId && setSelectedElementId("shop_frame")}
                className={`relative w-full rounded-[22px] sm:rounded-[28px] bg-no-repeat bg-[length:100%_100%] shadow-2xl overflow-hidden p-3.5 sm:p-6 md:p-7 transition-all mx-auto ${
                  selectedElementId === "shop_frame" ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-black" : ""
                }`}
                style={getCardContainerStyle(shopCustom?.frameConfig, shopFrameBg)}
              >
                <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:gap-7 items-start min-w-0">
                  {/* الجانب الأيمن */}
                  <div className="flex flex-col justify-between gap-2 sm:gap-3 min-w-0">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElementId("shop_headerShopInfo");
                      }}
                      className={`cursor-pointer rounded-xl transition-all ${
                        selectedElementId === "shop_headerShopInfo" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50" : "hover:opacity-90"
                      }`}
                      style={getElementStyle(shopCustom?.headerShopInfo)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.headerShopInfo?.imageUrl || "/images/order-luxury/shop-card/header-shop-info.webp"}
                        alt="المحل"
                        className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md"
                      />
                    </div>

                    <div className="space-y-1.5 sm:space-y-2.5 py-0.5">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("shop_iconShopName");
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2.5 min-w-0 cursor-pointer rounded-xl p-0.5 transition-all ${
                          selectedElementId === "shop_iconShopName" ? "ring-2 ring-[#F5D77F] ring-offset-1 ring-offset-black/50" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(shopCustom?.iconShopName)}
                      >
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

                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("shop_iconCustomerName");
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2.5 min-w-0 cursor-pointer rounded-xl p-0.5 transition-all ${
                          selectedElementId === "shop_iconCustomerName" ? "ring-2 ring-[#F5D77F] ring-offset-1 ring-offset-black/50" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(shopCustom?.iconCustomerName)}
                      >
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

                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("shop_iconRegion");
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2.5 min-w-0 cursor-pointer rounded-xl p-0.5 transition-all ${
                          selectedElementId === "shop_iconRegion" ? "ring-2 ring-[#F5D77F] ring-offset-1 ring-offset-black/50" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(shopCustom?.iconRegion)}
                      >
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

                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("shop_iconPhone");
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2.5 min-w-0 cursor-pointer rounded-xl p-0.5 transition-all ${
                          selectedElementId === "shop_iconPhone" ? "ring-2 ring-[#F5D77F] ring-offset-1 ring-offset-black/50" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(shopCustom?.iconPhone)}
                      >
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

                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElementId("shop_btnShopLocation");
                      }}
                      className={`pt-0.5 cursor-pointer transition-all ${
                        selectedElementId === "shop_btnShopLocation" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                      }`}
                      style={getElementStyle(shopCustom?.btnShopLocation)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.btnShopLocation?.imageUrl || "/images/order-luxury/shop-card/btn-shop-location.webp"}
                        alt="موقع المحل"
                        className="h-7 sm:h-9 md:h-10 w-auto object-contain drop-shadow-lg"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2.5 pt-1 flex-wrap">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("shop_btnCall");
                        }}
                        className={`cursor-pointer transition-all ${
                          selectedElementId === "shop_btnCall" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(shopCustom?.btnCall)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shopCustom?.btnCall?.imageUrl || "/images/order-luxury/shop-card/btn-call.webp"}
                          alt="اتصال"
                          className="h-8 sm:h-10 md:h-11 w-auto object-contain drop-shadow-xl"
                        />
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("shop_btnWhatsapp");
                        }}
                        className={`cursor-pointer transition-all ${
                          selectedElementId === "shop_btnWhatsapp" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(shopCustom?.btnWhatsapp)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shopCustom?.btnWhatsapp?.imageUrl || "/images/order-luxury/shop-card/btn-whatsapp.webp"}
                          alt="واتس اب"
                          className="h-8 sm:h-10 md:h-11 w-auto object-contain drop-shadow-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* الجانب الأيسر */}
                  <div className="flex flex-col items-center justify-between gap-2 sm:gap-3 min-w-0 h-full">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElementId("shop_headerShopPhoto");
                      }}
                      className={`flex justify-center w-full cursor-pointer transition-all ${
                        selectedElementId === "shop_headerShopPhoto" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                      }`}
                      style={getElementStyle(shopCustom?.headerShopPhoto)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.headerShopPhoto?.imageUrl || "/images/order-luxury/shop-card/header-shop-photo.webp"}
                        alt="صورة المحل"
                        className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md"
                      />
                    </div>

                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElementId("shop_placeholderNoPhoto");
                      }}
                      className={`w-full max-w-[160px] sm:max-w-[220px] md:max-w-[260px] flex items-center justify-center py-0.5 cursor-pointer transition-all ${
                        selectedElementId === "shop_placeholderNoPhoto" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                      }`}
                      style={getElementStyle(shopCustom?.placeholderNoPhoto)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shopCustom?.placeholderNoPhoto?.imageUrl || "/images/order-luxury/shop-card/placeholder-no-photo.webp"}
                        alt="لا توجد صورة"
                        className="w-full h-auto max-h-[110px] sm:max-h-[150px] md:max-h-[180px] object-contain drop-shadow-xl opacity-95"
                      />
                    </div>

                    <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 pt-1 w-full flex-wrap">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("shop_btnCamera");
                        }}
                        className={`cursor-pointer transition-all ${
                          selectedElementId === "shop_btnCamera" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(shopCustom?.btnCamera)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shopCustom?.btnCamera?.imageUrl || "/images/order-luxury/shop-card/btn-camera.webp"}
                          alt="كاميرا"
                          className="h-8 sm:h-10 md:h-11 w-auto object-contain drop-shadow-xl"
                        />
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("shop_btnGallery");
                        }}
                        className={`cursor-pointer transition-all ${
                          selectedElementId === "shop_btnGallery" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(shopCustom?.btnGallery)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shopCustom?.btnGallery?.imageUrl || "/images/order-luxury/shop-card/btn-gallery.webp"}
                          alt="معرض"
                          className="h-8 sm:h-10 md:h-11 w-auto object-contain drop-shadow-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. كارت الزبون في المعاينة */}
            {activeTab === "customer_card" && (
              <div
                onClick={() => !selectedElementId && setSelectedElementId("cust_frame")}
                className={`relative w-full rounded-[22px] sm:rounded-[28px] bg-no-repeat bg-[length:100%_100%] shadow-2xl overflow-hidden p-3.5 sm:p-6 md:p-7 transition-all mx-auto ${
                  selectedElementId === "cust_frame" ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-black" : ""
                }`}
                style={getCardContainerStyle(custCustom?.frameConfig, custFrameBg)}
              >
                <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:gap-7 items-start min-w-0">
                  {/* الجانب الأيمن */}
                  <div className="flex flex-col justify-between gap-2 sm:gap-3 min-w-0">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElementId("cust_headerCustomerInfo");
                      }}
                      className={`cursor-pointer rounded-xl transition-all ${
                        selectedElementId === "cust_headerCustomerInfo" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50" : "hover:opacity-90"
                      }`}
                      style={getElementStyle(custCustom?.headerCustomerInfo)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.headerCustomerInfo?.imageUrl || "/images/order-luxury/shop-card/header-shop-info.webp"}
                        alt="الزبون"
                        className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md"
                      />
                    </div>

                    <div className="space-y-1.5 sm:space-y-2.5 py-0.5">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("cust_iconCustomerName");
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2.5 min-w-0 cursor-pointer rounded-xl p-0.5 transition-all ${
                          selectedElementId === "cust_iconCustomerName" ? "ring-2 ring-[#F5D77F] ring-offset-1 ring-offset-black/50" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(custCustom?.iconCustomerName)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={custCustom?.iconCustomerName?.imageUrl || "/images/order-luxury/shop-card/icon-customer-name.webp"}
                          alt="اسم الزبون"
                          className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm"
                        />
                        <span className="font-black text-xs sm:text-sm md:text-base text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                          مريم علي (الزبون)
                        </span>
                      </div>

                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("cust_iconRegion");
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2.5 min-w-0 cursor-pointer rounded-xl p-0.5 transition-all ${
                          selectedElementId === "cust_iconRegion" ? "ring-2 ring-[#F5D77F] ring-offset-1 ring-offset-black/50" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(custCustom?.iconRegion)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={custCustom?.iconRegion?.imageUrl || "/images/order-luxury/shop-card/icon-region.webp"}
                          alt="المنطقة"
                          className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm"
                        />
                        <span className="font-bold text-xs sm:text-sm md:text-base text-[#FFF8F0] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                          بغداد — المنصور
                        </span>
                      </div>

                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("cust_iconPhone");
                        }}
                        className={`flex items-center gap-1.5 sm:gap-2.5 min-w-0 cursor-pointer rounded-xl p-0.5 transition-all ${
                          selectedElementId === "cust_iconPhone" ? "ring-2 ring-[#F5D77F] ring-offset-1 ring-offset-black/50" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(custCustom?.iconPhone)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={custCustom?.iconPhone?.imageUrl || "/images/order-luxury/shop-card/icon-phone.webp"}
                          alt="الهاتف"
                          className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm"
                        />
                        <span className="font-mono font-black text-xs sm:text-sm md:text-base text-[#F5D77F] tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                          07809876543
                        </span>
                      </div>
                    </div>

                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElementId("cust_btnLocation");
                      }}
                      className={`pt-0.5 cursor-pointer transition-all ${
                        selectedElementId === "cust_btnLocation" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                      }`}
                      style={getElementStyle(custCustom?.btnLocation)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.btnLocation?.imageUrl || "/images/order-luxury/shop-card/btn-shop-location.webp"}
                        alt="موقع الزبون"
                        className="h-7 sm:h-9 md:h-10 w-auto object-contain drop-shadow-lg"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2.5 pt-1 flex-wrap">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("cust_btnCall");
                        }}
                        className={`cursor-pointer transition-all ${
                          selectedElementId === "cust_btnCall" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(custCustom?.btnCall)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={custCustom?.btnCall?.imageUrl || "/images/order-luxury/shop-card/btn-call.webp"}
                          alt="اتصال"
                          className="h-8 sm:h-10 md:h-11 w-auto object-contain drop-shadow-xl"
                        />
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("cust_btnWhatsapp");
                        }}
                        className={`cursor-pointer transition-all ${
                          selectedElementId === "cust_btnWhatsapp" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(custCustom?.btnWhatsapp)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={custCustom?.btnWhatsapp?.imageUrl || "/images/order-luxury/shop-card/btn-whatsapp.webp"}
                          alt="واتس اب"
                          className="h-8 sm:h-10 md:h-11 w-auto object-contain drop-shadow-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* الجانب الأيسر */}
                  <div className="flex flex-col items-center justify-between gap-2 sm:gap-3 min-w-0 h-full">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElementId("cust_headerDoorPhoto");
                      }}
                      className={`flex justify-center w-full cursor-pointer transition-all ${
                        selectedElementId === "cust_headerDoorPhoto" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                      }`}
                      style={getElementStyle(custCustom?.headerDoorPhoto)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.headerDoorPhoto?.imageUrl || "/images/order-luxury/shop-card/header-shop-photo.webp"}
                        alt="صورة باب الزبون"
                        className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md"
                      />
                    </div>

                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElementId("cust_placeholderNoPhoto");
                      }}
                      className={`w-full max-w-[160px] sm:max-w-[220px] md:max-w-[260px] flex items-center justify-center py-0.5 cursor-pointer transition-all ${
                        selectedElementId === "cust_placeholderNoPhoto" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                      }`}
                      style={getElementStyle(custCustom?.placeholderNoPhoto)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.placeholderNoPhoto?.imageUrl || "/images/order-luxury/shop-card/placeholder-no-photo.webp"}
                        alt="لا توجد صورة باب"
                        className="w-full h-auto max-h-[110px] sm:max-h-[150px] md:max-h-[180px] object-contain drop-shadow-xl opacity-95"
                      />
                    </div>

                    <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 pt-1 w-full flex-wrap">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("cust_btnCamera");
                        }}
                        className={`cursor-pointer transition-all ${
                          selectedElementId === "cust_btnCamera" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(custCustom?.btnCamera)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={custCustom?.btnCamera?.imageUrl || "/images/order-luxury/shop-card/btn-camera.webp"}
                          alt="كاميرا"
                          className="h-8 sm:h-10 md:h-11 w-auto object-contain drop-shadow-xl"
                        />
                      </div>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId("cust_btnGallery");
                        }}
                        className={`cursor-pointer transition-all ${
                          selectedElementId === "cust_btnGallery" ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl" : "hover:opacity-90"
                        }`}
                        style={getElementStyle(custCustom?.btnGallery)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={custCustom?.btnGallery?.imageUrl || "/images/order-luxury/shop-card/btn-gallery.webp"}
                          alt="معرض"
                          className="h-8 sm:h-10 md:h-11 w-auto object-contain drop-shadow-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. أزرار الواتساب في المعاينة */}
            {activeTab === "wa_buttons" && (
              <div className="p-4 bg-[#0A3D2E]/90 border-2 border-[#C9A86A] rounded-2xl shadow-xl flex flex-wrap items-center gap-3 justify-center">
                {waButtons.map((btn) => {
                  const btnCustom = config.waButtonsConfig?.[btn.id];
                  const previewImg = btnCustom?.imageUrl;
                  const isSelected = selectedElementId === `wa_${btn.id}`;
                  return (
                    <div
                      key={btn.id}
                      onClick={() => setSelectedElementId(`wa_${btn.id}`)}
                      style={getElementStyle(btnCustom)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] text-[#F5D77F] font-black text-xs shadow-md cursor-pointer transition-all ${
                        isSelected ? "ring-2 ring-[#F5D77F] ring-offset-2 ring-offset-black scale-105" : "hover:opacity-90"
                      }`}
                    >
                      {previewImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewImg} alt={btn.label} className="w-5 h-5 object-contain shrink-0" />
                      ) : (
                        <span>💬</span>
                      )}
                      <span>{btn.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  </div>

  {/* ========================================================================= */}
  {/* 2. قسم الإعدادات وأدوات التحكم (المفتش المخصص / قائمة العناصر) */}
  {/* ========================================================================= */}
  <div className="lg:col-span-7 xl:col-span-7 space-y-6">
    {selectedElementId && currentSelectedDef ? (
        <div className="space-y-4 bg-gradient-to-b from-[#0A3D2E] to-[#06281D] border-2 border-[#C9A86A] rounded-[24px] p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          
          {/* شريط أدوات الانتقال والرجوع */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C9A86A]/30 pb-3">
            <button
              type="button"
              onClick={() => setSelectedElementId(null)}
              className="px-4 py-2 bg-[#06281D] text-[#F5D77F] border border-[#C9A86A] rounded-xl text-xs font-black hover:bg-[#0F4D3A] transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span>◀</span> عودة لكافة عناصر الكارت
            </button>

            <div className="text-center">
              <h3 className="text-sm sm:text-base font-black text-[#F5D77F]">
                ✏️ {currentSelectedDef.title}
              </h3>
              <p className="text-[11px] text-emerald-200">{currentSelectedDef.description}</p>
            </div>

            {/* أزرار السابق والتالي */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!prevElement}
                onClick={() => prevElement && setSelectedElementId(prevElement.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border transition ${
                  prevElement
                    ? "bg-[#0A3D2E] text-white border-[#C9A86A] hover:bg-[#0F4D3A] cursor-pointer"
                    : "opacity-40 bg-black/20 text-white/40 border-transparent cursor-not-allowed"
                }`}
                title="العنصر السابق"
              >
                ◀ السابق
              </button>
              <button
                type="button"
                disabled={!nextElement}
                onClick={() => nextElement && setSelectedElementId(nextElement.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border transition ${
                  nextElement
                    ? "bg-[#0A3D2E] text-white border-[#C9A86A] hover:bg-[#0F4D3A] cursor-pointer"
                    : "opacity-40 bg-black/20 text-white/40 border-transparent cursor-not-allowed"
                }`}
                title="العنصر التالي"
              >
                التالي ▶
              </button>
            </div>
          </div>

          {/* لوحة تحكم الإطار ككل أو الزر العادي */}
          {currentSelectedDef.isFrame ? (
            <DedicatedFrameInspector
              category={activeTab === "shop_card" ? "shopCard" : "customerCard"}
              frameConfig={activeTab === "shop_card" ? config.shopCard?.frameConfig : config.customerCard?.frameConfig}
              defaultBg={activeTab === "shop_card" ? shopFrameBg : custFrameBg}
              onChange={(field, val) =>
                updateFrameConfig(activeTab === "shop_card" ? "shopCard" : "customerCard", field, val)
              }
              onUploadImg={() => {
                triggerImageUpload((url) => {
                  setConfig((prev) =>
                    activeTab === "shop_card"
                      ? {
                          ...prev,
                          shopCard: {
                            ...prev.shopCard,
                            frameBgUrl: url,
                            frameConfig: { ...(prev.shopCard?.frameConfig || {}), bgUrl: url },
                          },
                        }
                      : {
                          ...prev,
                          customerCard: {
                            ...prev.customerCard,
                            frameBgUrl: url,
                            frameConfig: { ...(prev.customerCard?.frameConfig || {}), bgUrl: url },
                          },
                        }
                  );
                });
              }}
            />
          ) : (
            <DedicatedElementInspector
              elementDef={currentSelectedDef}
              config={currentSelectedConfig}
              onChange={(field, val) => {
                setConfig((prev) => currentSelectedDef.updateConfig(prev, field, val));
              }}
              onUploadImg={() => {
                triggerImageUpload((url) => {
                  setConfig((prev) => currentSelectedDef.setImageUrl(prev, url));
                });
              }}
            />
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 3. قائمة استعراض عناصر الكارت (Master Grid of Elements) */
        /* ========================================================================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[#F5D77F]">
              📑 اختر العنصر أو الإطار لتعديل أبعاده وتدويره في صفحة مخصصة:
            </h3>
            <span className="text-xs text-emerald-200 font-bold">
              {currentTabElements.length} عنصر قابل للتخصيص
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {currentTabElements.map((elem) => {
              if (elem.isFrame) {
                const currentFrameCfg =
                  elem.category === "shop_card"
                    ? config.shopCard?.frameConfig
                    : config.customerCard?.frameConfig;
                const currentBg =
                  currentFrameCfg?.bgUrl ||
                  (elem.category === "shop_card" ? shopFrameBg : custFrameBg);

                return (
                  <div
                    key={elem.id}
                    onClick={() => setSelectedElementId(elem.id)}
                    className="sm:col-span-2 lg:col-span-3 bg-gradient-to-r from-[#0F4D3A] via-[#164E3D] to-[#0A3D2E] border-2 border-amber-400/80 rounded-2xl p-4 shadow-xl hover:border-[#F5D77F] hover:shadow-2xl hover:scale-[1.01] transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-16 h-14 rounded-xl border-2 border-[#C9A86A] bg-black/60 flex items-center justify-center overflow-hidden shrink-0 p-1 relative shadow-inner">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentBg}
                          alt="الإطار"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>

                      <div>
                        <h4 className="font-black text-sm text-[#F5D77F] flex items-center gap-2">
                          <span>📐</span> {elem.title}
                        </h4>
                        <p className="text-xs text-emerald-100 mt-0.5 font-bold">
                          {elem.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl text-xs font-black shadow-lg hover:scale-105 transition flex items-center gap-1.5 shrink-0"
                    >
                      <span>⚙️</span> تخصيص أبعاد وطول وعرض الإطار
                    </button>
                  </div>
                );
              }

              const elemConfig = elem.getConfig(config);
              const currentImg = elemConfig?.imageUrl || elem.defaultImg;
              const hasCustomImg = Boolean(elemConfig?.imageUrl);
              const isRotated = elemConfig?.rotate && elemConfig.rotate !== 0;
              const isScaled = elemConfig?.scale && elemConfig.scale !== 1;

              return (
                <div
                  key={elem.id}
                  onClick={() => setSelectedElementId(elem.id)}
                  className="bg-[#0A3D2E]/90 border border-[#C9A86A]/50 rounded-2xl p-4 shadow-lg hover:border-[#F5D77F] hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl border border-[#C9A86A]/60 bg-black/50 flex items-center justify-center overflow-hidden shrink-0 p-1 relative">
                      {currentImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentImg}
                          alt={elem.title}
                          style={getElementStyle(elemConfig)}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-white/50">أصلي</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-xs sm:text-sm text-[#F5D77F] truncate group-hover:text-amber-300">
                        {elem.title}
                      </h4>
                      <p className="text-[10px] text-emerald-200 line-clamp-2 mt-0.5">
                        {elem.description}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[9px] font-bold">
                        {hasCustomImg && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            صورة مخصصة 🖼️
                          </span>
                        )}
                        {isRotated && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            تدوير {elemConfig?.rotate}° 🔄
                          </span>
                        )}
                        {isScaled && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            تكبير {Math.round((elemConfig?.scale ?? 1) * 100)}% 🔍
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2 bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] text-[#F5D77F] border border-[#C9A86A] rounded-xl text-xs font-black group-hover:from-amber-500 group-hover:to-[#C9A86A] group-hover:text-[#06281D] transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>✏️</span> فتح صفحة التعديل والتدوير
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

// لوحة التحكم المخصصة لإطار وخلفية الكارت ككل (تطويل، تقصير، تعريض، وضغط)
function DedicatedFrameInspector({
  category,
  frameConfig,
  defaultBg,
  onChange,
  onUploadImg,
}: {
  category: "shopCard" | "customerCard";
  frameConfig?: CustomFrameConfig;
  defaultBg: string;
  onChange: (field: keyof CustomFrameConfig, val: any) => void;
  onUploadImg: () => void;
}) {
  const currentBg = frameConfig?.bgUrl || defaultBg;
  const currentScale = frameConfig?.scale ?? 1;
  const currentScaleX = frameConfig?.scaleX ?? 1;
  const currentScaleY = frameConfig?.scaleY ?? 1;
  const currentMaxWidth = frameConfig?.maxWidth ?? 896; // max-w-4xl الافتراضي 896px
  const currentMinHeight = frameConfig?.minHeight ?? 240;
  const currentPaddingX = frameConfig?.paddingX ?? 24;
  const currentPaddingY = frameConfig?.paddingY ?? 24;
  const currentRadius = frameConfig?.borderRadius ?? 24;

  return (
    <div className="space-y-5">
      {/* صندوق معاينة وتغيير صورة الإطار */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-black/40 border border-[#C9A86A]/40 rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <div className="w-28 h-20 rounded-2xl border-2 border-[#C9A86A] bg-black/70 flex items-center justify-center overflow-hidden shrink-0 p-1 relative shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentBg}
              alt="صورة الإطار"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div>
            <h4 className="font-black text-sm text-[#F5D77F]">
              خلفية إطار الكارت ({category === "shopCard" ? "كارت المحل" : "كارت الزبون"})
            </h4>
            <p className="text-xs text-emerald-200 mt-0.5">
              الصورة المحيطة بالإطار الملكي الفاخر
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={onUploadImg}
            className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl text-xs font-black hover:scale-105 active:scale-95 transition cursor-pointer shadow-lg"
          >
            📤 رفع صورة إطار مخصصة (WEBP)
          </button>
          {frameConfig?.bgUrl && (
            <button
              type="button"
              onClick={() => onChange("bgUrl", "")}
              className="px-3 py-2 bg-rose-900/50 text-rose-200 border border-rose-500/50 rounded-xl text-xs font-bold hover:bg-rose-900/80 transition cursor-pointer"
            >
              استعادة الافتراضي
            </button>
          )}
        </div>
      </div>

      {/* نماذج أبعاد جاهزة بنقرة زر */}
      <div className="bg-black/30 p-3.5 rounded-2xl border border-[#C9A86A]/30 space-y-2">
        <label className="text-xs text-[#F5D77F] font-black block">
          ⚡ نماذج أبعاد سريعة بنقرة واحدة:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => {
              onChange("scale", 1);
              onChange("scaleX", 1);
              onChange("scaleY", 1);
              onChange("maxWidth", 896);
              onChange("minHeight", 240);
              onChange("paddingX", 24);
              onChange("paddingY", 24);
            }}
            className="p-2 bg-[#06281D] hover:bg-[#0F4D3A] rounded-xl border border-[#C9A86A] text-amber-300"
          >
            👑 الأبعاد الافتراضية
          </button>
          <button
            type="button"
            onClick={() => {
              onChange("scaleX", 1.15);
              onChange("scaleY", 0.95);
              onChange("maxWidth", 980);
              onChange("paddingX", 28);
            }}
            className="p-2 bg-[#06281D] hover:bg-[#0F4D3A] rounded-xl border border-[#C9A86A] text-white"
          >
            ↔️ كارت عريض
          </button>
          <button
            type="button"
            onClick={() => {
              onChange("scaleX", 0.95);
              onChange("scaleY", 1.2);
              onChange("minHeight", 340);
              onChange("paddingY", 32);
            }}
            className="p-2 bg-[#06281D] hover:bg-[#0F4D3A] rounded-xl border border-[#C9A86A] text-white"
          >
            ↕️ كارت طويل
          </button>
          <button
            type="button"
            onClick={() => {
              onChange("scale", 0.9);
              onChange("scaleX", 0.9);
              onChange("scaleY", 0.9);
              onChange("maxWidth", 750);
              onChange("paddingX", 16);
              onChange("paddingY", 16);
            }}
            className="p-2 bg-[#06281D] hover:bg-[#0F4D3A] rounded-xl border border-[#C9A86A] text-white"
          >
            📦 كارت مضغوط
          </button>
          <button
            type="button"
            onClick={() => {
              onChange("scaleX", 1.2);
              onChange("scaleY", 0.85);
              onChange("maxWidth", 1020);
            }}
            className="p-2 bg-[#06281D] hover:bg-[#0F4D3A] rounded-xl border border-[#C9A86A] text-white"
          >
            📐 عريض وقصير
          </button>
        </div>
      </div>

      {/* لوحات التحكم الدقيقة بأبعاد وطول وعرض الكارت ككل */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* ================= 1. تطويل وتقصير الكارت (الارتفاع الرأسي) ================= */}
        <div className="space-y-3 bg-black/30 p-3.5 rounded-2xl border border-[#C9A86A]/30">
          <h4 className="text-xs font-black text-[#F5D77F] flex items-center gap-1.5 border-b border-[#C9A86A]/20 pb-2">
            <span>↕️</span> تطويل وتقصير الكارت (الارتفاع الرأسي):
          </h4>

          {/* تمديد الارتفاع Scale Y */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-200 font-bold">تمديد طول الكارت (Scale Y):</span>
              <span className="font-mono text-emerald-300 font-bold">
                {Math.round(currentScaleY * 100)}%
              </span>
            </div>
            <input
              type="range"
              dir="ltr"
              min="0.5"
              max="2.5"
              step="0.05"
              value={currentScaleY}
              onChange={(e) => onChange("scaleY", parseFloat(e.target.value))}
              className="w-full accent-[#C9A86A] cursor-pointer"
            />
          </div>

          {/* الحد الأدنى للارتفاع Min-Height */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-200 font-bold">الارتفاع الأدنى (Min Height بالبكسل):</span>
              <span className="font-mono text-emerald-300 font-bold">{currentMinHeight}px</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange("minHeight", Math.max(150, currentMinHeight - 15))}
                className="px-2 py-1 bg-[#06281D] text-white rounded text-xs hover:bg-[#0F4D3A]"
              >
                -15px
              </button>
              <input
                type="range"
                dir="ltr"
                min="150"
                max="800"
                step="10"
                value={currentMinHeight}
                onChange={(e) => onChange("minHeight", parseInt(e.target.value))}
                className="flex-1 accent-[#C9A86A] cursor-pointer"
              />
              <button
                type="button"
                onClick={() => onChange("minHeight", Math.min(800, currentMinHeight + 15))}
                className="px-2 py-1 bg-[#06281D] text-white rounded text-xs hover:bg-[#0F4D3A]"
              >
                +15px
              </button>
            </div>
          </div>

          {/* هوامش أعلى وأسفل Padding Y */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-200 font-bold">مسافة أعلى وأسفل (Padding Y):</span>
              <span className="font-mono text-emerald-300 font-bold">{currentPaddingY}px</span>
            </div>
            <input
              type="range"
              dir="ltr"
              min="0"
              max="60"
              step="2"
              value={currentPaddingY}
              onChange={(e) => onChange("paddingY", parseInt(e.target.value))}
              className="w-full accent-[#C9A86A] cursor-pointer"
            />
          </div>
        </div>

        {/* ================= 2. تعريض وضغط الكارت (العرض الأفقي) ================= */}
        <div className="space-y-3 bg-black/30 p-3.5 rounded-2xl border border-[#C9A86A]/30">
          <h4 className="text-xs font-black text-[#F5D77F] flex items-center gap-1.5 border-b border-[#C9A86A]/20 pb-2">
            <span>↔️</span> تعريض وضغط الكارت (العرض الأفقي):
          </h4>

          {/* تمديد العرض Scale X */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-200 font-bold">تمديد عرض الكارت (Scale X):</span>
              <span className="font-mono text-emerald-300 font-bold">
                {Math.round(currentScaleX * 100)}%
              </span>
            </div>
            <input
              type="range"
              dir="ltr"
              min="0.5"
              max="2.5"
              step="0.05"
              value={currentScaleX}
              onChange={(e) => onChange("scaleX", parseFloat(e.target.value))}
              className="w-full accent-[#C9A86A] cursor-pointer"
            />
          </div>

          {/* العرض الأقصى Max-Width */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-200 font-bold">العرض الأقصى للكارت (Max Width):</span>
              <span className="font-mono text-emerald-300 font-bold">{currentMaxWidth}px</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange("maxWidth", Math.max(320, currentMaxWidth - 25))}
                className="px-2 py-1 bg-[#06281D] text-white rounded text-xs hover:bg-[#0F4D3A]"
              >
                -25px
              </button>
              <input
                type="range"
                dir="ltr"
                min="320"
                max="1200"
                step="20"
                value={currentMaxWidth}
                onChange={(e) => onChange("maxWidth", parseInt(e.target.value))}
                className="flex-1 accent-[#C9A86A] cursor-pointer"
              />
              <button
                type="button"
                onClick={() => onChange("maxWidth", Math.min(1200, currentMaxWidth + 25))}
                className="px-2 py-1 bg-[#06281D] text-white rounded text-xs hover:bg-[#0F4D3A]"
              >
                +25px
              </button>
            </div>
          </div>

          {/* هوامش يمين ويسار Padding X */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-200 font-bold">مسافة يمين ويسار (Padding X):</span>
              <span className="font-mono text-emerald-300 font-bold">{currentPaddingX}px</span>
            </div>
            <input
              type="range"
              dir="ltr"
              min="0"
              max="60"
              step="2"
              value={currentPaddingX}
              onChange={(e) => onChange("paddingX", parseInt(e.target.value))}
              className="w-full accent-[#C9A86A] cursor-pointer"
            />
          </div>
        </div>

        {/* ================= 3. تدوير زوايا الكارت والتكبير الكلي ================= */}
        <div className="space-y-3 bg-black/30 p-3.5 rounded-2xl border border-[#C9A86A]/30 md:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* تدوير الزوايا Border Radius */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-200 font-bold">تدوير زوايا الكارت (Border Radius):</span>
                <span className="font-mono text-emerald-300 font-bold">{currentRadius}px</span>
              </div>
              <input
                type="range"
                dir="ltr"
                min="0"
                max="50"
                step="2"
                value={currentRadius}
                onChange={(e) => onChange("borderRadius", parseInt(e.target.value))}
                className="w-full accent-[#C9A86A] cursor-pointer"
              />
            </div>

            {/* التكبير الكلي التناسبي */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-200 font-bold">التكبير الكلي للكارت ككل:</span>
                <span className="font-mono text-emerald-300 font-bold">
                  {Math.round(currentScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                dir="ltr"
                min="0.5"
                max="2"
                step="0.05"
                value={currentScale}
                onChange={(e) => onChange("scale", parseFloat(e.target.value))}
                className="w-full accent-[#C9A86A] cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// لوحة التحكم المفصلة للزر المنفرد (شاملة التدوير، الأبعاد، الإزاحة، والحجم)
function DedicatedElementInspector({
  elementDef,
  config,
  onChange,
  onUploadImg,
}: {
  elementDef: ElementDefinition;
  config?: CustomElementConfig;
  onChange: (field: keyof CustomElementConfig, val: any) => void;
  onUploadImg: () => void;
}) {
  const currentImg = config?.imageUrl || elementDef.defaultImg;
  const currentScale = config?.scale ?? 1;
  const currentScaleX = config?.scaleX ?? 1;
  const currentScaleY = config?.scaleY ?? 1;
  const currentRotate = config?.rotate ?? 0;
  const currentOffsetX = config?.offsetX ?? 0;
  const currentOffsetY = config?.offsetY ?? 0;
  const currentOrigin = config?.transformOrigin || "center";

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
    <div className="space-y-5">
      {/* صندوق معاينة العنصر ورفع الصورة */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-black/40 border border-[#C9A86A]/40 rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <div className="w-24 h-20 rounded-2xl border-2 border-[#C9A86A] bg-black/70 flex items-center justify-center overflow-hidden shrink-0 p-1 relative shadow-inner">
            {currentImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentImg}
                alt={elementDef.title}
                style={previewStyle}
                className="max-h-full max-w-full object-contain transition-transform duration-75"
              />
            ) : (
              <span className="text-xs text-white/50">أصلي</span>
            )}
          </div>

          <div>
            <h4 className="font-black text-sm text-[#F5D77F]">{elementDef.title}</h4>
            <p className="text-xs text-emerald-200 mt-0.5">
              معاينة مصغرة لحظية مع التدوير والتكبير والإزاحة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={onUploadImg}
            className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl text-xs font-black hover:scale-105 active:scale-95 transition cursor-pointer shadow-lg"
          >
            📤 رفع صورة مخصصة (قص الفراغات + WEBP)
          </button>
          {config?.imageUrl && (
            <button
              type="button"
              onClick={() => onChange("imageUrl", "")}
              className="px-3 py-2 bg-rose-900/50 text-rose-200 border border-rose-500/50 rounded-xl text-xs font-bold hover:bg-rose-900/80 transition cursor-pointer"
            >
              استعادة الأصلية
            </button>
          )}
        </div>
      </div>

      {/* أدوات التحكم الشاملة: تدوير، أبعاد، إزاحة، اتجاه */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* ================= 1. أداة التدوير (Rotation) ================= */}
        <div className="space-y-2.5 bg-black/30 p-3.5 rounded-2xl border border-[#C9A86A]/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F5D77F] font-black flex items-center gap-1.5">
              <span>🔄</span> زاوية تدوير الزر (Rotate):
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-amber-300 font-black text-sm">
                {currentRotate}°
              </span>
              {currentRotate !== 0 && (
                <button
                  type="button"
                  onClick={() => onChange("rotate", 0)}
                  className="text-[10px] text-rose-300 hover:underline cursor-pointer"
                >
                  (إعادة ضبط 0°)
                </button>
              )}
            </div>
          </div>

          <input
            type="range"
            dir="ltr"
            min="-180"
            max="180"
            step="1"
            value={currentRotate}
            onChange={(e) => onChange("rotate", parseInt(e.target.value))}
            className="w-full accent-[#C9A86A] cursor-pointer"
          />

          {/* أزرار التدوير السريعة */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => onChange("rotate", 0)}
              className={`text-[10px] py-1 rounded font-bold transition ${
                currentRotate === 0
                  ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm"
                  : "bg-[#06281D] text-white/90 hover:bg-[#0F4D3A]"
              }`}
            >
              0° معتدل
            </button>
            <button
              type="button"
              onClick={() => onChange("rotate", 90)}
              className={`text-[10px] py-1 rounded font-bold transition ${
                currentRotate === 90
                  ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm"
                  : "bg-[#06281D] text-white/90 hover:bg-[#0F4D3A]"
              }`}
            >
              90° عمودي
            </button>
            <button
              type="button"
              onClick={() => onChange("rotate", 180)}
              className={`text-[10px] py-1 rounded font-bold transition ${
                currentRotate === 180
                  ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm"
                  : "bg-[#06281D] text-white/90 hover:bg-[#0F4D3A]"
              }`}
            >
              180° مقلوب
            </button>
            <button
              type="button"
              onClick={() => onChange("rotate", -90)}
              className={`text-[10px] py-1 rounded font-bold transition ${
                currentRotate === -90
                  ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm"
                  : "bg-[#06281D] text-white/90 hover:bg-[#0F4D3A]"
              }`}
            >
              -90° عكسي
            </button>
          </div>

          <div className="flex items-center justify-between gap-1 pt-1 text-[10px]">
            <button
              type="button"
              onClick={() => onChange("rotate", currentRotate - 15)}
              className="px-2 py-1 bg-[#06281D] text-amber-200 rounded hover:bg-[#0F4D3A] cursor-pointer"
            >
              ⟲ -15°
            </button>
            <button
              type="button"
              onClick={() => onChange("rotate", currentRotate - 45)}
              className="px-2 py-1 bg-[#06281D] text-amber-200 rounded hover:bg-[#0F4D3A] cursor-pointer"
            >
              ⟲ -45°
            </button>
            <button
              type="button"
              onClick={() => onChange("rotate", currentRotate + 45)}
              className="px-2 py-1 bg-[#06281D] text-amber-200 rounded hover:bg-[#0F4D3A] cursor-pointer"
            >
              +45° ⟳
            </button>
            <button
              type="button"
              onClick={() => onChange("rotate", currentRotate + 15)}
              className="px-2 py-1 bg-[#06281D] text-amber-200 rounded hover:bg-[#0F4D3A] cursor-pointer"
            >
              +15° ⟳
            </button>
          </div>
        </div>

        {/* ================= 2. الحجم والتكبير الكلي ================= */}
        <div className="space-y-2.5 bg-black/30 p-3.5 rounded-2xl border border-[#C9A86A]/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F5D77F] font-black flex items-center gap-1.5">
              <span>🔍</span> التكبير الكلي (تناسبي):
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-emerald-300 font-black text-sm">
                {Math.round(currentScale * 100)}%
              </span>
              {currentScale !== 1 && (
                <button
                  type="button"
                  onClick={() => onChange("scale", 1)}
                  className="text-[10px] text-amber-300 hover:underline cursor-pointer"
                >
                  (100% طبيعي)
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

          <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px]">
            <button
              type="button"
              onClick={() => onChange("scale", 0.75)}
              className="py-1 rounded bg-[#06281D] text-white hover:bg-[#0F4D3A]"
            >
              75% مصغر
            </button>
            <button
              type="button"
              onClick={() => onChange("scale", 1)}
              className="py-1 rounded bg-[#06281D] text-white hover:bg-[#0F4D3A]"
            >
              100% أصلي
            </button>
            <button
              type="button"
              onClick={() => onChange("scale", 1.25)}
              className="py-1 rounded bg-[#06281D] text-white hover:bg-[#0F4D3A]"
            >
              125% مكبر
            </button>
            <button
              type="button"
              onClick={() => onChange("scale", 1.5)}
              className="py-1 rounded bg-[#06281D] text-white hover:bg-[#0F4D3A]"
            >
              150% كبير
            </button>
          </div>
        </div>

        {/* ================= 3. تحكم حر بالأبعاد (أفقي وعمودي) ================= */}
        <div className="space-y-2.5 bg-black/30 p-3.5 rounded-2xl border border-[#C9A86A]/30">
          <div className="text-xs font-black text-[#F5D77F] flex items-center justify-between">
            <span>📐 أبعاد حرة (تمديد العرض والارتفاع):</span>
            {(currentScaleX !== 1 || currentScaleY !== 1) && (
              <button
                type="button"
                onClick={() => {
                  onChange("scaleX", 1);
                  onChange("scaleY", 1);
                }}
                className="text-[10px] text-amber-300 hover:underline cursor-pointer"
              >
                (إعادة 100%)
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* تمديد العرض X */}
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

            {/* تمديد الارتفاع Y */}
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
        </div>

        {/* ================= 4. اتجاه الارتكاز والتمدد ================= */}
        <div className="space-y-2 bg-black/30 p-3.5 rounded-2xl border border-[#C9A86A]/30">
          <label className="text-xs text-[#F5D77F] font-black block">
            📍 اتجاه الارتكاز (من أين يتمدد أو يدور العنصر؟):
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

        {/* ================= 5. الإزاحة الأفقية X ================= */}
        <div className="space-y-2 bg-black/30 p-3.5 rounded-2xl border border-[#C9A86A]/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F5D77F] font-black">➡️ إزاحة أفقية (يمين / يسار):</span>
            <span className="font-mono text-emerald-300 font-black">
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
              className="px-2.5 py-1 bg-[#06281D] border border-[#C9A86A]/50 text-white rounded-lg text-xs font-bold hover:bg-[#0F4D3A] cursor-pointer"
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
              className="px-2.5 py-1 bg-[#06281D] border border-[#C9A86A]/50 text-white rounded-lg text-xs font-bold hover:bg-[#0F4D3A] cursor-pointer"
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

        {/* ================= 6. الإزاحة الرأسية Y ================= */}
        <div className="space-y-2 bg-black/30 p-3.5 rounded-2xl border border-[#C9A86A]/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F5D77F] font-black">↕️ إزاحة رأسية (أعلى / أسفل):</span>
            <span className="font-mono text-emerald-300 font-black">
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
              className="px-2.5 py-1 bg-[#06281D] border border-[#C9A86A]/50 text-white rounded-lg text-xs font-bold hover:bg-[#0F4D3A] cursor-pointer"
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
              className="px-2.5 py-1 bg-[#06281D] border border-[#C9A86A]/50 text-white rounded-lg text-xs font-bold hover:bg-[#0F4D3A] cursor-pointer"
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

        {/* ================= 7. نطاق الظهور والصلاحية ================= */}
        <div className="space-y-1.5 bg-black/30 p-3.5 rounded-2xl border border-[#C9A86A]/30 md:col-span-2">
          <label className="text-xs text-[#F5D77F] font-black block">
            👁️ نطاق ظهور هذا العنصر:
          </label>
          <select
            value={config?.visibility || "all"}
            onChange={(e) => onChange("visibility", e.target.value)}
            className="w-full bg-[#06281D] border border-[#C9A86A] rounded-xl text-xs p-2 text-white font-bold"
          >
            <option value="all">الكل (يظهر عند الإدارة والمندوب والمجهز)</option>
            <option value="admin">الإدارة فقط</option>
            <option value="admin_mandoub">الإدارة والمندوب فقط</option>
            <option value="admin_mandoub_preparer">الإدارة والمندوب والمجهز</option>
          </select>
        </div>
      </div>
    </div>
  );
}
