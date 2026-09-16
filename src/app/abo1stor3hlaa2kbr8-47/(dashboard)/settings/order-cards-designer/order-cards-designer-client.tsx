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

type TabType = "shop_card" | "customer_card" | "order_info" | "money_flow" | "wa_buttons" | "floating_btn";

type ElementDefinition = {
  id: string;
  title: string;
  category: TabType;
  defaultImg: string;
  description: string;
  isFrame?: boolean;
  isText?: boolean;
  previewTextSample?: string;
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
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewCardDisplay, setPreviewCardDisplay] = useState<"single" | "both">("single");
  const [isStickyPreview, setIsStickyPreview] = useState<boolean>(true);
  const [isCompactPreview, setIsCompactPreview] = useState<boolean>(false);
  const [showGuides, setShowGuides] = useState<boolean>(true); // خطوط المحاذاة الذكية
  const [copyNotification, setCopyNotification] = useState<{
    text: string;
    targetTab?: TabType;
  } | null>(null);

  // إخفاء إشعار النسخ تلقائياً بعد 5 ثوانٍ
  useEffect(() => {
    if (!copyNotification) return;
    const timer = setTimeout(() => {
      setCopyNotification(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [copyNotification]);

  // دالة لنسخ أبعاد ومقاسات الإطار فقط (تطويل، تقصير، تعريض، زوايا، وخلفية)
  const copyFrameDimensions = (from: "shop_card" | "customer_card", to: "shop_card" | "customer_card") => {
    const fromName = from === "shop_card" ? "كارت المحل (المرسل)" : "كارت الزبون (المستلم)";
    const toName = to === "shop_card" ? "كارت المحل (المرسل)" : "كارت الزبون (المستلم)";
    const sourceFrame = from === "shop_card" ? config.shopCard?.frameConfig : config.customerCard?.frameConfig;
    const sourceBg = from === "shop_card" ? config.shopCard?.frameBgUrl : config.customerCard?.frameBgUrl;

    if (!confirm(`هل أنت متأكد من نسخ أبعاد ومقاسات وخلفية (${fromName}) وتطبيقها فوراً على (${toName})؟`)) return;

    setConfig((prev) => {
      if (to === "customer_card") {
        return {
          ...prev,
          customerCard: {
            ...prev.customerCard,
            frameBgUrl: sourceBg || prev.customerCard?.frameBgUrl,
            frameConfig: sourceFrame ? JSON.parse(JSON.stringify(sourceFrame)) : undefined,
          },
        };
      } else {
        return {
          ...prev,
          shopCard: {
            ...prev.shopCard,
            frameBgUrl: sourceBg || prev.shopCard?.frameBgUrl,
            frameConfig: sourceFrame ? JSON.parse(JSON.stringify(sourceFrame)) : undefined,
          },
        };
      }
    });

    setCopyNotification({
      text: `تم بنجاح نسخ أبعاد ومقاسات وخلفية ${fromName} وتطبيقها على ${toName}! 📐`,
      targetTab: to,
    });
  };

  // دالة لنسخ كامل تصميم الكارت (أبعاد الإطار + مقاسات ومواقع وتدويرات كافة الأزرار)
  const copyFullCardDesign = (from: "shop_card" | "customer_card", to: "shop_card" | "customer_card") => {
    const fromName = from === "shop_card" ? "كارت المحل (المرسل)" : "كارت الزبون (المستلم)";
    const toName = to === "shop_card" ? "كارت المحل (المرسل)" : "كارت الزبون (المستلم)";

    if (!confirm(`هل أنت متأكد من نسخ كامل تصميم وأبعاد ومواقع وتكبيرات أزرار (${fromName}) وتطبيقها بالكامل على (${toName})؟`)) return;

    setConfig((prev) => {
      const copyElem = (elem?: CustomElementConfig, fallbackTarget?: CustomElementConfig): CustomElementConfig | undefined => {
        if (!elem) return fallbackTarget;
        return {
          ...elem,
          imageUrl: elem.imageUrl || fallbackTarget?.imageUrl,
        };
      };

      if (from === "shop_card" && to === "customer_card") {
        const src = prev.shopCard;
        return {
          ...prev,
          customerCard: {
            ...prev.customerCard,
            frameBgUrl: src?.frameBgUrl || prev.customerCard?.frameBgUrl,
            frameConfig: src?.frameConfig ? JSON.parse(JSON.stringify(src.frameConfig)) : undefined,
            headerCustomerInfo: copyElem(src?.headerShopInfo, prev.customerCard?.headerCustomerInfo),
            headerDoorPhoto: copyElem(src?.headerShopPhoto, prev.customerCard?.headerDoorPhoto),
            iconCustomerName: copyElem(src?.iconShopName, prev.customerCard?.iconCustomerName),
            textCustomerName: copyElem(src?.textShopName, prev.customerCard?.textCustomerName),
            iconRegion: copyElem(src?.iconRegion, prev.customerCard?.iconRegion),
            textRegion: copyElem(src?.textRegion, prev.customerCard?.textRegion),
            iconPhone: copyElem(src?.iconPhone, prev.customerCard?.iconPhone),
            textPhone: copyElem(src?.textPhone, prev.customerCard?.textPhone),
            btnLocation: copyElem(src?.btnShopLocation, prev.customerCard?.btnLocation),
            photoContainer: copyElem(src?.photoContainer, prev.customerCard?.photoContainer),
            placeholderNoPhoto: copyElem(src?.placeholderNoPhoto, prev.customerCard?.placeholderNoPhoto),
            btnCall: copyElem(src?.btnCall, prev.customerCard?.btnCall),
            btnWhatsapp: copyElem(src?.btnWhatsapp, prev.customerCard?.btnWhatsapp),
            btnCamera: copyElem(src?.btnCamera, prev.customerCard?.btnCamera),
            btnGallery: copyElem(src?.btnGallery, prev.customerCard?.btnGallery),
          },
        };
      } else {
        const src = prev.customerCard;
        return {
          ...prev,
          shopCard: {
            ...prev.shopCard,
            frameBgUrl: src?.frameBgUrl || prev.shopCard?.frameBgUrl,
            frameConfig: src?.frameConfig ? JSON.parse(JSON.stringify(src.frameConfig)) : undefined,
            headerShopInfo: copyElem(src?.headerCustomerInfo, prev.shopCard?.headerShopInfo),
            headerShopPhoto: copyElem(src?.headerDoorPhoto, prev.shopCard?.headerShopPhoto),
            iconShopName: copyElem(src?.iconCustomerName, prev.shopCard?.iconShopName),
            textShopName: copyElem(src?.textCustomerName, prev.shopCard?.textShopName),
            iconRegion: copyElem(src?.iconRegion, prev.shopCard?.iconRegion),
            textRegion: copyElem(src?.textRegion, prev.shopCard?.textRegion),
            iconPhone: copyElem(src?.iconPhone, prev.shopCard?.iconPhone),
            textPhone: copyElem(src?.textPhone, prev.shopCard?.textPhone),
            btnShopLocation: copyElem(src?.btnLocation, prev.shopCard?.btnShopLocation),
            photoContainer: copyElem(src?.photoContainer, prev.shopCard?.photoContainer),
            placeholderNoPhoto: copyElem(src?.placeholderNoPhoto, prev.shopCard?.placeholderNoPhoto),
            btnCall: copyElem(src?.btnCall, prev.shopCard?.btnCall),
            btnWhatsapp: copyElem(src?.btnWhatsapp, prev.shopCard?.btnWhatsapp),
            btnCamera: copyElem(src?.btnCamera, prev.shopCard?.btnCamera),
            btnGallery: copyElem(src?.btnGallery, prev.shopCard?.btnGallery),
          },
        };
      }
    });

    setCopyNotification({
      text: `تم بنجاح نسخ كامل تصميم ومقاسات ومواقع أزرار ${fromName} وتطبيقها على ${toName}! 🎨`,
      targetTab: to,
    });
  };

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
    category: "shopCard" | "customerCard" | "orderInfoCard" | "moneyFlowCard",
    field: keyof CustomFrameConfig,
    value: any
  ) => {
    setConfig((prev) => {
      const currentCategory = prev[category] || {};
      const currentFrame = (currentCategory as any).frameConfig || {};
      return {
        ...prev,
        [category]: {
          ...currentCategory,
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
      title: "أيقونة اسم المحل 🏪",
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
      id: "shop_textShopName",
      title: "✍️ نص اسم المحل",
      category: "shop_card",
      defaultImg: "",
      isText: true,
      previewTextSample: "أزياء الأمير الملكي",
      description: "التحكم بحجم، تكبير، تدوير، وإزاحة خط اسم المحل التجاري",
      getConfig: (c) => c.shopCard?.textShopName,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          textShopName: { ...(prev.shopCard?.textShopName || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
    },
    {
      id: "shop_iconCustomerName",
      title: "أيقونة اسم العميل / المسؤول 👤",
      category: "shop_card",
      defaultImg: "/images/order-luxury/shop-card/icon-customer-name.webp",
      description: "الأيقونة المجسمة لسطر صاحب المحل أو المسؤول",
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
      id: "shop_textCustomerName",
      title: "✍️ نص اسم صاحب المحل / المسؤول",
      category: "shop_card",
      defaultImg: "",
      isText: true,
      previewTextSample: "أحمد سامي (المدير)",
      description: "التحكم بحجم، تكبير، تدوير، وإزاحة خط اسم صاحب المحل",
      getConfig: (c) => c.shopCard?.textCustomerName,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          textCustomerName: { ...(prev.shopCard?.textCustomerName || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
    },
    {
      id: "shop_iconRegion",
      title: "أيقونة منطقة المحل 📍",
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
      id: "shop_textRegion",
      title: "✍️ نص منطقة المحل",
      category: "shop_card",
      defaultImg: "",
      isText: true,
      previewTextSample: "بغداد — الكرادة",
      description: "التحكم بحجم، تكبير، تدوير، وإزاحة خط منطقة المحل",
      getConfig: (c) => c.shopCard?.textRegion,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          textRegion: { ...(prev.shopCard?.textRegion || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
    },
    {
      id: "shop_iconPhone",
      title: "أيقونة هاتف المحل 📞",
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
      id: "shop_textPhone",
      title: "✍️ نص رقم هاتف المحل",
      category: "shop_card",
      defaultImg: "",
      isText: true,
      previewTextSample: "07701234567",
      description: "التحكم بحجم، تكبير، تدوير، وإزاحة خط رقم هاتف المحل",
      getConfig: (c) => c.shopCard?.textPhone,
      updateConfig: (prev, f, v) => ({
        ...prev,
        shopCard: {
          ...prev.shopCard,
          textPhone: { ...(prev.shopCard?.textPhone || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
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
      title: "أيقونة اسم الزبون 👤",
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
      id: "cust_textCustomerName",
      title: "✍️ نص اسم الزبون (المستلم)",
      category: "customer_card",
      defaultImg: "",
      isText: true,
      previewTextSample: "مريم علي (الزبون)",
      description: "التحكم بحجم، تكبير، تدوير، وإزاحة خط اسم الزبون المستلم",
      getConfig: (c) => c.customerCard?.textCustomerName,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          textCustomerName: { ...(prev.customerCard?.textCustomerName || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
    },
    {
      id: "cust_iconRegion",
      title: "أيقونة منطقة الزبون 📍",
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
      id: "cust_textRegion",
      title: "✍️ نص منطقة الزبون",
      category: "customer_card",
      defaultImg: "",
      isText: true,
      previewTextSample: "بغداد — المنصور",
      description: "التحكم بحجم، تكبير، تدوير، وإزاحة خط منطقة الزبون",
      getConfig: (c) => c.customerCard?.textRegion,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          textRegion: { ...(prev.customerCard?.textRegion || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
    },
    {
      id: "cust_iconPhone",
      title: "أيقونة هاتف الزبون 📞",
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
      id: "cust_textPhone",
      title: "✍️ نص هاتف الزبون",
      category: "customer_card",
      defaultImg: "",
      isText: true,
      previewTextSample: "07809876543",
      description: "التحكم بحجم، تكبير، تدوير، وإزاحة خط رقم هاتف الزبون",
      getConfig: (c) => c.customerCard?.textPhone,
      updateConfig: (prev, f, v) => ({
        ...prev,
        customerCard: {
          ...prev.customerCard,
          textPhone: { ...(prev.customerCard?.textPhone || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
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

  // تعريف عناصر كارت نوع وتفاصيل الطلبية
  const orderInfoElements: ElementDefinition[] = [
    {
      id: "orderInfo_frame",
      title: "🖼️ خلفية وإطار كارت نوع الطلبية (تطويل، تقصير، تعريض، وضغط)",
      category: "order_info",
      defaultImg: "/images/order-luxury/order-info-card/order-info-frame.jpg",
      description: "التحكم في أبعاد وخلفية كارت معلومات وتفاصيل الطلبية ككل",
      isFrame: true,
      getConfig: () => undefined,
      updateConfig: (prev) => prev,
      setImageUrl: (prev, url) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          frameBgUrl: url,
          frameConfig: { ...(prev.orderInfoCard?.frameConfig || {}), bgUrl: url },
        },
      }),
    },
    {
      id: "orderInfo_headerInfo",
      title: "كبسولة عنوان تفاصيل الطلب",
      category: "order_info",
      defaultImg: "/images/order-luxury/shop-card/header-shop-info.webp",
      description: "الشريط العلوي لتفاصيل الطلب والمبالغ",
      getConfig: (c) => c.orderInfoCard?.headerInfo,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          headerInfo: { ...(prev.orderInfoCard?.headerInfo || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          headerInfo: { ...(prev.orderInfoCard?.headerInfo || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "orderInfo_headerPhoto",
      title: "كبسولة عنوان صورة الطلبية",
      category: "order_info",
      defaultImg: "/images/order-luxury/shop-card/header-shop-photo.webp",
      description: "الشريط العلوي فوق صورة البضاعة والطلبية",
      getConfig: (c) => c.orderInfoCard?.headerPhoto,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          headerPhoto: { ...(prev.orderInfoCard?.headerPhoto || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          headerPhoto: { ...(prev.orderInfoCard?.headerPhoto || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "orderInfo_iconOrderBox",
      title: "أيقونة نوع ومحتوى الطلبية 📦",
      category: "order_info",
      defaultImg: "/images/order-luxury/order-info-card/icon-order-box.jpg",
      description: "الأيقونة المجسمة لسطر نوع الطلبية والبضاعة",
      getConfig: (c) => c.orderInfoCard?.iconOrderBox,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          iconOrderBox: { ...(prev.orderInfoCard?.iconOrderBox || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          iconOrderBox: { ...(prev.orderInfoCard?.iconOrderBox || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "orderInfo_textOrderType",
      title: "✍️ نص نوع الطلبية",
      category: "order_info",
      defaultImg: "",
      isText: true,
      previewTextSample: "ملابس نسائية فاخرة",
      description: "التحكم بحجم وتكبير وتدوير وإزاحة خط نوع الطلبية",
      getConfig: (c) => c.orderInfoCard?.textOrderType,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          textOrderType: { ...(prev.orderInfoCard?.textOrderType || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
    },
    {
      id: "orderInfo_iconClock",
      title: "أيقونة وقت وتاريخ الطلب ⏰",
      category: "order_info",
      defaultImg: "/images/order-luxury/order-info-card/icon-order-clock.jpg",
      description: "الأيقونة المجسمة لسطر وقت وتاريخ إضافة الطلب",
      getConfig: (c) => c.orderInfoCard?.iconClock,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          iconClock: { ...(prev.orderInfoCard?.iconClock || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          iconClock: { ...(prev.orderInfoCard?.iconClock || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "orderInfo_textOrderTime",
      title: "✍️ نص وقت وتاريخ الطلب",
      category: "order_info",
      defaultImg: "",
      isText: true,
      previewTextSample: "اليوم 04:30 م",
      description: "التحكم بحجم وتكبير وتدوير وإزاحة خط وقت وتاريخ الطلب",
      getConfig: (c) => c.orderInfoCard?.textOrderTime,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          textOrderTime: { ...(prev.orderInfoCard?.textOrderTime || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
    },
    {
      id: "orderInfo_iconCoins",
      title: "أيقونة العملات والمبالغ 🪙",
      category: "order_info",
      defaultImg: "/images/order-luxury/order-info-card/icon-order-coins.jpg",
      description: "الأيقونة المجسمة لسطر الحساب والأسعار",
      getConfig: (c) => c.orderInfoCard?.iconCoins,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          iconCoins: { ...(prev.orderInfoCard?.iconCoins || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          iconCoins: { ...(prev.orderInfoCard?.iconCoins || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "orderInfo_blockSubtotal",
      title: "✍️ شريط سعر المفرد (البضاعة)",
      category: "order_info",
      defaultImg: "",
      isText: true,
      previewTextSample: "سعر المفرد: 25,000 د.ع",
      description: "تخصيص حجم وموضع سطر سعر المفرد",
      getConfig: (c) => c.orderInfoCard?.blockSubtotal,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          blockSubtotal: { ...(prev.orderInfoCard?.blockSubtotal || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
    },
    {
      id: "orderInfo_blockDelivery",
      title: "✍️ شريط أجور التوصيل",
      category: "order_info",
      defaultImg: "",
      isText: true,
      previewTextSample: "أجور التوصيل: 5,000 د.ع",
      description: "تخصيص حجم وموضع سطر أجور التوصيل",
      getConfig: (c) => c.orderInfoCard?.blockDelivery,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          blockDelivery: { ...(prev.orderInfoCard?.blockDelivery || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
    },
    {
      id: "orderInfo_blockDebt",
      title: "✍️ شريط الدين السابق",
      category: "order_info",
      defaultImg: "",
      isText: true,
      previewTextSample: "الدين السابق: 0 د.ع",
      description: "تخصيص حجم وموضع سطر الدين السابق",
      getConfig: (c) => c.orderInfoCard?.blockDebt,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          blockDebt: { ...(prev.orderInfoCard?.blockDebt || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
    },
    {
      id: "orderInfo_blockTotal",
      title: "✍️ شريط الحساب الكلي الواصل",
      category: "order_info",
      defaultImg: "",
      isText: true,
      previewTextSample: "المجموع الكلي: 30,000 د.ع",
      description: "تخصيص حجم وموضع سطر المجموع الكلي النهائي الواصل",
      getConfig: (c) => c.orderInfoCard?.blockTotal,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          blockTotal: { ...(prev.orderInfoCard?.blockTotal || {}), [f]: v },
        },
      }),
      setImageUrl: (prev) => prev,
    },
    {
      id: "orderInfo_placeholderNoPhoto",
      title: "أيقونة لا توجد صورة طلبية",
      category: "order_info",
      defaultImg: "/images/order-luxury/shop-card/placeholder-no-photo.webp",
      description: "الشعار المعروض في حالة عدم رفع صورة للطلبية",
      getConfig: (c) => c.orderInfoCard?.placeholderNoPhoto,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          placeholderNoPhoto: { ...(prev.orderInfoCard?.placeholderNoPhoto || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          placeholderNoPhoto: { ...(prev.orderInfoCard?.placeholderNoPhoto || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "orderInfo_btnCamera",
      title: "زر تصوير الطلبية بالكاميرا 📷",
      category: "order_info",
      defaultImg: "/images/order-luxury/shop-card/btn-camera.webp",
      description: "زر التقاط صورة للبضاعة بالكاميرا",
      getConfig: (c) => c.orderInfoCard?.btnCamera,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          btnCamera: { ...(prev.orderInfoCard?.btnCamera || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          btnCamera: { ...(prev.orderInfoCard?.btnCamera || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "orderInfo_btnGallery",
      title: "زر اختيار صورة الطلبية من المعرض 🖼️",
      category: "order_info",
      defaultImg: "/images/order-luxury/shop-card/btn-gallery.webp",
      description: "زر اختيار صورة للبضاعة من الألبوم",
      getConfig: (c) => c.orderInfoCard?.btnGallery,
      updateConfig: (prev, f, v) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          btnGallery: { ...(prev.orderInfoCard?.btnGallery || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        orderInfoCard: {
          ...(prev.orderInfoCard || {}),
          btnGallery: { ...(prev.orderInfoCard?.btnGallery || {}), imageUrl: url },
        },
      }),
    },
  ];

  // تعريف عناصر شكل المعاملات المالية (الصادر والوارد)
  const moneyFlowElements: ElementDefinition[] = [
    {
      id: "money_frame",
      title: "🖼️ خلفية وبطاقة سجل المعاملة المالية",
      category: "money_flow",
      defaultImg: "/images/order-luxury/luxury-money-card-bg.jpg",
      description: "التحكم في أبعاد وخلفية إطار المعاملات المالية ككل",
      isFrame: true,
      getConfig: () => undefined,
      updateConfig: (prev) => prev,
      setImageUrl: (prev, url) => ({
        ...prev,
        moneyFlowCard: {
          ...(prev.moneyFlowCard || {}),
          frameBgUrl: url,
          frameConfig: { ...(prev.moneyFlowCard?.frameConfig || {}), bgUrl: url },
        },
      }),
    },
    {
      id: "money_badgeSader",
      title: "شارة وبطاقة حركة (صادر 💸)",
      category: "money_flow",
      defaultImg: "/images/order-luxury/badge-sader-royal.jpg",
      description: "الشارة الملكية المخصصة للمبالغ الصادرة المسلمة للعميل",
      getConfig: (c) => c.moneyFlowCard?.badgeSader,
      updateConfig: (prev, f, v) => ({
        ...prev,
        moneyFlowCard: {
          ...(prev.moneyFlowCard || {}),
          badgeSader: { ...(prev.moneyFlowCard?.badgeSader || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        moneyFlowCard: {
          ...(prev.moneyFlowCard || {}),
          badgeSader: { ...(prev.moneyFlowCard?.badgeSader || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "money_badgeWard",
      title: "شارة وبطاقة حركة (وارد 🫴)",
      category: "money_flow",
      defaultImg: "/images/order-luxury/badge-ward-royal.jpg",
      description: "الشارة الملكية المخصصة للمبالغ الواردة المقبوضة من الزبون",
      getConfig: (c) => c.moneyFlowCard?.badgeWard,
      updateConfig: (prev, f, v) => ({
        ...prev,
        moneyFlowCard: {
          ...(prev.moneyFlowCard || {}),
          badgeWard: { ...(prev.moneyFlowCard?.badgeWard || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        moneyFlowCard: {
          ...(prev.moneyFlowCard || {}),
          badgeWard: { ...(prev.moneyFlowCard?.badgeWard || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "money_btnSaderAction",
      title: "زر حركة أعطيت للعميل (صادر 💸)",
      category: "money_flow",
      defaultImg: "/images/order-luxury/badge-sader-royal.jpg",
      description: "الزر التفاعلي لتسجيل حركة تسليم أموال للعميل",
      getConfig: (c) => c.moneyFlowCard?.btnSaderAction,
      updateConfig: (prev, f, v) => ({
        ...prev,
        moneyFlowCard: {
          ...(prev.moneyFlowCard || {}),
          btnSaderAction: { ...(prev.moneyFlowCard?.btnSaderAction || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        moneyFlowCard: {
          ...(prev.moneyFlowCard || {}),
          btnSaderAction: { ...(prev.moneyFlowCard?.btnSaderAction || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "money_btnWardAction",
      title: "زر حركة أخذت من الزبون (وارد 🫴)",
      category: "money_flow",
      defaultImg: "/images/order-luxury/badge-ward-royal.jpg",
      description: "الزر التفاعلي لتسجيل حركة استلام أموال من الزبون",
      getConfig: (c) => c.moneyFlowCard?.btnWardAction,
      updateConfig: (prev, f, v) => ({
        ...prev,
        moneyFlowCard: {
          ...(prev.moneyFlowCard || {}),
          btnWardAction: { ...(prev.moneyFlowCard?.btnWardAction || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        moneyFlowCard: {
          ...(prev.moneyFlowCard || {}),
          btnWardAction: { ...(prev.moneyFlowCard?.btnWardAction || {}), imageUrl: url },
        },
      }),
    },
    {
      id: "money_btnDeleteAction",
      title: "زر حذف المعاملة 🗑️",
      category: "money_flow",
      defaultImg: "/images/order-luxury/shop-card/btn-call.webp",
      description: "أيقونة أو زر حذف المعاملة المالية من السجل",
      getConfig: (c) => c.moneyFlowCard?.btnDeleteAction,
      updateConfig: (prev, f, v) => ({
        ...prev,
        moneyFlowCard: {
          ...(prev.moneyFlowCard || {}),
          btnDeleteAction: { ...(prev.moneyFlowCard?.btnDeleteAction || {}), [f]: v },
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        moneyFlowCard: {
          ...(prev.moneyFlowCard || {}),
          btnDeleteAction: { ...(prev.moneyFlowCard?.btnDeleteAction || {}), imageUrl: url },
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

  // تعريف عنصر الزر العائم للاستلام والتسليم
  const floatingElements: ElementDefinition[] = [
    {
      id: "floating_action_btn",
      title: "🔘 الزر العائم للاستلام والتسليم",
      category: "floating_btn",
      defaultImg: "",
      description: "التحكم الكامل بالزر العائم للاستلام والتسليم، وتغيير صورته، لون النص والخلفية، وتكبير وتصغير وتدوير الزر",
      getConfig: (c) => ({
        imageUrl: c.floatingActionBtn?.imageUrl,
        scale: c.floatingActionBtn?.scale ?? 1,
        rotate: c.floatingActionBtn?.rotate ?? 0,
        offsetX: c.floatingActionBtn?.offsetX ?? 0,
        offsetY: c.floatingActionBtn?.offsetY ?? 0,
        hidden: c.floatingActionBtn?.hidden ?? false,
      }),
      updateConfig: (prev, f, v) => ({
        ...prev,
        floatingActionBtn: {
          ...(prev.floatingActionBtn || {}),
          [f]: v,
        },
      }),
      setImageUrl: (prev, url) => ({
        ...prev,
        floatingActionBtn: {
          ...(prev.floatingActionBtn || {}),
          imageUrl: url,
        },
      }),
    },
  ];

  const allElements = [
    ...shopElements,
    ...customerElements,
    ...orderInfoElements,
    ...moneyFlowElements,
    ...waElements,
    ...floatingElements,
  ];
  const currentTabElements =
    activeTab === "shop_card"
      ? shopElements
      : activeTab === "customer_card"
      ? customerElements
      : activeTab === "order_info"
      ? orderInfoElements
      : activeTab === "money_flow"
      ? moneyFlowElements
      : activeTab === "wa_buttons"
      ? waElements
      : floatingElements;

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

  const inspectorRef = useRef<HTMLDivElement>(null);

  // دالة موحدة لتحديد العنصر والانتقال الفوري والسلس للوحة إعداداته
  const handleSelectElement = (elementId: string, targetTab?: TabType) => {
    let finalTab = targetTab;
    if (!finalTab) {
      const found = allElements.find((e) => e.id === elementId);
      if (found?.category) {
        finalTab = found.category;
      }
    }
    if (finalTab && finalTab !== activeTab) {
      setActiveTab(finalTab);
    }
    setSelectedElementId(elementId);

    // تمرير سلس وتلقائي نحو لوحة إعدادات وسلايدرات العنصر المختار
    setTimeout(() => {
      if (inspectorRef.current) {
        inspectorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
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

      {/* الرأس الملكي العام والتبويبات - يظهران فقط في وضع استعراض كافة العناصر */}
      {!selectedElementId && (
        <>
          <div className="sticky top-2 z-30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-[#06281D] via-[#0A3D2E] to-[#06281D] p-3.5 sm:p-4 rounded-[22px] border-2 border-[#C9A86A] shadow-2xl backdrop-blur-md">
            <div>
              <h1 className="text-base sm:text-lg font-black text-[#F5D77F] flex items-center gap-2">
                <span>🎨</span> استوديو تصميم كروت الطلبات
              </h1>
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

          {/* خيارات تفعيل التصميم على البوابات المختلفة */}
          <div className="bg-[#06281D]/90 border-2 border-[#C9A86A] rounded-2xl p-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏛️</span>
                <h3 className="text-xs sm:text-sm font-black text-[#F5D77F]">تفعيل التصميم على البوابات</h3>
              </div>
              <span className="text-[10px] font-bold text-amber-300 bg-[#0A3D2E] px-2 py-0.5 rounded-lg border border-[#C9A86A]/40">
                حفظ فوري 💾
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* لوحة الإدارة */}
              <label className={`flex items-center justify-between p-2.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                config.enabledPortals?.admin !== false
                  ? "bg-[#0A3D2E] border-emerald-400 text-[#F5D77F] shadow-md"
                  : "bg-black/30 border-white/10 text-white/50 opacity-70"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">👑</span>
                  <span className="text-xs font-black">لوحة الإدارة</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabledPortals?.admin !== false}
                  onChange={(e) => {
                    setConfig((prev) => ({
                      ...prev,
                      enabledPortals: {
                        ...(prev.enabledPortals || { admin: true, mandoub: true, preparer: false }),
                        admin: e.target.checked,
                      },
                    }));
                  }}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </label>

              {/* بوابة المندوب */}
              <label className={`flex items-center justify-between p-2.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                config.enabledPortals?.mandoub !== false
                  ? "bg-[#0A3D2E] border-emerald-400 text-[#F5D77F] shadow-md"
                  : "bg-black/30 border-white/10 text-white/50 opacity-70"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">🚚</span>
                  <span className="text-xs font-black">بوابة المندوب</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabledPortals?.mandoub !== false}
                  onChange={(e) => {
                    setConfig((prev) => ({
                      ...prev,
                      enabledPortals: {
                        ...(prev.enabledPortals || { admin: true, mandoub: true, preparer: false }),
                        mandoub: e.target.checked,
                      },
                    }));
                  }}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </label>

              {/* بوابة المجهز */}
              <label className={`flex items-center justify-between p-2.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                config.enabledPortals?.preparer === true
                  ? "bg-[#0A3D2E] border-emerald-400 text-[#F5D77F] shadow-md"
                  : "bg-black/30 border-white/10 text-white/50 opacity-70"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">📦</span>
                  <span className="text-xs font-black">بوابة المجهز</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabledPortals?.preparer === true}
                  onChange={(e) => {
                    setConfig((prev) => ({
                      ...prev,
                      enabledPortals: {
                        ...(prev.enabledPortals || { admin: true, mandoub: true, preparer: false }),
                        preparer: e.target.checked,
                      },
                    }));
                  }}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* إشعار نجاح النسخ المنبثق الأنيق */}
          {copyNotification && (
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-[#06281D] border-2 border-emerald-400 p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl animate-bounce">✨</span>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-[#F5D77F]">{copyNotification.text}</h4>
                  <p className="text-[10px] text-emerald-200 mt-0.5 font-bold">تم حفظ التغييرات وتطبيقها على الكارت فوراً 💾</p>
                </div>
              </div>
              {copyNotification.targetTab && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(copyNotification.targetTab!);
                    setSelectedElementId(null);
                    setCopyNotification(null);
                  }}
                  className="px-3.5 py-2 bg-[#C9A86A] text-[#06281D] rounded-xl text-xs font-black hover:scale-105 transition cursor-pointer shrink-0 shadow-md flex items-center gap-1"
                >
                  <span>👁️</span> انتقال لمعاينة {copyNotification.targetTab === "customer_card" ? "كارت الزبون" : "كارت المحل"} 👈
                </button>
              )}
            </div>
          )}

          {/* التبويبات الرئيسية + أدوات نسخ وتطبيق الأبعاد + زر إعادة الضبط المصنعي */}
          <div className="flex items-center justify-between gap-2 border-b border-[#C9A86A]/40 pb-2 overflow-x-auto flex-wrap">
            <div className="flex items-center gap-2 overflow-x-auto">
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
                  setActiveTab("order_info");
                  setSelectedElementId(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "order_info"
                    ? "bg-[#C9A86A] text-[#06281D] shadow-lg scale-105"
                    : "bg-[#0A3D2E] text-[#F5D77F] hover:bg-[#0F4D3A]"
                }`}
              >
                📦 كارت نوع الطلبية
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("money_flow");
                  setSelectedElementId(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "money_flow"
                    ? "bg-[#C9A86A] text-[#06281D] shadow-lg scale-105"
                    : "bg-[#0A3D2E] text-[#F5D77F] hover:bg-[#0F4D3A]"
                }`}
              >
                💸 شكل المعاملة المالية
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
                💬 أزرار الواتساب
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("floating_btn");
                  setSelectedElementId(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "floating_btn"
                    ? "bg-[#C9A86A] text-[#06281D] shadow-lg scale-105"
                    : "bg-[#0A3D2E] text-[#F5D77F] hover:bg-[#0F4D3A]"
                }`}
              >
                🔘 الزر العائم
              </button>
            </div>

            {/* أزرار النسخ الذكي وإعادة الضبط */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* أزرار النسخ والتطبيق الفوري بين الكارتين */}
              {activeTab === "shop_card" && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyFrameDimensions("shop_card", "customer_card")}
                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-800 to-[#0A3D2E] border border-emerald-400 text-emerald-200 rounded-xl text-xs font-black hover:scale-105 active:scale-95 transition cursor-pointer shadow-md flex items-center gap-1 shrink-0 whitespace-nowrap"
                    title="نسخ أبعاد ومقاسات وخلفية إطار كارت المحل وتطبيقها على كارت الزبون"
                  >
                    <span>📐</span> نسخ أبعاد الإطار ⬅️ لكارت الزبون
                  </button>
                  <button
                    type="button"
                    onClick={() => copyFullCardDesign("shop_card", "customer_card")}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-[#C9A86A] text-[#06281D] border border-amber-300 rounded-xl text-xs font-black hover:scale-105 active:scale-95 transition cursor-pointer shadow-md flex items-center gap-1 shrink-0 whitespace-nowrap"
                    title="نسخ كامل تصميم وأبعاد ومواقع أزرار كارت المحل وتطبيقها على كارت الزبون"
                  >
                    <span>🎨</span> نسخ كامل التصميم ⬅️ لكارت الزبون
                  </button>
                </div>
              )}

              {activeTab === "customer_card" && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyFrameDimensions("customer_card", "shop_card")}
                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-800 to-[#0A3D2E] border border-emerald-400 text-emerald-200 rounded-xl text-xs font-black hover:scale-105 active:scale-95 transition cursor-pointer shadow-md flex items-center gap-1 shrink-0 whitespace-nowrap"
                    title="نسخ أبعاد ومقاسات وخلفية إطار كارت الزبون وتطبيقها على كارت المحل"
                  >
                    <span>📐</span> نسخ أبعاد الإطار ⬅️ لكارت المحل
                  </button>
                  <button
                    type="button"
                    onClick={() => copyFullCardDesign("customer_card", "shop_card")}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-[#C9A86A] text-[#06281D] border border-amber-300 rounded-xl text-xs font-black hover:scale-105 active:scale-95 transition cursor-pointer shadow-md flex items-center gap-1 shrink-0 whitespace-nowrap"
                    title="نسخ كامل تصميم وأبعاد ومواقع أزرار كارت الزبون وتطبيقها على كارت المحل"
                  >
                    <span>🎨</span> نسخ كامل التصميم ⬅️ لكارت المحل
                  </button>
                </div>
              )}

              {/* زر إعادة ضبط الكارت بالكامل للوضع المصنعي */}
              {activeTab !== "wa_buttons" && activeTab !== "floating_btn" && (
                <button
                  type="button"
                  onClick={() => {
                    const targetName =
                      activeTab === "shop_card"
                        ? "كارت المحل"
                        : activeTab === "customer_card"
                        ? "كارت الزبون"
                        : activeTab === "order_info"
                        ? "كارت نوع الطلبية"
                        : "شكل المعاملة المالية";
                    if (!confirm(`هل أنت متأكد من إعادة ضبط ${targetName} بالكامل للوضع المصنعي الأصلي؟`)) return;
                    if (activeTab === "shop_card") {
                      setConfig((prev) => ({
                        ...prev,
                        shopCard: { ...DEFAULT_DESIGNER_CONFIG.shopCard },
                      }));
                    } else if (activeTab === "customer_card") {
                      setConfig((prev) => ({
                        ...prev,
                        customerCard: { ...DEFAULT_DESIGNER_CONFIG.customerCard },
                      }));
                    } else if (activeTab === "order_info") {
                      setConfig((prev) => ({
                        ...prev,
                        orderInfoCard: { ...DEFAULT_DESIGNER_CONFIG.orderInfoCard },
                      }));
                    } else if (activeTab === "money_flow") {
                      setConfig((prev) => ({
                        ...prev,
                        moneyFlowCard: { ...DEFAULT_DESIGNER_CONFIG.moneyFlowCard },
                      }));
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-950/90 border border-rose-500/70 text-rose-200 rounded-xl text-xs font-black hover:bg-rose-900 transition hover:scale-105 active:scale-95 cursor-pointer shadow-md flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                  title="إعادة الكارت للوضع المصنعي الأصلي المعتدل 100%"
                >
                  <span>🔄</span> ضبط مصنعي
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 1. وضع التعديل الفردي المخصص (لوحة المعاينة مثبتة تماماً في الأعلى 100% وتمرير السلايدرات بالأسفل) */}
      {/* ========================================================================= */}
      {selectedElementId && currentSelectedDef ? (
        <div className="flex flex-col gap-3 min-h-[calc(100vh-140px)]">
          {/* لوحة المعاينة الحية العلوية - ثابتة 100% في مكانها لا تتأثر بالتمرير */}
          <div className="shrink-0 bg-[#06281D] border-2 border-[#C9A86A] rounded-2xl p-2.5 sm:p-4 shadow-2xl space-y-2 z-30">
            {/* 1. شريط أدوات الانتقال والرجوع والحفظ الفوري المدمج في سطر واحد */}
            <div className="flex items-center justify-between gap-1.5 border-b border-[#C9A86A]/40 pb-2">
              <button
                type="button"
                onClick={() => setSelectedElementId(null)}
                className="px-2.5 py-1 bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A] rounded-xl text-xs font-black hover:bg-[#0F4D3A] transition flex items-center gap-1 cursor-pointer shadow-md shrink-0 active:scale-95"
              >
                <span>◀</span> عودة للكروت
              </button>

              <div className="text-center min-w-0 px-1 flex-1">
                <h3 className="text-xs sm:text-sm font-black text-[#F5D77F] truncate flex items-center justify-center gap-1">
                  <span>✏️</span> {currentSelectedDef.title}
                </h3>
                <div className="flex items-center justify-center gap-1 text-[10px] mt-0.5">
                  {saveStatus === "saving" && (
                    <span className="text-amber-300 font-bold animate-pulse">🔄 جاري الحفظ...</span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="text-emerald-300 font-bold">✅ تم الحفظ تلقائياً</span>
                  )}
                  {saveStatus === "error" && (
                    <span className="text-rose-300 font-bold">❌ فشل الحفظ</span>
                  )}
                </div>
              </div>

              {/* أزرار السابق والتالي */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={!prevElement}
                  onClick={() => prevElement && setSelectedElementId(prevElement.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black border transition ${
                    prevElement
                      ? "bg-[#0A3D2E] text-white border-[#C9A86A] hover:bg-[#0F4D3A] cursor-pointer active:scale-95"
                      : "opacity-30 bg-black/20 text-white/30 border-transparent cursor-not-allowed"
                  }`}
                  title="العنصر السابق"
                >
                  ◀ السابق
                </button>
                <button
                  type="button"
                  disabled={!nextElement}
                  onClick={() => nextElement && setSelectedElementId(nextElement.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black border transition ${
                    nextElement
                      ? "bg-[#0A3D2E] text-white border-[#C9A86A] hover:bg-[#0F4D3A] cursor-pointer active:scale-95"
                      : "opacity-30 bg-black/20 text-white/30 border-transparent cursor-not-allowed"
                  }`}
                  title="العنصر التالي"
                >
                  التالي ▶
                </button>
              </div>
            </div>

            {/* 2. شريط خيارات المعاينة والزووم ونوع الشاشة والمحاذاة (مصعّد فوق المعاينة مباشرة) */}
            <div className="flex items-center justify-between px-1 text-[11px] text-emerald-200 flex-wrap gap-2 py-1 bg-black/30 rounded-xl border border-[#C9A86A]/20">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowGuides((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition flex items-center gap-1 border cursor-pointer ${
                    showGuides
                      ? "bg-amber-400 text-[#06281D] border-amber-400 shadow-sm"
                      : "bg-[#0A3D2E] text-white/70 border-[#C9A86A]/40 hover:text-white"
                  }`}
                  title="تفعيل أو إخفاء خطوط وشبكة المحاذاة الذكية"
                >
                  <span>📐</span> خطوط المحاذاة: {showGuides ? "مفعلة 🟢" : "معطلة ⚪"}
                </button>

                <button
                  type="button"
                  onClick={() => setIsCompactPreview((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition flex items-center gap-1 border cursor-pointer ${
                    isCompactPreview
                      ? "bg-emerald-500 text-white border-emerald-400 shadow-sm"
                      : "bg-[#0A3D2E] text-emerald-300 border-[#C9A86A]/40 hover:text-white"
                  }`}
                  title="تبديل حجم المعاينة لتوفير مساحة إضافية للسلايدرات"
                >
                  <span>{isCompactPreview ? "🔍 تكبير المعاينة" : "🤏 تصغير المعاينة"}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {/* أزرار تبديل عرض كارت واحد أو كلا الكارتين معاً */}
                {(activeTab === "shop_card" || activeTab === "customer_card") && (
                  <div className="flex items-center bg-[#0A3D2E] border border-[#C9A86A]/60 rounded-lg p-0.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPreviewCardDisplay("single")}
                      className={`px-2 py-0.5 rounded transition cursor-pointer ${previewCardDisplay === "single" ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm" : "text-white/80 hover:text-white"}`}
                      title="عرض الكارت المختار حالياً فقط للتركيز عليه"
                    >
                      🎴 {activeTab === "shop_card" ? "كارت المحل فقط" : "كارت الزبون فقط"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewCardDisplay("both")}
                      className={`px-2 py-0.5 rounded transition cursor-pointer ${previewCardDisplay === "both" ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm" : "text-white/80 hover:text-white"}`}
                      title="عرض كلا الكارتين معاً للتحقق من التناسق والتلاصق"
                    >
                      📑 كلا الكارتين معاً
                    </button>
                  </div>
                )}

                {/* أزرار نوع الشاشة: جوال / كمبيوتر */}
                <div className="flex items-center bg-[#0A3D2E] border border-[#C9A86A]/60 rounded-lg p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("mobile")}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${previewMode === "mobile" ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm" : "text-white/80 hover:text-white"}`}
                  >
                    📱 جوال
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("desktop")}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${previewMode === "desktop" ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm" : "text-white/80 hover:text-white"}`}
                  >
                    💻 كمبيوتر
                  </button>
                </div>

                {/* أزرار نسب الزووم */}
                <div className="flex items-center bg-[#0A3D2E] border border-[#C9A86A]/60 rounded-lg p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(0.7)}
                    className={`px-1.5 py-0.5 rounded transition cursor-pointer ${previewZoom === 0.7 ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm" : "text-white/80 hover:text-white"}`}
                  >
                    70%
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(0.85)}
                    className={`px-1.5 py-0.5 rounded transition cursor-pointer ${previewZoom === 0.85 ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm" : "text-white/80 hover:text-white"}`}
                  >
                    85%
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(1)}
                    className={`px-1.5 py-0.5 rounded transition cursor-pointer ${previewZoom === 1 ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm" : "text-white/80 hover:text-white"}`}
                  >
                    100%
                  </button>
                </div>
              </div>
            </div>

            {/* 3. بطاقة المعاينة الحية المباشرة (ثابتة في مكانها تحت الخيارات) */}
            <OrderCardsLivePreview
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              selectedElementId={selectedElementId}
              setSelectedElementId={setSelectedElementId}
              onSelectElement={handleSelectElement}
              config={config}
              showGuides={showGuides}
              previewMode={previewMode}
              previewZoom={isCompactPreview ? 0.65 : previewZoom}
              previewCardDisplay={previewCardDisplay}
              currentSelectedDef={currentSelectedDef}
              currentSelectedConfig={currentSelectedConfig}
              shopFrameBg={shopFrameBg}
              custFrameBg={custFrameBg}
              waButtons={waButtons}
            />
          </div>

          {/* لوحة السلايدرات والإعدادات بالأسفل - قابلة للتمرير الداخلي بحرية تامة دون تحريك المعاينة */}
          <div ref={inspectorRef} className="flex-1 overflow-y-auto max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-360px)] bg-gradient-to-b from-[#0A3D2E] to-[#06281D] border-2 border-[#C9A86A] rounded-[24px] p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {currentSelectedDef.isFrame ? (
              <DedicatedFrameInspector
                category={
                  activeTab === "shop_card"
                    ? "shopCard"
                    : activeTab === "customer_card"
                    ? "customerCard"
                    : activeTab === "order_info"
                    ? "orderInfoCard"
                    : "moneyFlowCard"
                }
                frameConfig={
                  activeTab === "shop_card"
                    ? config.shopCard?.frameConfig
                    : activeTab === "customer_card"
                    ? config.customerCard?.frameConfig
                    : activeTab === "order_info"
                    ? config.orderInfoCard?.frameConfig
                    : config.moneyFlowCard?.frameConfig
                }
                defaultBg={
                  activeTab === "shop_card"
                    ? shopFrameBg
                    : activeTab === "customer_card"
                    ? custFrameBg
                    : activeTab === "order_info"
                    ? "/images/order-luxury/order-info-card/order-info-frame.jpg"
                    : "/images/order-luxury/luxury-money-card-bg.jpg"
                }
                onChange={(field, val) =>
                  updateFrameConfig(
                    activeTab === "shop_card"
                      ? "shopCard"
                      : activeTab === "customer_card"
                      ? "customerCard"
                      : activeTab === "order_info"
                      ? "orderInfoCard"
                      : "moneyFlowCard",
                    field,
                    val
                  )
                }
                onCopyFrameDimensions={() => {
                  if (activeTab === "shop_card") {
                    copyFrameDimensions("shop_card", "customer_card");
                  } else if (activeTab === "customer_card") {
                    copyFrameDimensions("customer_card", "shop_card");
                  }
                }}
                onCopyFullCard={() => {
                  if (activeTab === "shop_card") {
                    copyFullCardDesign("shop_card", "customer_card");
                  } else if (activeTab === "customer_card") {
                    copyFullCardDesign("customer_card", "shop_card");
                  }
                }}
                targetCardLabel={
                  activeTab === "shop_card"
                    ? "كارت الزبون (المستلم)"
                    : activeTab === "customer_card"
                    ? "كارت المحل (المرسل)"
                    : undefined
                }
                onUploadImg={() => {
                  triggerImageUpload((url) => {
                    setConfig((prev) => {
                      if (activeTab === "shop_card") {
                        return {
                          ...prev,
                          shopCard: {
                            ...prev.shopCard,
                            frameBgUrl: url,
                            frameConfig: { ...(prev.shopCard?.frameConfig || {}), bgUrl: url },
                          },
                        };
                      } else if (activeTab === "customer_card") {
                        return {
                          ...prev,
                          customerCard: {
                            ...prev.customerCard,
                            frameBgUrl: url,
                            frameConfig: { ...(prev.customerCard?.frameConfig || {}), bgUrl: url },
                          },
                        };
                      } else if (activeTab === "order_info") {
                        return {
                          ...prev,
                          orderInfoCard: {
                            ...(prev.orderInfoCard || {}),
                            frameBgUrl: url,
                            frameConfig: { ...(prev.orderInfoCard?.frameConfig || {}), bgUrl: url },
                          },
                        };
                      } else {
                        return {
                          ...prev,
                          moneyFlowCard: {
                            ...(prev.moneyFlowCard || {}),
                            frameBgUrl: url,
                            frameConfig: { ...(prev.moneyFlowCard?.frameConfig || {}), bgUrl: url },
                          },
                        };
                      }
                    });
                  });
                }}
              />
            ) : selectedElementId === "floating_action_btn" ? (
              <DedicatedFloatingBtnInspector
                floatingConfig={config.floatingActionBtn}
                onChange={(field, val) => {
                  setConfig((prev) => ({
                    ...prev,
                    floatingActionBtn: {
                      ...(prev.floatingActionBtn || {}),
                      [field]: val,
                    },
                  }));
                }}
                onUploadImg={() => {
                  triggerImageUpload((url) => {
                    setConfig((prev) => ({
                      ...prev,
                      floatingActionBtn: {
                        ...(prev.floatingActionBtn || {}),
                        imageUrl: url,
                      },
                    }));
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
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. وضع استعراض كافة عناصر الكارت */
        /* ========================================================================= */
        <div className="space-y-6">

          {/* المعاينة الحية التفاعلية في وضع الاستعراض */}
          <div className="bg-[#06281D]/90 border-2 border-[#C9A86A] rounded-2xl p-3 sm:p-4 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#C9A86A]/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">👁️</span>
                <h3 className="text-xs sm:text-sm font-black text-[#F5D77F]">
                  المعاينة الحية
                </h3>
              </div>

              {/* شريط أدوات المعاينة */}
              <div className="flex items-center gap-2 flex-wrap text-[10px]">
                {/* أزرار تبديل عرض كارت مفرد أو كافة الكروت الثلاثة معاً */}
                {(activeTab === "shop_card" || activeTab === "customer_card" || activeTab === "order_info") && (
                  <div className="flex items-center bg-[#0A3D2E] border border-[#C9A86A]/60 rounded-lg p-0.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPreviewCardDisplay("single")}
                      className={`px-2 py-0.5 rounded transition cursor-pointer ${previewCardDisplay === "single" ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm" : "text-white/80 hover:text-white"}`}
                      title="عرض الكارت المختار حالياً فقط للتركيز عليه"
                    >
                      🎴 {activeTab === "shop_card" ? "كارت المحل فقط" : activeTab === "customer_card" ? "كارت الزبون فقط" : "كارت نوع الطلبية فقط"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewCardDisplay("both")}
                      className={`px-2 py-0.5 rounded transition cursor-pointer ${previewCardDisplay === "both" ? "bg-[#C9A86A] text-[#06281D] font-black shadow-sm" : "text-white/80 hover:text-white"}`}
                      title="عرض الكروت الثلاثة متصلة ومترابطة معاً للتحقق من التناسق والتلاصق التام"
                    >
                      📑 الكروت الثلاثة مترابطة معاً
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowGuides((prev) => !prev)}
                  className={`px-2 py-0.5 rounded-lg font-bold border transition ${
                    showGuides ? "bg-amber-400 text-[#06281D] border-amber-400 font-black" : "bg-[#0A3D2E] text-white/70 border-[#C9A86A]/40"
                  }`}
                >
                  📐 خطوط المحاذاة: {showGuides ? "مفعلة" : "معطلة"}
                </button>

                <div className="flex items-center bg-[#0A3D2E] border border-[#C9A86A]/60 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("mobile")}
                    className={`px-2 py-0.5 rounded transition ${previewMode === "mobile" ? "bg-[#C9A86A] text-[#06281D] font-black" : "text-white/80"}`}
                  >
                    📱 جوال
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("desktop")}
                    className={`px-2 py-0.5 rounded transition ${previewMode === "desktop" ? "bg-[#C9A86A] text-[#06281D] font-black" : "text-white/80"}`}
                  >
                    💻 كمبيوتر
                  </button>
                </div>

                <div className="flex items-center bg-[#0A3D2E] border border-[#C9A86A]/60 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(0.7)}
                    className={`px-1.5 py-0.5 rounded transition ${previewZoom === 0.7 ? "bg-[#C9A86A] text-[#06281D] font-black" : "text-white/80"}`}
                  >
                    70%
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(0.85)}
                    className={`px-1.5 py-0.5 rounded transition ${previewZoom === 0.85 ? "bg-[#C9A86A] text-[#06281D] font-black" : "text-white/80"}`}
                  >
                    85%
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(1)}
                    className={`px-1.5 py-0.5 rounded transition ${previewZoom === 1 ? "bg-[#C9A86A] text-[#06281D] font-black" : "text-white/80"}`}
                  >
                    100%
                  </button>
                </div>
              </div>
            </div>

            <OrderCardsLivePreview
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              selectedElementId={selectedElementId}
              setSelectedElementId={setSelectedElementId}
              onSelectElement={handleSelectElement}
              config={config}
              showGuides={showGuides}
              previewMode={previewMode}
              previewZoom={previewZoom}
              previewCardDisplay={previewCardDisplay}
              currentSelectedDef={currentSelectedDef}
              currentSelectedConfig={currentSelectedConfig}
              shopFrameBg={shopFrameBg}
              custFrameBg={custFrameBg}
              waButtons={waButtons}
            />
          </div>

          {/* قائمة استعراض عناصر الكارت */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-black text-[#F5D77F] flex items-center gap-1.5">
                <span>📑</span> عناصر الكارت ({currentTabElements.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {currentTabElements.map((elem) => {
                if (elem.isFrame) {
                  const currentFrameCfg =
                    elem.category === "shop_card"
                      ? config.shopCard?.frameConfig
                      : elem.category === "customer_card"
                      ? config.customerCard?.frameConfig
                      : elem.category === "order_info"
                      ? config.orderInfoCard?.frameConfig
                      : config.moneyFlowCard?.frameConfig;
                  const currentBg =
                    currentFrameCfg?.bgUrl ||
                    (elem.category === "shop_card"
                      ? shopFrameBg
                      : elem.category === "customer_card"
                      ? custFrameBg
                      : elem.category === "order_info"
                      ? "/images/order-luxury/order-info-card/order-info-frame.jpg"
                      : "/images/order-luxury/luxury-money-card-bg.jpg");

                  return (
                    <div
                      key={elem.id}
                      onClick={() => handleSelectElement(elem.id, elem.category)}
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
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl text-xs font-black shadow-lg hover:scale-105 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <span>⚙️</span> تخصيص أبعاد الإطار
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
                    onClick={() => handleSelectElement(elem.id, elem.category)}
                    className="bg-[#0A3D2E]/90 border border-[#C9A86A]/50 rounded-2xl p-4 shadow-lg hover:border-[#F5D77F] hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-xl border border-[#C9A86A]/60 bg-black/50 flex items-center justify-center overflow-hidden shrink-0 p-1 relative">
                        {elem.isText ? (
                          <div className="text-center p-1 overflow-hidden">
                            <span
                              style={getElementStyle(elemConfig)}
                              className="text-[11px] font-black text-[#F5D77F] drop-shadow-sm inline-block line-clamp-2"
                            >
                              {elem.previewTextSample || "نص"}
                            </span>
                          </div>
                        ) : currentImg ? (
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
                      className="w-full py-2 bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] text-[#F5D77F] border border-[#C9A86A] rounded-xl text-xs font-black group-hover:from-amber-500 group-hover:to-[#C9A86A] group-hover:text-[#06281D] transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span>✏️</span> فتح صفحة التعديل والتدوير
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// لوحة التحكم المخصصة لإطار وخلفية الكارت ككل (نظام شريط الأدوات الأفقي مثل برامج تعديل الصور)
// =============================================================================
function DedicatedFrameInspector({
  category,
  frameConfig,
  defaultBg,
  onChange,
  onUploadImg,
  onCopyFrameDimensions,
  onCopyFullCard,
  targetCardLabel,
}: {
  category: "shopCard" | "customerCard" | "orderInfoCard" | "moneyFlowCard";
  frameConfig?: CustomFrameConfig;
  defaultBg: string;
  onChange: (field: keyof CustomFrameConfig, val: any) => void;
  onUploadImg: () => void;
  onCopyFrameDimensions?: () => void;
  onCopyFullCard?: () => void;
  targetCardLabel?: string;
}) {
  const [activeTool, setActiveTool] = useState<
    "height" | "width" | "radius" | "scale" | "presets" | "bg" | "copy"
  >("height");

  const currentBg = frameConfig?.bgUrl || defaultBg;
  const currentScale = frameConfig?.scale ?? 1;
  const currentScaleX = frameConfig?.scaleX ?? 1;
  const currentScaleY = frameConfig?.scaleY ?? 1;
  const currentMaxWidth = frameConfig?.maxWidth ?? 896;
  const currentMinHeight = frameConfig?.minHeight ?? 240;
  const currentPaddingX = frameConfig?.paddingX ?? 24;
  const currentPaddingY = frameConfig?.paddingY ?? 24;
  const currentRadius = frameConfig?.borderRadius ?? 24;

  const frameTools = [
    {
      id: "height" as const,
      label: "طول الكارت",
      icon: "↕️",
      badge: currentScaleY !== 1 || currentMinHeight !== 240 ? `${Math.round(currentScaleY * 100)}%` : null,
    },
    {
      id: "width" as const,
      label: "عرض الكارت",
      icon: "↔️",
      badge: currentScaleX !== 1 || currentMaxWidth !== 896 ? `${Math.round(currentScaleX * 100)}%` : null,
    },
    {
      id: "radius" as const,
      label: "انحناء الزوايا",
      icon: "🔘",
      badge: currentRadius !== 24 ? `${currentRadius}px` : null,
    },
    {
      id: "scale" as const,
      label: "تكبير كلي",
      icon: "🔍",
      badge: currentScale !== 1 ? `${Math.round(currentScale * 100)}%` : null,
    },
    {
      id: "presets" as const,
      label: "نماذج جاهزة",
      icon: "⚡",
      badge: null,
    },
    {
      id: "bg" as const,
      label: "خلفية الإطار",
      icon: "🖼️",
      badge: frameConfig?.bgUrl ? "مخصصة" : null,
    },
    {
      id: "copy" as const,
      label: `نسخ لـ (${targetCardLabel ? targetCardLabel.split(" ")[1] || targetCardLabel : "الآخر"})`,
      icon: "📋",
      badge: "جديد ✨",
    },
  ];

  return (
    <div className="space-y-4">
      {/* شريط الأدوات الأفقي القابل للتمرير */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-[#F5D77F] font-black flex items-center gap-1.5">
            <span>🎛️</span> أدوات تحرير الإطار
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 px-1 scroll-smooth no-scrollbar">
          {frameTools.map((tool) => {
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveTool(tool.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-black shrink-0 transition-all cursor-pointer shadow-md relative ${
                  isActive
                    ? "bg-gradient-to-r from-amber-400 via-[#F5D77F] to-[#C9A86A] text-[#06281D] ring-2 ring-amber-300 shadow-amber-500/20 scale-105"
                    : "bg-[#0A3D2E] text-emerald-100 hover:bg-[#0F4D3A] border border-[#C9A86A]/40 hover:border-[#F5D77F]"
                }`}
              >
                <span className="text-base">{tool.icon}</span>
                <span>{tool.label}</span>
                {tool.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                      isActive ? "bg-[#06281D] text-[#F5D77F]" : "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                    }`}
                  >
                    {tool.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* لوحة السلايدر النشط المخصص فقط للأداة المختارة */}
      <div className="bg-black/40 border-2 border-[#C9A86A]/70 rounded-2xl p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* ================= 1. أداة طول الكارت ================= */}
        {activeTool === "height" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">↕️</span>
                <div>
                  <h4 className="font-black text-sm text-[#F5D77F]">تطويل وتقصير الكارت (الارتفاع الرأسي)</h4>
                  <p className="text-[11px] text-emerald-200">تحكم بمدى استطالة أو قصر الكارت بالكامل</p>
                </div>
              </div>
              {currentScaleY !== 1 && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("scaleY", 1);
                    onChange("minHeight", 240);
                    onChange("paddingY", 24);
                  }}
                  className="text-xs text-amber-300 bg-[#06281D] px-2.5 py-1 rounded-lg border border-amber-400/40 hover:underline cursor-pointer"
                >
                  إعادة ضبط 100%
                </button>
              )}
            </div>

            {/* سلايدر التمديد الرأسي مع أزرار الزائد والناقص */}
            <div className="space-y-2 bg-[#06281D]/80 p-3.5 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-200 font-bold">تمديد طول الكارت (Scale Y):</span>
                <span className="font-mono text-base font-black text-emerald-300 bg-black/60 px-3 py-1 rounded-lg border border-[#C9A86A]">
                  {Math.round(currentScaleY * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2" dir="ltr">
                <button
                  type="button"
                  onClick={() => onChange("scaleY", Math.max(0.5, parseFloat((currentScaleY - 0.05).toFixed(2))))}
                  className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
                >
                  ➖ تقصير (-5%)
                </button>
                <input
                  type="range"
                  dir="ltr"
                  min="0.5"
                  max="2.5"
                  step="0.05"
                  value={currentScaleY}
                  onChange={(e) => onChange("scaleY", parseFloat(e.target.value))}
                  className="flex-1 accent-[#C9A86A] cursor-pointer h-3 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => onChange("scaleY", Math.min(2.5, parseFloat((currentScaleY + 0.05).toFixed(2))))}
                  className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
                >
                  ➕ تطويل (+5%)
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1 text-xs">
                <button type="button" onClick={() => onChange("scaleY", 0.8)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">80% قصير</button>
                <button type="button" onClick={() => onChange("scaleY", 1.0)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">100% عادي</button>
                <button type="button" onClick={() => onChange("scaleY", 1.25)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">125% طويل</button>
                <button type="button" onClick={() => onChange("scaleY", 1.5)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">150% ممتد</button>
              </div>
            </div>

            {/* الارتفاع الأدنى Min Height */}
            <div className="space-y-2 bg-[#06281D]/80 p-3.5 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-200 font-bold">الارتفاع الأدنى (Min Height):</span>
                <span className="font-mono text-sm font-bold text-emerald-300">{currentMinHeight}px</span>
              </div>
              <div className="flex items-center gap-2" dir="ltr">
                <button type="button" onClick={() => onChange("minHeight", Math.max(150, currentMinHeight - 15))} className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-bold hover:bg-[#0F4D3A]">-15px</button>
                <input
                  type="range"
                  dir="ltr"
                  min="150"
                  max="800"
                  step="10"
                  value={currentMinHeight}
                  onChange={(e) => onChange("minHeight", parseInt(e.target.value))}
                  className="flex-1 accent-[#C9A86A] cursor-pointer h-2.5 rounded-lg"
                />
                <button type="button" onClick={() => onChange("minHeight", Math.min(800, currentMinHeight + 15))} className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-bold hover:bg-[#0F4D3A]">+15px</button>
              </div>
            </div>

            {/* هوامش أعلى وأسفل */}
            <div className="space-y-2 bg-[#06281D]/80 p-3.5 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-200 font-bold">المسافة الداخلية أعلى وأسفل (Padding Y):</span>
                <span className="font-mono text-sm font-bold text-emerald-300">{currentPaddingY}px</span>
              </div>
              <div className="flex items-center gap-2" dir="ltr">
                <button type="button" onClick={() => onChange("paddingY", Math.max(0, currentPaddingY - 2))} className="px-2.5 py-1 bg-[#0A3D2E] text-white rounded-lg text-xs font-bold hover:bg-[#0F4D3A]">-2px</button>
                <input
                  type="range"
                  dir="ltr"
                  min="0"
                  max="60"
                  step="2"
                  value={currentPaddingY}
                  onChange={(e) => onChange("paddingY", parseInt(e.target.value))}
                  className="w-full accent-[#C9A86A] cursor-pointer h-2.5 rounded-lg"
                />
                <button type="button" onClick={() => onChange("paddingY", Math.min(60, currentPaddingY + 2))} className="px-2.5 py-1 bg-[#0A3D2E] text-white rounded-lg text-xs font-bold hover:bg-[#0F4D3A]">+2px</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 2. أداة عرض الكارت ================= */}
        {activeTool === "width" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">↔️</span>
                <div>
                  <h4 className="font-black text-sm text-[#F5D77F]">تعريض وضغط الكارت (العرض الأفقي)</h4>
                  <p className="text-[11px] text-emerald-200">تحكم بمدى اتساع أو انضغاط الكارت أفقياً</p>
                </div>
              </div>
              {currentScaleX !== 1 && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("scaleX", 1);
                    onChange("maxWidth", 896);
                    onChange("paddingX", 24);
                  }}
                  className="text-xs text-amber-300 bg-[#06281D] px-2.5 py-1 rounded-lg border border-amber-400/40 hover:underline cursor-pointer"
                >
                  إعادة ضبط 100%
                </button>
              )}
            </div>

            {/* سلايدر التمديد الأفقي مع أزرار الزائد والناقص */}
            <div className="space-y-2 bg-[#06281D]/80 p-3.5 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-200 font-bold">تمديد عرض الكارت (Scale X):</span>
                <span className="font-mono text-base font-black text-emerald-300 bg-black/60 px-3 py-1 rounded-lg border border-[#C9A86A]">
                  {Math.round(currentScaleX * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2" dir="ltr">
                <button
                  type="button"
                  onClick={() => onChange("scaleX", Math.max(0.5, parseFloat((currentScaleX - 0.05).toFixed(2))))}
                  className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
                >
                  ◀ تضييق (-5%)
                </button>
                <input
                  type="range"
                  dir="ltr"
                  min="0.5"
                  max="2.5"
                  step="0.05"
                  value={currentScaleX}
                  onChange={(e) => onChange("scaleX", parseFloat(e.target.value))}
                  className="flex-1 accent-[#C9A86A] cursor-pointer h-3 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => onChange("scaleX", Math.min(2.5, parseFloat((currentScaleX + 0.05).toFixed(2))))}
                  className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
                >
                  (+5%) تعريض ▶
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1 text-xs">
                <button type="button" onClick={() => onChange("scaleX", 0.8)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">80% مضغوط</button>
                <button type="button" onClick={() => onChange("scaleX", 1.0)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">100% عادي</button>
                <button type="button" onClick={() => onChange("scaleX", 1.2)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">120% عريض</button>
                <button type="button" onClick={() => onChange("scaleX", 1.4)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">140% عريض جداً</button>
              </div>
            </div>

            {/* العرض الأقصى Max Width */}
            <div className="space-y-2 bg-[#06281D]/80 p-3.5 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-200 font-bold">العرض الأقصى (Max Width):</span>
                <span className="font-mono text-sm font-bold text-emerald-300">{currentMaxWidth}px</span>
              </div>
              <div className="flex items-center gap-2" dir="ltr">
                <button type="button" onClick={() => onChange("maxWidth", Math.max(320, currentMaxWidth - 25))} className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-bold hover:bg-[#0F4D3A]">-25px</button>
                <input
                  type="range"
                  dir="ltr"
                  min="320"
                  max="1200"
                  step="20"
                  value={currentMaxWidth}
                  onChange={(e) => onChange("maxWidth", parseInt(e.target.value))}
                  className="flex-1 accent-[#C9A86A] cursor-pointer h-2.5 rounded-lg"
                />
                <button type="button" onClick={() => onChange("maxWidth", Math.min(1200, currentMaxWidth + 25))} className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-bold hover:bg-[#0F4D3A]">+25px</button>
              </div>
            </div>

            {/* هوامش يمين ويسار */}
            <div className="space-y-2 bg-[#06281D]/80 p-3.5 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-200 font-bold">المسافة الداخلية يمين ويسار (Padding X):</span>
                <span className="font-mono text-sm font-bold text-emerald-300">{currentPaddingX}px</span>
              </div>
              <div className="flex items-center gap-2" dir="ltr">
                <button type="button" onClick={() => onChange("paddingX", Math.max(0, currentPaddingX - 2))} className="px-2.5 py-1 bg-[#0A3D2E] text-white rounded-lg text-xs font-bold hover:bg-[#0F4D3A]">-2px</button>
                <input
                  type="range"
                  dir="ltr"
                  min="0"
                  max="60"
                  step="2"
                  value={currentPaddingX}
                  onChange={(e) => onChange("paddingX", parseInt(e.target.value))}
                  className="w-full accent-[#C9A86A] cursor-pointer h-2.5 rounded-lg"
                />
                <button type="button" onClick={() => onChange("paddingX", Math.min(60, currentPaddingX + 2))} className="px-2.5 py-1 bg-[#0A3D2E] text-white rounded-lg text-xs font-bold hover:bg-[#0F4D3A]">+2px</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 3. أداة انحناء الزوايا ================= */}
        {activeTool === "radius" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔘</span>
                <div>
                  <h4 className="font-black text-sm text-[#F5D77F]">تدوير وانحناء زوايا الكارت (Border Radius)</h4>
                  <p className="text-[11px] text-emerald-200">تحكم بدرجة استدارة حواف الإطار الخارجي</p>
                </div>
              </div>
              <span className="font-mono text-base font-black text-emerald-300 bg-[#06281D] px-3 py-1 rounded-lg border border-[#C9A86A]">
                {currentRadius}px
              </span>
            </div>

            <div className="space-y-3 bg-[#06281D]/80 p-4 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center gap-2" dir="ltr">
                <button type="button" onClick={() => onChange("borderRadius", Math.max(0, currentRadius - 2))} className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black hover:bg-[#0F4D3A]">-2px</button>
                <input
                  type="range"
                  dir="ltr"
                  min="0"
                  max="60"
                  step="2"
                  value={currentRadius}
                  onChange={(e) => onChange("borderRadius", parseInt(e.target.value))}
                  className="flex-1 accent-[#C9A86A] cursor-pointer h-3 rounded-lg"
                />
                <button type="button" onClick={() => onChange("borderRadius", Math.min(60, currentRadius + 2))} className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black hover:bg-[#0F4D3A]">+2px</button>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1 text-xs">
                <button type="button" onClick={() => onChange("borderRadius", 0)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">0px حواف حادة</button>
                <button type="button" onClick={() => onChange("borderRadius", 16)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">16px خفيفة</button>
                <button type="button" onClick={() => onChange("borderRadius", 24)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">24px ملكي (أصلي)</button>
                <button type="button" onClick={() => onChange("borderRadius", 40)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">40px دائرية جداً</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 4. أداة التكبير الكلي ================= */}
        {activeTool === "scale" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <div>
                  <h4 className="font-black text-sm text-[#F5D77F]">التكبير الكلي التناسبي للكارت</h4>
                  <p className="text-[11px] text-emerald-200">تكبير أو تصغير الكارت بجميع عناصره ككتلة واحدة</p>
                </div>
              </div>
              <span className="font-mono text-base font-black text-emerald-300 bg-[#06281D] px-3 py-1 rounded-lg border border-[#C9A86A]">
                {Math.round(currentScale * 100)}%
              </span>
            </div>

            <div className="space-y-3 bg-[#06281D]/80 p-4 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center gap-2" dir="ltr">
                <button type="button" onClick={() => onChange("scale", Math.max(0.5, parseFloat((currentScale - 0.05).toFixed(2))))} className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black hover:bg-[#0F4D3A]">➖ -5%</button>
                <input
                  type="range"
                  dir="ltr"
                  min="0.5"
                  max="2"
                  step="0.05"
                  value={currentScale}
                  onChange={(e) => onChange("scale", parseFloat(e.target.value))}
                  className="flex-1 accent-[#C9A86A] cursor-pointer h-3 rounded-lg"
                />
                <button type="button" onClick={() => onChange("scale", Math.min(2, parseFloat((currentScale + 0.05).toFixed(2))))} className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black hover:bg-[#0F4D3A]">➕ +5%</button>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1 text-xs">
                <button type="button" onClick={() => onChange("scale", 0.75)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">75% مصغر</button>
                <button type="button" onClick={() => onChange("scale", 1)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">100% أصلي</button>
                <button type="button" onClick={() => onChange("scale", 1.25)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">125% مكبر</button>
                <button type="button" onClick={() => onChange("scale", 1.5)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">150% كبير جداً</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 5. نماذج جاهزة سريعة ================= */}
        {activeTool === "presets" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#C9A86A]/30 pb-2">
              <span className="text-xl">⚡</span>
              <div>
                <h4 className="font-black text-sm text-[#F5D77F]">نماذج أبعاد جاهزة بنقرة واحدة</h4>
                <p className="text-[11px] text-emerald-200">اختر قالباً جاهزاً ليتم تطبيق أبعاده ونسبه فوراً</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-bold">
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
                className="p-3.5 bg-[#06281D] hover:bg-[#0F4D3A] rounded-2xl border-2 border-[#C9A86A] text-amber-300 text-right space-y-1 hover:scale-105 transition"
              >
                <div className="text-base">👑 الأبعاد الملكية الافتراضية</div>
                <div className="text-[10px] text-emerald-200 font-normal">المقاس القياسي المتوازن 100%</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChange("scaleX", 1.18);
                  onChange("scaleY", 0.95);
                  onChange("maxWidth", 980);
                  onChange("paddingX", 28);
                }}
                className="p-3.5 bg-[#06281D] hover:bg-[#0F4D3A] rounded-2xl border border-[#C9A86A]/60 text-white text-right space-y-1 hover:scale-105 transition"
              >
                <div className="text-base">↔️ كارت عريض وأنيق</div>
                <div className="text-[10px] text-emerald-200 font-normal">تمدد أفقي إضافي 118%</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChange("scaleX", 0.95);
                  onChange("scaleY", 1.25);
                  onChange("minHeight", 340);
                  onChange("paddingY", 32);
                }}
                className="p-3.5 bg-[#06281D] hover:bg-[#0F4D3A] rounded-2xl border border-[#C9A86A]/60 text-white text-right space-y-1 hover:scale-105 transition"
              >
                <div className="text-base">↕️ كارت طويل وممتد</div>
                <div className="text-[10px] text-emerald-200 font-normal">استطالة رأسية 125%</div>
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
                className="p-3.5 bg-[#06281D] hover:bg-[#0F4D3A] rounded-2xl border border-[#C9A86A]/60 text-white text-right space-y-1 hover:scale-105 transition"
              >
                <div className="text-base">📦 كارت مدمج ومضغوط</div>
                <div className="text-[10px] text-emerald-200 font-normal">توفير مساحة وتصغير الحجم</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChange("scaleX", 1.25);
                  onChange("scaleY", 0.85);
                  onChange("maxWidth", 1050);
                }}
                className="p-3.5 bg-[#06281D] hover:bg-[#0F4D3A] rounded-2xl border border-[#C9A86A]/60 text-white text-right space-y-1 hover:scale-105 transition"
              >
                <div className="text-base">📐 عريض وقصير (بانوراما)</div>
                <div className="text-[10px] text-emerald-200 font-normal">عرض 125% وارتفاع 85%</div>
              </button>
            </div>
          </div>
        )}

        {/* ================= 6. أداة خلفية الإطار ================= */}
        {activeTool === "bg" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#C9A86A]/30 pb-2">
              <span className="text-xl">🖼️</span>
              <div>
                <h4 className="font-black text-sm text-[#F5D77F]">تغيير صورة وخلفية الإطار</h4>
                <p className="text-[11px] text-emerald-200">ارفع صورة جديدة للإطار ليتم قصها وضغطها وتحويلها إلى WEBP</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#06281D]/90 border border-[#C9A86A]/50 rounded-2xl p-4">
              <div className="flex items-center gap-4">
                <div className="w-24 h-16 rounded-xl border-2 border-[#C9A86A] bg-black/70 flex items-center justify-center overflow-hidden shrink-0 p-1 relative shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentBg} alt="الإطار" className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <h5 className="font-black text-xs text-[#F5D77F]">الصورة الحالية للإطار</h5>
                  <p className="text-[10px] text-emerald-200 mt-0.5">
                    {frameConfig?.bgUrl ? "تم رفع صورة إطار مخصصة" : "الإطار الملكي الافتراضي"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={onUploadImg}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl text-xs font-black hover:scale-105 active:scale-95 transition cursor-pointer shadow-lg"
                >
                  📤 رفع صورة إطار جديدة (WEBP)
                </button>
                {frameConfig?.bgUrl && (
                  <button
                    type="button"
                    onClick={() => onChange("bgUrl", "")}
                    className="px-3 py-2.5 bg-rose-900/50 text-rose-200 border border-rose-500/50 rounded-xl text-xs font-bold hover:bg-rose-900/80 transition cursor-pointer"
                  >
                    استعادة الافتراضي
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= 7. أداة نسخ وتطبيق الأبعاد والتصميم ================= */}
        {activeTool === "copy" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#C9A86A]/30 pb-2">
              <span className="text-xl">📋</span>
              <div>
                <h4 className="font-black text-sm text-[#F5D77F]">
                  نسخ الأبعاد والتصميم وتطبيقها على ({targetCardLabel || "الكارت الآخر"})
                </h4>
                <p className="text-[11px] text-emerald-200">
                  اختر نوع النسخ لتطبيق مقاسات أو تصميم هذا الكارت فوراً وبضغطة زر واحدة
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 bg-gradient-to-br from-[#06281D] to-[#0A3D2E] border-2 border-emerald-400/80 rounded-2xl flex flex-col justify-between gap-3 shadow-lg">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-300 font-black text-sm">
                    <span className="text-lg">📐</span>
                    <span>نسخ أبعاد ومقاسات الإطار فقط</span>
                  </div>
                  <p className="text-xs text-emerald-100/90 leading-relaxed font-bold">
                    ينسخ أبعاد الإطار (الطول، العرض، التكبير، انحناء الزوايا، الهوامش الداخلية، وخلفية الإطار) إلى ({targetCardLabel || "الكارت الآخر"}) مع الإبقاء على أزرار الزبون كما هي.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onCopyFrameDimensions}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs font-black shadow-md hover:scale-[1.02] active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>📐</span> تطبيق أبعاد الإطار على ({targetCardLabel ? targetCardLabel.split(" ")[1] || targetCardLabel : "الكارت الآخر"})
                </button>
              </div>

              <div className="p-4 bg-gradient-to-br from-[#06281D] to-[#0A3D2E] border-2 border-amber-400/80 rounded-2xl flex flex-col justify-between gap-3 shadow-lg">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[#F5D77F] font-black text-sm">
                    <span className="text-lg">🎨</span>
                    <span>نسخ كامل التصميم ومواقع الأزرار</span>
                  </div>
                  <p className="text-xs text-emerald-100/90 leading-relaxed font-bold">
                    ينسخ أبعاد الإطار + كافة مواقع وتكبيرات وتدويرات الأزرار والعناصر إلى ({targetCardLabel || "الكارت الآخر"}) ليصبح طبق الأصل في الدقة والتناسق الهندسي.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onCopyFullCard}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl text-xs font-black shadow-md hover:scale-[1.02] active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>🎨</span> نسخ كامل التصميم لكافة الأزرار
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// =============================================================================
// لوحة التحكم المفصلة للزر/النص المنفرد مع وحدة D-Pad وأزرار الزائد والناقص
// =============================================================================
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
  const [activeTool, setActiveTool] = useState<
    "rotate" | "scale" | "scaleX" | "scaleY" | "offsetX" | "offsetY" | "origin" | "image" | "visibility"
  >("rotate");

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

  const tools = [
    {
      id: "rotate" as const,
      label: "تدوير",
      icon: "🔄",
      badge: currentRotate !== 0 ? `${currentRotate}°` : null,
    },
    {
      id: "scale" as const,
      label: "تكبير كلي",
      icon: "🔍",
      badge: currentScale !== 1 ? `${Math.round(currentScale * 100)}%` : null,
    },
    {
      id: "scaleX" as const,
      label: "عرض أفقي",
      icon: "↔️",
      badge: currentScaleX !== 1 ? `${Math.round(currentScaleX * 100)}%` : null,
    },
    {
      id: "scaleY" as const,
      label: "طول عمودي",
      icon: "↕️",
      badge: currentScaleY !== 1 ? `${Math.round(currentScaleY * 100)}%` : null,
    },
    {
      id: "offsetX" as const,
      label: "إزاحة أفقية",
      icon: "➡️",
      badge: currentOffsetX !== 0 ? `${currentOffsetX > 0 ? `+${currentOffsetX}` : currentOffsetX}px` : null,
    },
    {
      id: "offsetY" as const,
      label: "إزاحة رأسية",
      icon: "⬇️",
      badge: currentOffsetY !== 0 ? `${currentOffsetY > 0 ? `+${currentOffsetY}` : currentOffsetY}px` : null,
    },
    {
      id: "origin" as const,
      label: "نقطة الارتكاز",
      icon: "📍",
      badge: currentOrigin !== "center" ? "مخصصة" : null,
    },
    ...(!elementDef.isText
      ? [
          {
            id: "image" as const,
            label: "الصورة",
            icon: "🖼️",
            badge: config?.imageUrl ? "مخصصة" : null,
          },
        ]
      : []),
    {
      id: "visibility" as const,
      label: "الظهور",
      icon: "👁️",
      badge: config?.visibility && config.visibility !== "all" ? "مقيد" : null,
    },
  ];

  const handleResetElementAll = () => {
    onChange("scale", 1);
    onChange("scaleX", 1);
    onChange("scaleY", 1);
    onChange("rotate", 0);
    onChange("offsetX", 0);
    onChange("offsetY", 0);
    onChange("width", 0);
    onChange("height", 0);
    onChange("transformOrigin", "center");
  };

  return (
    <div className="space-y-4">
      {/* صندوق معلومات العنصر المختار مع أزرار الإجراءات بدون معاينة مصغرة وبدون نصوص تعليمية زائدة */}
      <div className="flex items-center justify-between gap-2 bg-black/40 border border-[#C9A86A]/40 rounded-2xl p-2.5 sm:p-3">
        <h4 className="font-black text-xs sm:text-sm text-[#F5D77F] flex items-center gap-1.5 truncate">
          <span>✏️</span> {elementDef.title}
        </h4>

        <div className="flex items-center gap-1.5 shrink-0">
          {!elementDef.isText && (
            <button
              type="button"
              onClick={onUploadImg}
              className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl text-[11px] font-black hover:scale-105 active:scale-95 transition cursor-pointer shadow-md flex items-center gap-1"
            >
              <span>📤</span> رفع صورة
            </button>
          )}
          {config?.imageUrl && !elementDef.isText && (
            <button
              type="button"
              onClick={() => onChange("imageUrl", "")}
              className="px-2 py-1 bg-rose-900/50 text-rose-200 border border-rose-500/50 rounded-xl text-[11px] font-bold hover:bg-rose-900/80 transition cursor-pointer"
            >
              استعادة
            </button>
          )}
          <button
            type="button"
            onClick={handleResetElementAll}
            className="px-2.5 py-1 bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 rounded-xl text-[11px] font-black hover:bg-emerald-900 hover:text-white transition hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1 shadow-sm"
            title="إعادة ضبط الحجم والتدوير والموقع للوضع الافتراضي 100%"
          >
            <span>🔄</span> ضبط افتراضي
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* وحدة التحكم الاتجاهية الشاملة والدقيقة (Directional D-Pad Controller 🕹️) */}
      {/* ========================================================================= */}
      <div className="bg-[#06281D]/90 border border-[#C9A86A]/50 rounded-2xl p-2.5 sm:p-3.5 shadow-xl">
        <div className="flex items-center justify-between text-xs font-black text-[#F5D77F] mb-2.5 border-b border-[#C9A86A]/20 pb-1.5">
          <span className="flex items-center gap-1">
            <span>🕹️</span> الاتجاهات:
          </span>
          <span className="text-[10px] text-emerald-300 font-mono bg-black/60 px-2 py-0.5 rounded border border-[#C9A86A]/40">
            X: {currentOffsetX}px | Y: {currentOffsetY}px
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {/* أزرار الاتجاهات الخمسة مصفوفة بجانب بعضها أفقياً */}
          <div className="grid grid-cols-5 gap-1.5 w-full max-w-md mx-auto" dir="ltr">
            <button
              type="button"
              onClick={() => onChange("offsetX", currentOffsetX - 1)}
              className="py-2 px-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-emerald-200 rounded-xl border border-[#C9A86A]/60 font-black text-xs hover:scale-105 active:scale-95 transition shadow-sm flex flex-col items-center justify-center cursor-pointer"
              title="تحريك لليسار 1px"
            >
              <span className="text-sm">◀</span>
              <span className="text-[10px] mt-0.5">يسار</span>
            </button>

            <button
              type="button"
              onClick={() => onChange("offsetY", currentOffsetY - 1)}
              className="py-2 px-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-emerald-200 rounded-xl border border-[#C9A86A]/60 font-black text-xs hover:scale-105 active:scale-95 transition shadow-sm flex flex-col items-center justify-center cursor-pointer"
              title="تحريك لأعلى 1px"
            >
              <span className="text-sm">▲</span>
              <span className="text-[10px] mt-0.5">فوق</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onChange("offsetX", 0);
                onChange("offsetY", 0);
              }}
              className="py-2 px-1 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl font-black text-xs hover:scale-105 active:scale-95 transition shadow-md flex flex-col items-center justify-center cursor-pointer"
              title="إعادة ضبط للوسط (0,0)"
            >
              <span className="text-sm">🎯</span>
              <span className="text-[10px] mt-0.5 font-black">وسط</span>
            </button>

            <button
              type="button"
              onClick={() => onChange("offsetY", currentOffsetY + 1)}
              className="py-2 px-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-emerald-200 rounded-xl border border-[#C9A86A]/60 font-black text-xs hover:scale-105 active:scale-95 transition shadow-sm flex flex-col items-center justify-center cursor-pointer"
              title="تحريك لأسفل 1px"
            >
              <span className="text-sm">▼</span>
              <span className="text-[10px] mt-0.5">أسفل</span>
            </button>

            <button
              type="button"
              onClick={() => onChange("offsetX", currentOffsetX + 1)}
              className="py-2 px-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-emerald-200 rounded-xl border border-[#C9A86A]/60 font-black text-xs hover:scale-105 active:scale-95 transition shadow-sm flex flex-col items-center justify-center cursor-pointer"
              title="تحريك لليمين 1px"
            >
              <span className="text-sm">▶</span>
              <span className="text-[10px] mt-0.5">يمين</span>
            </button>
          </div>

          {/* أزرار التكبير/التصغير وأزرار الدوران بجانب بعضها مباشرة في نفس السطر */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 pt-2 border-t border-[#C9A86A]/20 flex-wrap" dir="ltr">
            {/* أزرار الحجم */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChange("scale", Math.max(0.3, parseFloat((currentScale - 0.05).toFixed(2))))}
                className="px-2.5 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer active:scale-95 transition"
                title="تصغير الحجم"
              >
                ➖ تصغير
              </button>
              <button
                type="button"
                onClick={() => onChange("scale", Math.min(3, parseFloat((currentScale + 0.05).toFixed(2))))}
                className="px-2.5 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer active:scale-95 transition"
                title="تكبير الحجم"
              >
                ➕ تكبير
              </button>
            </div>

            <div className="h-4 w-px bg-[#C9A86A]/30 mx-0.5 hidden sm:block" />

            {/* أزرار الدوران بجانب زري التكبير والتصغير */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChange("rotate", currentRotate - 5)}
                className="px-2.5 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer active:scale-95 transition"
                title="تدوير عكس عقارب الساعة 5 درجات"
              >
                ⟲ -5°
              </button>
              <button
                type="button"
                onClick={() => onChange("rotate", currentRotate + 5)}
                className="px-2.5 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer active:scale-95 transition"
                title="تدوير مع عقارب الساعة 5 درجات"
              >
                +5° ⟳
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* شريط أدوات التحكم السفلية بحجم مصغر ومدمج */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 px-0.5 scroll-smooth no-scrollbar">
          {tools.map((tool) => {
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveTool(tool.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black shrink-0 transition-all cursor-pointer shadow-sm relative ${
                  isActive
                    ? "bg-gradient-to-r from-amber-400 via-[#F5D77F] to-[#C9A86A] text-[#06281D] ring-2 ring-amber-300 shadow-amber-500/20 scale-105"
                    : "bg-[#0A3D2E] text-emerald-100 hover:bg-[#0F4D3A] border border-[#C9A86A]/40 hover:border-[#F5D77F]"
                }`}
              >
                <span className="text-xs sm:text-sm">{tool.icon}</span>
                <span>{tool.label}</span>
                {tool.badge && (
                  <span
                    className={`text-[8.5px] px-1 py-0.1 rounded-full font-mono font-black ${
                      isActive ? "bg-[#06281D] text-[#F5D77F]" : "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                    }`}
                  >
                    {tool.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* لوحة السلايدر النشط المخصص فقط للأداة المختارة */}
      <div className="bg-black/40 border-2 border-[#C9A86A]/70 rounded-2xl p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* ================= 1. أداة التدوير ================= */}
        {activeTool === "rotate" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔄</span>
                <div>
                  <h4 className="font-black text-sm text-[#F5D77F]">زاوية تدوير العنصر (Rotate)</h4>
                  <p className="text-[11px] text-emerald-200">اسحب الشريط لتدوير الزر من -180° إلى +180°</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-black text-amber-300 bg-[#06281D] px-3 py-1 rounded-lg border border-[#C9A86A]">
                  {currentRotate}°
                </span>
                {currentRotate !== 0 && (
                  <button
                    type="button"
                    onClick={() => onChange("rotate", 0)}
                    className="text-xs text-rose-300 bg-[#06281D] px-2.5 py-1 rounded-lg border border-rose-500/40 hover:underline cursor-pointer"
                  >
                    إعادة ضبط 0°
                  </button>
                )}
              </div>
            </div>

            {/* السلايدر الرئيسي مع أزرار الزائد والناقص */}
            <div className="space-y-3 bg-[#06281D]/80 p-4 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center gap-2" dir="ltr">
                <button
                  type="button"
                  onClick={() => onChange("rotate", currentRotate - 1)}
                  className="px-2.5 py-1.5 bg-[#0A3D2E] text-amber-200 rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
                  title="إنقاص درجة واحدة"
                >
                  ⟲ -1°
                </button>
                <input
                  type="range"
                  dir="ltr"
                  min="-180"
                  max="180"
                  step="1"
                  value={currentRotate}
                  onChange={(e) => onChange("rotate", parseInt(e.target.value))}
                  className="flex-1 accent-[#C9A86A] cursor-pointer h-3 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => onChange("rotate", currentRotate + 1)}
                  className="px-2.5 py-1.5 bg-[#0A3D2E] text-amber-200 rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
                  title="زيادة درجة واحدة"
                >
                  +1° ⟳
                </button>
              </div>

              {/* أزرار التدوير السريعة */}
              <div className="grid grid-cols-4 gap-2 text-xs font-bold pt-1">
                <button
                  type="button"
                  onClick={() => onChange("rotate", 0)}
                  className={`py-2 rounded-xl transition ${
                    currentRotate === 0
                      ? "bg-[#C9A86A] text-[#06281D] font-black shadow-md"
                      : "bg-[#0A3D2E] text-white hover:bg-[#0F4D3A]"
                  }`}
                >
                  0° معتدل
                </button>
                <button
                  type="button"
                  onClick={() => onChange("rotate", 90)}
                  className={`py-2 rounded-xl transition ${
                    currentRotate === 90
                      ? "bg-[#C9A86A] text-[#06281D] font-black shadow-md"
                      : "bg-[#0A3D2E] text-white hover:bg-[#0F4D3A]"
                  }`}
                >
                  90° عمودي
                </button>
                <button
                  type="button"
                  onClick={() => onChange("rotate", 180)}
                  className={`py-2 rounded-xl transition ${
                    currentRotate === 180
                      ? "bg-[#C9A86A] text-[#06281D] font-black shadow-md"
                      : "bg-[#0A3D2E] text-white hover:bg-[#0F4D3A]"
                  }`}
                >
                  180° مقلوب
                </button>
                <button
                  type="button"
                  onClick={() => onChange("rotate", -90)}
                  className={`py-2 rounded-xl transition ${
                    currentRotate === -90
                      ? "bg-[#C9A86A] text-[#06281D] font-black shadow-md"
                      : "bg-[#0A3D2E] text-white hover:bg-[#0F4D3A]"
                  }`}
                >
                  -90° عكسي
                </button>
              </div>

              {/* أزرار التدوير الدقيق */}
              <div className="flex items-center justify-between gap-1.5 pt-1 text-xs" dir="ltr">
                <button
                  type="button"
                  onClick={() => onChange("rotate", currentRotate - 45)}
                  className="flex-1 py-1.5 bg-[#0A3D2E] text-amber-200 rounded-lg hover:bg-[#0F4D3A] cursor-pointer font-bold"
                >
                  ⟲ -45°
                </button>
                <button
                  type="button"
                  onClick={() => onChange("rotate", currentRotate - 15)}
                  className="flex-1 py-1.5 bg-[#0A3D2E] text-amber-200 rounded-lg hover:bg-[#0F4D3A] cursor-pointer font-bold"
                >
                  ⟲ -15°
                </button>
                <button
                  type="button"
                  onClick={() => onChange("rotate", currentRotate + 15)}
                  className="flex-1 py-1.5 bg-[#0A3D2E] text-amber-200 rounded-lg hover:bg-[#0F4D3A] cursor-pointer font-bold"
                >
                  +15° ⟳
                </button>
                <button
                  type="button"
                  onClick={() => onChange("rotate", currentRotate + 45)}
                  className="flex-1 py-1.5 bg-[#0A3D2E] text-amber-200 rounded-lg hover:bg-[#0F4D3A] cursor-pointer font-bold"
                >
                  +45° ⟳
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 2. أداة التكبير الكلي ================= */}
        {activeTool === "scale" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <div>
                  <h4 className="font-black text-sm text-[#F5D77F]">التكبير والتصغير الكلي (تناسبي)</h4>
                  <p className="text-[11px] text-emerald-200">تكبير أو تصغير الحجم بنسبة متناسقة</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-black text-emerald-300 bg-[#06281D] px-3 py-1 rounded-lg border border-[#C9A86A]">
                  {Math.round(currentScale * 100)}%
                </span>
                {currentScale !== 1 && (
                  <button
                    type="button"
                    onClick={() => onChange("scale", 1)}
                    className="text-xs text-amber-300 bg-[#06281D] px-2.5 py-1 rounded-lg border border-amber-400/40 hover:underline cursor-pointer"
                  >
                    100% أصلي
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 bg-[#06281D]/80 p-4 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center gap-2" dir="ltr">
                <button
                  type="button"
                  onClick={() => onChange("scale", Math.max(0.3, parseFloat((currentScale - 0.05).toFixed(2))))}
                  className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
                >
                  ➖ تصغير (-5%)
                </button>
                <input
                  type="range"
                  dir="ltr"
                  min="0.3"
                  max="3"
                  step="0.05"
                  value={currentScale}
                  onChange={(e) => onChange("scale", parseFloat(e.target.value))}
                  className="flex-1 accent-[#C9A86A] cursor-pointer h-3 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => onChange("scale", Math.min(3, parseFloat((currentScale + 0.05).toFixed(2))))}
                  className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
                >
                  ➕ تكبير (+5%)
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1 text-xs">
                <button type="button" onClick={() => onChange("scale", 0.75)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">75% مصغر</button>
                <button type="button" onClick={() => onChange("scale", 1)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">100% أصلي</button>
                <button type="button" onClick={() => onChange("scale", 1.25)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">125% مكبر</button>
                <button type="button" onClick={() => onChange("scale", 1.5)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">150% كبير</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 3. أداة العرض الأفقي ================= */}
        {activeTool === "scaleX" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">↔️</span>
                <div>
                  <h4 className="font-black text-sm text-[#F5D77F]">تمديد العرض الأفقي فقط (Scale X)</h4>
                  <p className="text-[11px] text-emerald-200">تمطيط أو ضغط عرض العنصر أفقياً دون التأثير على الارتفاع</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-black text-emerald-300 bg-[#06281D] px-3 py-1 rounded-lg border border-[#C9A86A]">
                  {Math.round(currentScaleX * 100)}%
                </span>
                {currentScaleX !== 1 && (
                  <button
                    type="button"
                    onClick={() => onChange("scaleX", 1)}
                    className="text-xs text-amber-300 bg-[#06281D] px-2.5 py-1 rounded-lg border border-amber-400/40 hover:underline cursor-pointer"
                  >
                    100% أصلي
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 bg-[#06281D]/80 p-4 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center gap-2" dir="ltr">
                <button
                  type="button"
                  onClick={() => onChange("scaleX", Math.max(0.3, parseFloat((currentScaleX - 0.05).toFixed(2))))}
                  className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
                >
                  ◀ تضييق (-5%)
                </button>
                <input
                  type="range"
                  dir="ltr"
                  min="0.3"
                  max="3"
                  step="0.05"
                  value={currentScaleX}
                  onChange={(e) => onChange("scaleX", parseFloat(e.target.value))}
                  className="flex-1 accent-[#C9A86A] cursor-pointer h-3 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => onChange("scaleX", Math.min(3, parseFloat((currentScaleX + 0.05).toFixed(2))))}
                  className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
                >
                  (+5%) توسيع ▶
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1 text-xs">
                <button type="button" onClick={() => onChange("scaleX", 0.75)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">75% ضيق</button>
                <button type="button" onClick={() => onChange("scaleX", 1)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">100% أصلي</button>
                <button type="button" onClick={() => onChange("scaleX", 1.25)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">125% ممتد</button>
                <button type="button" onClick={() => onChange("scaleX", 1.5)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">150% عريض</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 4. أداة الطول العمودي ================= */}
        {activeTool === "scaleY" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">↕️</span>
                <div>
                  <h4 className="font-black text-sm text-[#F5D77F]">تمديد الارتفاع العمودي فقط (Scale Y)</h4>
                  <p className="text-[11px] text-emerald-200">تمطيط أو ضغط ارتفاع العنصر رأسياً دون التأثير على العرض</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-black text-emerald-300 bg-[#06281D] px-3 py-1 rounded-lg border border-[#C9A86A]">
                  {Math.round(currentScaleY * 100)}%
                </span>
                {currentScaleY !== 1 && (
                  <button
                    type="button"
                    onClick={() => onChange("scaleY", 1)}
                    className="text-xs text-amber-300 bg-[#06281D] px-2.5 py-1 rounded-lg border border-amber-400/40 hover:underline cursor-pointer"
                  >
                    100% أصلي
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 bg-[#06281D]/80 p-4 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center gap-2" dir="ltr">
                <button
                  type="button"
                  onClick={() => onChange("scaleY", Math.max(0.3, parseFloat((currentScaleY - 0.05).toFixed(2))))}
                  className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
                >
                  ▲ تقصير (-5%)
                </button>
                <input
                  type="range"
                  dir="ltr"
                  min="0.3"
                  max="3"
                  step="0.05"
                  value={currentScaleY}
                  onChange={(e) => onChange("scaleY", parseFloat(e.target.value))}
                  className="flex-1 accent-[#C9A86A] cursor-pointer h-3 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => onChange("scaleY", Math.min(3, parseFloat((currentScaleY + 0.05).toFixed(2))))}
                  className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
                >
                  (+5%) زيادة طول ▼
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1 text-xs">
                <button type="button" onClick={() => onChange("scaleY", 0.75)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">75% قصير</button>
                <button type="button" onClick={() => onChange("scaleY", 1)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">100% أصلي</button>
                <button type="button" onClick={() => onChange("scaleY", 1.25)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">125% طويل</button>
                <button type="button" onClick={() => onChange("scaleY", 1.5)} className="py-2 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">150% ممتد جداً</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 5. أداة الإزاحة الأفقية X ================= */}
        {activeTool === "offsetX" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">➡️</span>
                <div>
                  <h4 className="font-black text-sm text-[#F5D77F]">إزاحة أفقية (تحريك يمين / يسار)</h4>
                  <p className="text-[11px] text-emerald-200">الزر على اليسار يحرك يساراً، والزر على اليمين يحرك يميناً</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-black text-emerald-300 bg-[#06281D] px-3 py-1 rounded-lg border border-[#C9A86A]">
                  {currentOffsetX > 0
                    ? `+${currentOffsetX}px (يمين ▶)`
                    : currentOffsetX < 0
                    ? `${currentOffsetX}px (◀ يسار)`
                    : "0px (وسط)"}
                </span>
                {currentOffsetX !== 0 && (
                  <button
                    type="button"
                    onClick={() => onChange("offsetX", 0)}
                    className="text-xs text-amber-300 bg-[#06281D] px-2.5 py-1 rounded-lg border border-amber-400/40 hover:underline cursor-pointer"
                  >
                    إعادة للوسط 0px
                  </button>
                )}
              </div>
            </div>

            {/* الحاوية مضبوطة LTR: زر اليسار في اليسار وزر اليمين في اليمين */}
            <div className="space-y-3 bg-[#06281D]/80 p-4 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center gap-2" dir="ltr">
                <button
                  type="button"
                  onClick={() => onChange("offsetX", currentOffsetX - 2)}
                  className="px-3.5 py-2.5 bg-[#0A3D2E] border-2 border-[#C9A86A]/60 text-white rounded-xl text-xs font-black hover:bg-[#0F4D3A] cursor-pointer shadow-md active:scale-95"
                  title="تحريك يسار 2 بكسل"
                >
                  ◀ يسار (-2px)
                </button>

                <input
                  type="range"
                  dir="ltr"
                  min="-80"
                  max="80"
                  step="1"
                  value={currentOffsetX}
                  onChange={(e) => onChange("offsetX", parseInt(e.target.value))}
                  className="flex-1 accent-[#C9A86A] cursor-pointer h-3 rounded-lg"
                />

                <button
                  type="button"
                  onClick={() => onChange("offsetX", currentOffsetX + 2)}
                  className="px-3.5 py-2.5 bg-[#0A3D2E] border-2 border-[#C9A86A]/60 text-white rounded-xl text-xs font-black hover:bg-[#0F4D3A] cursor-pointer shadow-md active:scale-95"
                  title="تحريك يمين 2 بكسل"
                >
                  (+2px) يمين ▶
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1 text-xs" dir="ltr">
                <button type="button" onClick={() => onChange("offsetX", -20)} className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">◀ -20px</button>
                <button type="button" onClick={() => onChange("offsetX", 0)} className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-amber-300 font-black rounded-lg">0px وسط</button>
                <button type="button" onClick={() => onChange("offsetX", 10)} className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">+10px ▶</button>
                <button type="button" onClick={() => onChange("offsetX", 20)} className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">+20px ▶</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 6. أداة الإزاحة الرأسية Y ================= */}
        {activeTool === "offsetY" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">⬇️</span>
                <div>
                  <h4 className="font-black text-sm text-[#F5D77F]">إزاحة رأسية (تحريك أعلى / أسفل)</h4>
                  <p className="text-[11px] text-emerald-200">تحريك موقع العنصر عمودياً بالبكسل</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-black text-emerald-300 bg-[#06281D] px-3 py-1 rounded-lg border border-[#C9A86A]">
                  {currentOffsetY > 0
                    ? `+${currentOffsetY}px (أسفل ▼)`
                    : currentOffsetY < 0
                    ? `${currentOffsetY}px (▲ أعلى)`
                    : "0px (وسط)"}
                </span>
                {currentOffsetY !== 0 && (
                  <button
                    type="button"
                    onClick={() => onChange("offsetY", 0)}
                    className="text-xs text-amber-300 bg-[#06281D] px-2.5 py-1 rounded-lg border border-amber-400/40 hover:underline cursor-pointer"
                  >
                    إعادة للوسط 0px
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 bg-[#06281D]/80 p-4 rounded-xl border border-[#C9A86A]/30">
              <div className="flex items-center gap-2" dir="ltr">
                <button
                  type="button"
                  onClick={() => onChange("offsetY", currentOffsetY - 2)}
                  className="px-3.5 py-2.5 bg-[#0A3D2E] border-2 border-[#C9A86A]/60 text-white rounded-xl text-xs font-black hover:bg-[#0F4D3A] cursor-pointer shadow-md active:scale-95"
                  title="تحريك لأعلى 2 بكسل"
                >
                  ▲ أعلى (-2px)
                </button>

                <input
                  type="range"
                  dir="ltr"
                  min="-80"
                  max="80"
                  step="1"
                  value={currentOffsetY}
                  onChange={(e) => onChange("offsetY", parseInt(e.target.value))}
                  className="flex-1 accent-[#C9A86A] cursor-pointer h-3 rounded-lg"
                />

                <button
                  type="button"
                  onClick={() => onChange("offsetY", currentOffsetY + 2)}
                  className="px-3.5 py-2.5 bg-[#0A3D2E] border-2 border-[#C9A86A]/60 text-white rounded-xl text-xs font-black hover:bg-[#0F4D3A] cursor-pointer shadow-md active:scale-95"
                  title="تحريك لأسفل 2 بكسل"
                >
                  (+2px) أسفل ▼
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1 text-xs" dir="ltr">
                <button type="button" onClick={() => onChange("offsetY", -20)} className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">▲ -20px</button>
                <button type="button" onClick={() => onChange("offsetY", 0)} className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-amber-300 font-black rounded-lg">0px وسط</button>
                <button type="button" onClick={() => onChange("offsetY", 10)} className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">+10px ▼</button>
                <button type="button" onClick={() => onChange("offsetY", 20)} className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">+20px ▼</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 7. أداة نقطة الارتكاز ================= */}
        {activeTool === "origin" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9A86A]/30 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">📍</span>
                <div>
                  <h4 className="font-black text-sm text-[#F5D77F]">نقطة الارتكاز والتمدد والتدوير</h4>
                  <p className="text-[11px] text-emerald-200">حدد النقطة التي يدور أو يتمدد منها العنصر</p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-amber-300 bg-[#06281D] px-3 py-1 rounded-lg border border-[#C9A86A]">
                {origins.find((o) => o.value === currentOrigin)?.label || "🎯 الوسط"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 p-2 bg-[#06281D]/80 rounded-xl border border-[#C9A86A]/30">
              {origins.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onChange("transformOrigin", o.value)}
                  className={`text-xs py-3 px-2 rounded-xl font-bold transition ${
                    currentOrigin === o.value
                      ? "bg-gradient-to-r from-amber-400 to-[#C9A86A] text-[#06281D] shadow-lg font-black scale-105"
                      : "bg-[#0A3D2E] text-white/90 hover:bg-[#0F4D3A] border border-[#C9A86A]/20"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ================= 8. أداة الصورة المخصصة ================= */}
        {activeTool === "image" && !elementDef.isText && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#C9A86A]/30 pb-2">
              <span className="text-xl">🖼️</span>
              <div>
                <h4 className="font-black text-sm text-[#F5D77F]">الصورة المخصصة للزر أو الأيقونة</h4>
                <p className="text-[11px] text-emerald-200">ارفع أيقونة أو صورة مخصصة ليتم قصها وضغطها وتحويلها إلى WEBP</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#06281D]/90 border border-[#C9A86A]/50 rounded-2xl p-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-16 rounded-xl border-2 border-[#C9A86A] bg-black/70 flex items-center justify-center overflow-hidden shrink-0 p-1.5 relative shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentImg} alt={elementDef.title} className="max-h-full max-w-full object-contain" />
                </div>
                <div>
                  <h5 className="font-black text-xs text-[#F5D77F]">الصورة الحالية</h5>
                  <p className="text-[10px] text-emerald-200 mt-0.5">
                    {config?.imageUrl ? "صورة مخصصة مرفوعة" : "الأيقونة الأصلية للنظام"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={onUploadImg}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl text-xs font-black hover:scale-105 active:scale-95 transition cursor-pointer shadow-lg"
                >
                  📤 رفع صورة جديدة (WEBP)
                </button>
                {config?.imageUrl && (
                  <button
                    type="button"
                    onClick={() => onChange("imageUrl", "")}
                    className="px-3 py-2.5 bg-rose-900/50 text-rose-200 border border-rose-500/50 rounded-xl text-xs font-bold hover:bg-rose-900/80 transition cursor-pointer"
                  >
                    استعادة الأصلية
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= 9. أداة نطاق الظهور ================= */}
        {activeTool === "visibility" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#C9A86A]/30 pb-2">
              <span className="text-xl">👁️</span>
              <div>
                <h4 className="font-black text-sm text-[#F5D77F]">نطاق وصلاحية ظهور هذا العنصر</h4>
                <p className="text-[11px] text-emerald-200">حدد من يمتلك صلاحية رؤية واستخدام هذا الزر</p>
              </div>
            </div>

            <div className="space-y-2 bg-[#06281D]/80 p-4 rounded-xl border border-[#C9A86A]/30">
              <select
                value={config?.visibility || "all"}
                onChange={(e) => onChange("visibility", e.target.value)}
                className="w-full bg-[#0A3D2E] border-2 border-[#C9A86A] rounded-xl text-xs p-3 text-white font-bold cursor-pointer"
              >
                <option value="all">👑 الكل (يظهر عند الإدارة والمندوب والمجهز)</option>
                <option value="admin">🔒 الإدارة فقط</option>
                <option value="admin_mandoub">🚚 الإدارة والمندوب فقط</option>
                <option value="admin_mandoub_preparer">📦 الإدارة والمندوب والمجهز</option>
              </select>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// =============================================================================
// مكون المعاينة الحية الموحدة والتفاعلية 100% لكروت الطلبات وأزرار الواتساب
// =============================================================================
function OrderCardsLivePreview({
  activeTab,
  setActiveTab,
  selectedElementId,
  setSelectedElementId,
  onSelectElement,
  config,
  showGuides,
  previewMode,
  previewZoom,
  previewCardDisplay = "single",
  currentSelectedDef,
  currentSelectedConfig,
  shopFrameBg,
  custFrameBg,
  waButtons,
}: {
  activeTab: TabType;
  setActiveTab?: (tab: TabType) => void;
  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;
  onSelectElement?: (id: string, tab?: TabType) => void;
  config: OrderCardDesignerConfig;
  showGuides: boolean;
  previewMode: "mobile" | "desktop";
  previewZoom: number;
  previewCardDisplay?: "single" | "both";
  currentSelectedDef?: ElementDefinition;
  currentSelectedConfig?: CustomElementConfig;
  shopFrameBg: string;
  custFrameBg: string;
  waButtons: any[];
}) {
  const shopCustom = config.shopCard;
  const custCustom = config.customerCard;
  const showShopCard = previewCardDisplay === "both" || activeTab === "shop_card";
  const showCustomerCard = previewCardDisplay === "both" || activeTab === "customer_card";
  const showOrderInfoCard = previewCardDisplay === "both" || activeTab === "order_info";

  // دالة موحدة للتفاعل مع أي عنصر من المعاينة
  const handleElementClick = (e: React.MouseEvent, elemId: string, tab?: TabType) => {
    e.stopPropagation();
    if (onSelectElement) {
      onSelectElement(elemId, tab);
    } else {
      if (tab && setActiveTab) setActiveTab(tab);
      setSelectedElementId(elemId);
    }
  };

  return (
    <div className={`w-full flex justify-center p-2 sm:p-3 bg-black/70 rounded-2xl border border-[#C9A86A]/40 overflow-x-auto ${
      selectedElementId ? "max-h-[44vh] sm:max-h-[48vh] overflow-y-auto" : "overflow-visible"
    }`}>
      <div
        className="w-full transition-all duration-150 flex flex-col items-center justify-start"
        style={{
          width: previewMode === "mobile" ? "100%" : "100%",
          maxWidth: previewMode === "mobile" ? "430px" : "100%",
          transform: previewZoom !== 1 ? `scale(${previewZoom})` : undefined,
          transformOrigin: "top center",
        }}
      >
        {/* معاينة الكروت الفاخرة (كارت المحل، كارت الزبون، وكارت نوع الطلبية مترابطة بدون أي فواصل) */}
        {(activeTab === "shop_card" || activeTab === "customer_card" || activeTab === "order_info") && (
          <div className="flex flex-col gap-0 w-full">
            {/* 1. كارت المحل في المعاينة */}
            {showShopCard && (
            <div
              onClick={(e) => handleElementClick(e, "shop_frame", "shop_card")}
              className={`relative w-full rounded-[22px] sm:rounded-[28px] bg-no-repeat bg-[length:100%_100%] shadow-2xl overflow-hidden p-3.5 sm:p-6 md:p-7 transition-all mx-auto cursor-pointer ${
                selectedElementId === "shop_frame"
                  ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-black shadow-[0_0_15px_rgba(245,215,127,0.7)]"
                  : activeTab === "shop_card"
                  ? "ring-1 ring-amber-400/50 hover:ring-2 hover:ring-amber-400/80"
                  : "opacity-85 hover:opacity-100 hover:ring-1 hover:ring-amber-400/40"
              }`}
              style={getCardContainerStyle(shopCustom?.frameConfig, shopFrameBg)}
              title="انقر لفتح إعدادات وتخصيص خلفية وأبعاد إطار كارت المحل"
            >
              {/* طبقة خطوط وشبكة المحاذاة الذكية */}
              {showGuides && activeTab === "shop_card" && (
                <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0 border-r border-dashed border-amber-400/40" />
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0 border-b border-dashed border-amber-400/40" />
                  <div className="absolute left-4 right-4 bottom-[18%] h-0 border-b border-dotted border-emerald-400/30" />

                  {selectedElementId && (
                    <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
                      <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded bg-black/80 text-amber-300 border border-amber-400/50 shadow-md">
                        📐 محاذاة نشطة: {currentSelectedDef?.title}
                      </span>
                      {currentSelectedConfig && (
                        <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded bg-[#06281D]/90 text-emerald-300 border border-emerald-400/50 shadow-md">
                          X: {currentSelectedConfig.offsetX || 0}px | Y: {currentSelectedConfig.offsetY || 0}px
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:gap-7 items-start min-w-0 relative z-10">
                {/* الجانب الأيمن */}
                <div className="flex flex-col justify-between items-start gap-2 sm:gap-3 min-w-0">
                  <div
                    onClick={(e) => handleElementClick(e, "shop_headerShopInfo", "shop_card")}
                    className={`cursor-pointer rounded-xl transition-all w-fit inline-flex self-start ${
                      selectedElementId === "shop_headerShopInfo" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                    }`}
                    style={getElementStyle(shopCustom?.headerShopInfo)}
                    title="انقر لتعديل كبسولة عنوان المحل"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.headerShopInfo?.imageUrl || "/images/order-luxury/shop-card/header-shop-info.webp"}
                      alt="المحل"
                      className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md pointer-events-none"
                    />
                  </div>

                  <div className="space-y-1.5 sm:space-y-2.5 py-0.5 w-full">
                    {/* 1. سطر اسم المحل */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                      <div
                        onClick={(e) => handleElementClick(e, "shop_iconShopName", "shop_card")}
                        className={`cursor-pointer rounded-lg p-0.5 transition-all w-fit inline-flex shrink-0 ${
                          selectedElementId === "shop_iconShopName" ? "ring-4 ring-[#F5D77F] ring-offset-1 ring-offset-black/50 scale-110 shadow-amber-400/40" : "hover:opacity-90 hover:scale-110 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        title="انقر لتعديل أيقونة اسم المحل"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shopCustom?.iconShopName?.imageUrl || "/images/order-luxury/shop-card/icon-shop-name.webp"}
                          alt="اسم المحل"
                          style={getElementStyle(shopCustom?.iconShopName)}
                          className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform pointer-events-none"
                        />
                      </div>
                      <div
                        onClick={(e) => handleElementClick(e, "shop_textShopName", "shop_card")}
                        className={`min-w-0 cursor-pointer rounded-lg px-1 py-0.5 transition-all w-fit inline-flex ${
                          selectedElementId === "shop_textShopName" ? "ring-4 ring-amber-400 ring-offset-1 ring-offset-black/50 bg-amber-500/20 scale-105" : "hover:opacity-90 hover:bg-white/10 hover:ring-1 hover:ring-amber-400/60"
                        }`}
                        title="انقر لتعديل نص وموقع اسم المحل"
                      >
                        <span
                          style={getElementStyle(shopCustom?.textShopName)}
                          className="font-black text-xs sm:text-sm md:text-base text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform pointer-events-none"
                        >
                          أزياء الأمير الملكي
                        </span>
                      </div>
                    </div>

                    {/* 2. سطر اسم العميل / المسؤول */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                      <div
                        onClick={(e) => handleElementClick(e, "shop_iconCustomerName", "shop_card")}
                        className={`cursor-pointer rounded-lg p-0.5 transition-all w-fit inline-flex shrink-0 ${
                          selectedElementId === "shop_iconCustomerName" ? "ring-4 ring-[#F5D77F] ring-offset-1 ring-offset-black/50 scale-110 shadow-amber-400/40" : "hover:opacity-90 hover:scale-110 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        title="انقر لتعديل أيقونة اسم العميل"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shopCustom?.iconCustomerName?.imageUrl || "/images/order-luxury/shop-card/icon-customer-name.webp"}
                          alt="اسم العميل"
                          style={getElementStyle(shopCustom?.iconCustomerName)}
                          className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform pointer-events-none"
                        />
                      </div>
                      <div
                        onClick={(e) => handleElementClick(e, "shop_textCustomerName", "shop_card")}
                        className={`min-w-0 cursor-pointer rounded-lg px-1 py-0.5 transition-all w-fit inline-flex ${
                          selectedElementId === "shop_textCustomerName" ? "ring-4 ring-amber-400 ring-offset-1 ring-offset-black/50 bg-amber-500/20 scale-105" : "hover:opacity-90 hover:bg-white/10 hover:ring-1 hover:ring-amber-400/60"
                        }`}
                        title="انقر لتعديل نص وموقع اسم العميل"
                      >
                        <span
                          style={getElementStyle(shopCustom?.textCustomerName)}
                          className="font-black text-xs sm:text-sm md:text-base text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform pointer-events-none"
                        >
                          أحمد سامي (المدير)
                        </span>
                      </div>
                    </div>

                    {/* 3. سطر المنطقة */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                      <div
                        onClick={(e) => handleElementClick(e, "shop_iconRegion", "shop_card")}
                        className={`cursor-pointer rounded-lg p-0.5 transition-all w-fit inline-flex shrink-0 ${
                          selectedElementId === "shop_iconRegion" ? "ring-4 ring-[#F5D77F] ring-offset-1 ring-offset-black/50 scale-110 shadow-amber-400/40" : "hover:opacity-90 hover:scale-110 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        title="انقر لتعديل أيقونة المنطقة"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shopCustom?.iconRegion?.imageUrl || "/images/order-luxury/shop-card/icon-region.webp"}
                          alt="المنطقة"
                          style={getElementStyle(shopCustom?.iconRegion)}
                          className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform pointer-events-none"
                        />
                      </div>
                      <div
                        onClick={(e) => handleElementClick(e, "shop_textRegion", "shop_card")}
                        className={`min-w-0 cursor-pointer rounded-lg px-1 py-0.5 transition-all w-fit inline-flex ${
                          selectedElementId === "shop_textRegion" ? "ring-4 ring-amber-400 ring-offset-1 ring-offset-black/50 bg-amber-500/20 scale-105" : "hover:opacity-90 hover:bg-white/10 hover:ring-1 hover:ring-amber-400/60"
                        }`}
                        title="انقر لتعديل نص وموقع المنطقة"
                      >
                        <span
                          style={getElementStyle(shopCustom?.textRegion)}
                          className="font-bold text-xs sm:text-sm md:text-base text-[#FFF8F0] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform pointer-events-none"
                        >
                          بغداد — الكرادة
                        </span>
                      </div>
                    </div>

                    {/* 4. سطر الهاتف */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                      <div
                        onClick={(e) => handleElementClick(e, "shop_iconPhone", "shop_card")}
                        className={`cursor-pointer rounded-lg p-0.5 transition-all w-fit inline-flex shrink-0 ${
                          selectedElementId === "shop_iconPhone" ? "ring-4 ring-[#F5D77F] ring-offset-1 ring-offset-black/50 scale-110 shadow-amber-400/40" : "hover:opacity-90 hover:scale-110 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        title="انقر لتعديل أيقونة الهاتف"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shopCustom?.iconPhone?.imageUrl || "/images/order-luxury/shop-card/icon-phone.webp"}
                          alt="الهاتف"
                          style={getElementStyle(shopCustom?.iconPhone)}
                          className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform pointer-events-none"
                        />
                      </div>
                      <div
                        onClick={(e) => handleElementClick(e, "shop_textPhone", "shop_card")}
                        className={`min-w-0 cursor-pointer rounded-lg px-1 py-0.5 transition-all w-fit inline-flex ${
                          selectedElementId === "shop_textPhone" ? "ring-4 ring-amber-400 ring-offset-1 ring-offset-black/50 bg-amber-500/20 scale-105" : "hover:opacity-90 hover:bg-white/10 hover:ring-1 hover:ring-amber-400/60"
                        }`}
                        title="انقر لتعديل نص ورقم الهاتف"
                      >
                        <span
                          style={getElementStyle(shopCustom?.textPhone)}
                          className="font-mono font-black text-xs sm:text-sm md:text-base text-[#F5D77F] tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform pointer-events-none"
                        >
                          07701234567
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* زر موقع المحل */}
                  <div
                    onClick={(e) => handleElementClick(e, "shop_btnShopLocation", "shop_card")}
                    className={`pt-0.5 cursor-pointer transition-all w-fit inline-flex self-start ${
                      selectedElementId === "shop_btnShopLocation" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                    }`}
                    style={getElementStyle(shopCustom?.btnShopLocation)}
                    title="انقر لتعديل زر موقع المحل"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.btnShopLocation?.imageUrl || "/images/order-luxury/shop-card/btn-shop-location.webp"}
                      alt="موقع المحل"
                      className="h-7 sm:h-9 md:h-10 w-auto object-contain drop-shadow-lg pointer-events-none"
                    />
                  </div>

                  {/* أزرار التواصل (اتصال + واتساب) */}
                  <div className="grid grid-cols-2 gap-1 sm:gap-2 pt-1 w-full items-center">
                    <div className="w-full flex justify-center min-w-0">
                      <div
                        onClick={(e) => handleElementClick(e, "shop_btnCall", "shop_card")}
                        className={`cursor-pointer transition-all w-fit inline-flex ${
                          selectedElementId === "shop_btnCall" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        style={getElementStyle(shopCustom?.btnCall)}
                        title="انقر لتعديل زر الاتصال"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shopCustom?.btnCall?.imageUrl || "/images/order-luxury/shop-card/btn-call.webp"}
                          alt="اتصال"
                          className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl block pointer-events-none"
                        />
                      </div>
                    </div>
                    <div className="w-full flex justify-center min-w-0">
                      <div
                        onClick={(e) => handleElementClick(e, "shop_btnWhatsapp", "shop_card")}
                        className={`cursor-pointer transition-all w-fit inline-flex ${
                          selectedElementId === "shop_btnWhatsapp" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        style={getElementStyle(shopCustom?.btnWhatsapp)}
                        title="انقر لتعديل زر الواتساب"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shopCustom?.btnWhatsapp?.imageUrl || "/images/order-luxury/shop-card/btn-whatsapp.webp"}
                          alt="واتس اب"
                          className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl block pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* الجانب الأيسر */}
                <div className="flex flex-col items-center justify-between gap-2 sm:gap-3 min-w-0 h-full">
                  <div
                    onClick={(e) => handleElementClick(e, "shop_headerShopPhoto", "shop_card")}
                    className={`flex justify-center w-fit mx-auto cursor-pointer transition-all ${
                      selectedElementId === "shop_headerShopPhoto" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                    }`}
                    style={getElementStyle(shopCustom?.headerShopPhoto)}
                    title="انقر لتعديل كبسولة عنوان صورة المحل"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.headerShopPhoto?.imageUrl || "/images/order-luxury/shop-card/header-shop-photo.webp"}
                      alt="صورة المحل"
                      className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md pointer-events-none"
                    />
                  </div>

                  <div
                    onClick={(e) => handleElementClick(e, "shop_placeholderNoPhoto", "shop_card")}
                    className={`w-fit inline-flex mx-auto justify-center items-center py-0.5 cursor-pointer transition-all ${
                      selectedElementId === "shop_placeholderNoPhoto" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                    }`}
                    style={getElementStyle(shopCustom?.placeholderNoPhoto)}
                    title="انقر لتعديل موضع وحجم صورة المحل"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shopCustom?.placeholderNoPhoto?.imageUrl || "/images/order-luxury/shop-card/placeholder-no-photo.webp"}
                      alt="لا توجد صورة"
                      className="w-[82px] sm:w-[105px] md:w-[125px] h-auto max-h-[54px] sm:max-h-[70px] md:max-h-[82px] object-contain drop-shadow-xl opacity-95 pointer-events-none"
                    />
                  </div>

                  {/* أزرار رفع الصورة (كاميرا + معرض) */}
                  <div className="grid grid-cols-2 gap-1 sm:gap-2 pt-1 w-full items-center">
                    <div className="w-full flex justify-center min-w-0">
                      <div
                        onClick={(e) => handleElementClick(e, "shop_btnCamera", "shop_card")}
                        className={`cursor-pointer transition-all w-fit inline-flex ${
                          selectedElementId === "shop_btnCamera" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        style={getElementStyle(shopCustom?.btnCamera)}
                        title="انقر لتعديل زر الكاميرا"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shopCustom?.btnCamera?.imageUrl || "/images/order-luxury/shop-card/btn-camera.webp"}
                          alt="كاميرا"
                          className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl block pointer-events-none"
                        />
                      </div>
                    </div>
                    <div className="w-full flex justify-center min-w-0">
                      <div
                        onClick={(e) => handleElementClick(e, "shop_btnGallery", "shop_card")}
                        className={`cursor-pointer transition-all w-fit inline-flex ${
                          selectedElementId === "shop_btnGallery" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        style={getElementStyle(shopCustom?.btnGallery)}
                        title="انقر لتعديل زر المعرض"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={shopCustom?.btnGallery?.imageUrl || "/images/order-luxury/shop-card/btn-gallery.webp"}
                          alt="معرض"
                          className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl block pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* 2. كارت الزبون في المعاينة */}
            {showCustomerCard && (
            <div className={showShopCard ? "-mt-4 sm:-mt-5.5" : "w-full"}>
              <div
                onClick={(e) => handleElementClick(e, "cust_frame", "customer_card")}
                className={`relative w-full rounded-[20px] sm:rounded-[26px] bg-no-repeat bg-[length:100%_100%] shadow-2xl overflow-hidden p-2 sm:p-3.5 md:p-4.5 transition-all mx-auto cursor-pointer ${
                  selectedElementId === "cust_frame"
                    ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-black shadow-[0_0_15px_rgba(245,215,127,0.7)]"
                    : activeTab === "customer_card"
                    ? "ring-1 ring-amber-400/50 hover:ring-2 hover:ring-amber-400/80"
                    : "opacity-85 hover:opacity-100 hover:ring-1 hover:ring-amber-400/40"
                }`}
                style={getCardContainerStyle(custCustom?.frameConfig, custFrameBg)}
                title="انقر لفتح إعدادات وتخصيص خلفية وأبعاد إطار كارت الزبون"
              >
              {/* طبقة خطوط وشبكة المحاذاة الذكية */}
              {showGuides && activeTab === "customer_card" && (
                <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0 border-r border-dashed border-amber-400/40" />
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0 border-b border-dashed border-amber-400/40" />
                  <div className="absolute left-4 right-4 bottom-[18%] h-0 border-b border-dotted border-emerald-400/30" />

                  {selectedElementId && (
                    <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
                      <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded bg-black/80 text-amber-300 border border-amber-400/50 shadow-md">
                        📐 محاذاة نشطة: {currentSelectedDef?.title}
                      </span>
                      {currentSelectedConfig && (
                        <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded bg-[#06281D]/90 text-emerald-300 border border-emerald-400/50 shadow-md">
                          X: {currentSelectedConfig.offsetX || 0}px | Y: {currentSelectedConfig.offsetY || 0}px
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

            <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:gap-7 items-start min-w-0 relative z-10">
              {/* الجانب الأيمن */}
              <div className="flex flex-col justify-between items-start gap-2 sm:gap-3 min-w-0">
                <div
                  onClick={(e) => handleElementClick(e, "cust_headerCustomerInfo", "customer_card")}
                  className={`cursor-pointer rounded-xl transition-all w-fit inline-flex self-start ${
                    selectedElementId === "cust_headerCustomerInfo" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                  }`}
                  style={getElementStyle(custCustom?.headerCustomerInfo)}
                  title="انقر لتعديل كبسولة عنوان الزبون"
                >
                  {custCustom?.headerCustomerInfo?.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={custCustom.headerCustomerInfo.imageUrl}
                      alt="الزبون"
                      className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md pointer-events-none"
                    />
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 bg-gradient-to-r from-[#0F4D3A] via-[#164E3D] to-[#0A3D2E] border-2 border-[#C9A86A] rounded-2xl shadow-lg pointer-events-none">
                      <span className="text-xs sm:text-sm">👤</span>
                      <span className="font-black text-xs sm:text-sm text-[#F5D77F] drop-shadow-md tracking-wide">
                        الزبون (المستلم)
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 sm:space-y-2.5 py-0.5 w-full">
                  {/* 1. سطر اسم الزبون */}
                  <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                    <div
                      onClick={(e) => handleElementClick(e, "cust_iconCustomerName", "customer_card")}
                      className={`cursor-pointer rounded-lg p-0.5 transition-all w-fit inline-flex shrink-0 ${
                        selectedElementId === "cust_iconCustomerName" ? "ring-4 ring-[#F5D77F] ring-offset-1 ring-offset-black/50 scale-110 shadow-amber-400/40" : "hover:opacity-90 hover:scale-110 hover:ring-2 hover:ring-amber-400/70"
                      }`}
                      title="انقر لتعديل أيقونة اسم الزبون"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.iconCustomerName?.imageUrl || "/images/order-luxury/shop-card/icon-customer-name.webp"}
                        alt="اسم الزبون"
                        style={getElementStyle(custCustom?.iconCustomerName)}
                        className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform pointer-events-none"
                      />
                    </div>
                    <div
                      onClick={(e) => handleElementClick(e, "cust_textCustomerName", "customer_card")}
                      className={`min-w-0 cursor-pointer rounded-lg px-1 py-0.5 transition-all w-fit inline-flex ${
                        selectedElementId === "cust_textCustomerName" ? "ring-4 ring-amber-400 ring-offset-1 ring-offset-black/50 bg-amber-500/20 scale-105" : "hover:opacity-90 hover:bg-white/10 hover:ring-1 hover:ring-amber-400/60"
                      }`}
                      title="انقر لتعديل نص وموقع اسم الزبون"
                    >
                      <span
                        style={getElementStyle(custCustom?.textCustomerName)}
                        className="font-black text-xs sm:text-sm md:text-base text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform pointer-events-none"
                      >
                        مريم علي (الزبون)
                      </span>
                    </div>
                  </div>

                  {/* 2. سطر المنطقة */}
                  <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                    <div
                      onClick={(e) => handleElementClick(e, "cust_iconRegion", "customer_card")}
                      className={`cursor-pointer rounded-lg p-0.5 transition-all w-fit inline-flex shrink-0 ${
                        selectedElementId === "cust_iconRegion" ? "ring-4 ring-[#F5D77F] ring-offset-1 ring-offset-black/50 scale-110 shadow-amber-400/40" : "hover:opacity-90 hover:scale-110 hover:ring-2 hover:ring-amber-400/70"
                      }`}
                      title="انقر لتعديل أيقونة المنطقة"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.iconRegion?.imageUrl || "/images/order-luxury/shop-card/icon-region.webp"}
                        alt="المنطقة"
                        style={getElementStyle(custCustom?.iconRegion)}
                        className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform pointer-events-none"
                      />
                    </div>
                    <div
                      onClick={(e) => handleElementClick(e, "cust_textRegion", "customer_card")}
                      className={`min-w-0 cursor-pointer rounded-lg px-1 py-0.5 transition-all w-fit inline-flex ${
                        selectedElementId === "cust_textRegion" ? "ring-4 ring-amber-400 ring-offset-1 ring-offset-black/50 bg-amber-500/20 scale-105" : "hover:opacity-90 hover:bg-white/10 hover:ring-1 hover:ring-amber-400/60"
                      }`}
                      title="انقر لتعديل نص وموقع المنطقة"
                    >
                      <span
                        style={getElementStyle(custCustom?.textRegion)}
                        className="font-bold text-xs sm:text-sm md:text-base text-[#FFF8F0] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform pointer-events-none"
                      >
                        بغداد — المنصور
                      </span>
                    </div>
                  </div>

                  {/* 3. سطر الهاتف */}
                  <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                    <div
                      onClick={(e) => handleElementClick(e, "cust_iconPhone", "customer_card")}
                      className={`cursor-pointer rounded-lg p-0.5 transition-all w-fit inline-flex shrink-0 ${
                        selectedElementId === "cust_iconPhone" ? "ring-4 ring-[#F5D77F] ring-offset-1 ring-offset-black/50 scale-110 shadow-amber-400/40" : "hover:opacity-90 hover:scale-110 hover:ring-2 hover:ring-amber-400/70"
                      }`}
                      title="انقر لتعديل أيقونة الهاتف"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.iconPhone?.imageUrl || "/images/order-luxury/shop-card/icon-phone.webp"}
                        alt="الهاتف"
                        style={getElementStyle(custCustom?.iconPhone)}
                        className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform pointer-events-none"
                      />
                    </div>
                    <div
                      onClick={(e) => handleElementClick(e, "cust_textPhone", "customer_card")}
                      className={`min-w-0 cursor-pointer rounded-lg px-1 py-0.5 transition-all w-fit inline-flex ${
                        selectedElementId === "cust_textPhone" ? "ring-4 ring-amber-400 ring-offset-1 ring-offset-black/50 bg-amber-500/20 scale-105" : "hover:opacity-90 hover:bg-white/10 hover:ring-1 hover:ring-amber-400/60"
                      }`}
                      title="انقر لتعديل نص ورقم الهاتف"
                    >
                      <span
                        style={getElementStyle(custCustom?.textPhone)}
                        className="font-mono font-black text-xs sm:text-sm md:text-base text-[#F5D77F] tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform pointer-events-none"
                      >
                        07809876543
                      </span>
                    </div>
                  </div>
                </div>

                {/* زر موقع الزبون */}
                <div
                  onClick={(e) => handleElementClick(e, "cust_btnLocation", "customer_card")}
                  className={`pt-0.5 cursor-pointer transition-all w-fit inline-flex self-start ${
                    selectedElementId === "cust_btnLocation" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                  }`}
                  style={getElementStyle(custCustom?.btnLocation)}
                  title="انقر لتعديل زر موقع الزبون"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={custCustom?.btnLocation?.imageUrl || "/images/order-luxury/shop-card/btn-shop-location.webp"}
                    alt="موقع الزبون"
                    className="h-7 sm:h-9 md:h-10 w-auto object-contain drop-shadow-lg pointer-events-none"
                  />
                </div>

                {/* أزرار التواصل (اتصال + واتساب) */}
                <div className="grid grid-cols-2 gap-1 sm:gap-2 pt-1 w-full items-center">
                  <div className="w-full flex justify-center min-w-0">
                    <div
                      onClick={(e) => handleElementClick(e, "cust_btnCall", "customer_card")}
                      className={`cursor-pointer transition-all w-fit inline-flex ${
                        selectedElementId === "cust_btnCall" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                      }`}
                      style={getElementStyle(custCustom?.btnCall)}
                      title="انقر لتعديل زر الاتصال"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.btnCall?.imageUrl || "/images/order-luxury/shop-card/btn-call.webp"}
                        alt="اتصال"
                        className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl block pointer-events-none"
                      />
                    </div>
                  </div>
                  <div className="w-full flex justify-center min-w-0">
                    <div
                      onClick={(e) => handleElementClick(e, "cust_btnWhatsapp", "customer_card")}
                      className={`cursor-pointer transition-all w-fit inline-flex ${
                        selectedElementId === "cust_btnWhatsapp" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                      }`}
                      style={getElementStyle(custCustom?.btnWhatsapp)}
                      title="انقر لتعديل زر الواتساب"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.btnWhatsapp?.imageUrl || "/images/order-luxury/shop-card/btn-whatsapp.webp"}
                        alt="واتس اب"
                        className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl block pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* الجانب الأيسر */}
              <div className="flex flex-col items-center justify-between gap-2 sm:gap-3 min-w-0 h-full">
                <div
                  onClick={(e) => handleElementClick(e, "cust_headerDoorPhoto", "customer_card")}
                  className={`flex justify-center w-fit mx-auto cursor-pointer transition-all ${
                    selectedElementId === "cust_headerDoorPhoto" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                  }`}
                  style={getElementStyle(custCustom?.headerDoorPhoto)}
                  title="انقر لتعديل كبسولة عنوان صورة باب الزبون"
                >
                  {custCustom?.headerDoorPhoto?.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={custCustom.headerDoorPhoto.imageUrl}
                      alt="صورة باب الزبون"
                      className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md pointer-events-none"
                    />
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 bg-gradient-to-r from-[#0F4D3A] via-[#164E3D] to-[#0A3D2E] border-2 border-[#C9A86A] rounded-2xl shadow-lg pointer-events-none">
                      <span className="text-xs sm:text-sm">🚪</span>
                      <span className="font-black text-xs sm:text-sm text-[#F5D77F] drop-shadow-md tracking-wide">
                        صورة باب الزبون
                      </span>
                    </div>
                  )}
                </div>

                <div
                  onClick={(e) => handleElementClick(e, "cust_placeholderNoPhoto", "customer_card")}
                  className={`w-fit inline-flex mx-auto justify-center items-center py-0.5 cursor-pointer transition-all ${
                    selectedElementId === "cust_placeholderNoPhoto" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                  }`}
                  style={getElementStyle(custCustom?.placeholderNoPhoto)}
                  title="انقر لتعديل صورة باب الزبون"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={custCustom?.placeholderNoPhoto?.imageUrl || "/images/order-luxury/shop-card/placeholder-no-photo.webp"}
                    alt="لا توجد صورة باب"
                    className="w-[82px] sm:w-[105px] md:w-[125px] h-auto max-h-[54px] sm:max-h-[70px] md:max-h-[82px] object-contain drop-shadow-xl opacity-95 pointer-events-none"
                  />
                </div>

                {/* أزرار رفع الصورة (كاميرا + معرض) */}
                <div className="grid grid-cols-2 gap-1 sm:gap-2 pt-1 w-full items-center">
                  <div className="w-full flex justify-center min-w-0">
                    <div
                      onClick={(e) => handleElementClick(e, "cust_btnCamera", "customer_card")}
                      className={`cursor-pointer transition-all w-fit inline-flex ${
                        selectedElementId === "cust_btnCamera" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                      }`}
                      style={getElementStyle(custCustom?.btnCamera)}
                      title="انقر لتعديل زر الكاميرا"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.btnCamera?.imageUrl || "/images/order-luxury/shop-card/btn-camera.webp"}
                        alt="كاميرا"
                        className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl block pointer-events-none"
                      />
                    </div>
                  </div>
                  <div className="w-full flex justify-center min-w-0">
                    <div
                      onClick={(e) => handleElementClick(e, "cust_btnGallery", "customer_card")}
                      className={`cursor-pointer transition-all w-fit inline-flex ${
                        selectedElementId === "cust_btnGallery" ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                      }`}
                      style={getElementStyle(custCustom?.btnGallery)}
                      title="انقر لتعديل زر المعرض"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={custCustom?.btnGallery?.imageUrl || "/images/order-luxury/shop-card/btn-gallery.webp"}
                        alt="معرض"
                        className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl block pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= البلوكات المدمجة لكارت الزبون (أقرب نقطة دالة + الاستدلال الذكي + أزرار الواتساب) ================= */}
            <div className="mt-2.5 pt-2 border-t border-[#C9A86A]/40 w-full space-y-2 relative z-10">
              {/* 1. بلوك أقرب نقطة دالة */}
              <div className="p-2 rounded-xl bg-black/60 border border-emerald-500/40 flex items-start gap-2">
                <span className="text-base shrink-0">📍</span>
                <div className="text-xs min-w-0">
                  <span className="text-amber-300 font-bold block text-[11px]">أقرب نقطة دالة:</span>
                  <span className="text-white/90 font-medium text-[11px]">قرب جامع الفردوس، الفرع المقابل للصيدلية</span>
                </div>
              </div>

              {/* 2. بلوك الاستدلال الذكي */}
              <div className="p-2 rounded-xl bg-black/60 border border-purple-500/40 flex items-start gap-2">
                <span className="text-base shrink-0">🧠</span>
                <div className="text-xs min-w-0">
                  <span className="text-purple-300 font-bold block text-[11px]">الاستدلال الذكي:</span>
                  <span className="text-white/90 font-medium text-[11px]">المنطقة تشهد حركة خفيفة بعد الساعة 6 مساءً</span>
                </div>
              </div>

              {/* 3. شريط أزرار الواتساب المتغيرة في كارت الزبون */}
              {waButtons && waButtons.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-1.5 justify-center">
                  {waButtons.slice(0, 4).map((btn) => {
                    const btnCustom = config.waButtonsConfig?.[btn.id];
                    const previewImg = btnCustom?.imageUrl;
                    const isSelected = selectedElementId === `wa_${btn.id}`;
                    return (
                      <div
                        key={btn.id}
                        onClick={(e) => handleElementClick(e, `wa_${btn.id}`, "wa_buttons")}
                        style={getElementStyle(btnCustom)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] text-[#F5D77F] font-black text-[11px] shadow-md cursor-pointer transition-all ${
                          isSelected ? "ring-4 ring-[#F5D77F] ring-offset-1 ring-offset-black scale-105 shadow-amber-400/40" : "hover:opacity-90 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        title={`انقر لتعديل زر الواتساب: ${btn.label}`}
                      >
                        {previewImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={previewImg} alt={btn.label} className="w-4 h-4 object-contain shrink-0 pointer-events-none" />
                        ) : (
                          <span>💬</span>
                        )}
                        <span className="pointer-events-none">{btn.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
        )}

            {/* 3. كارت تفاصيل ونوع الطلبية في المعاينة */}
            {showOrderInfoCard && (
              <div className={showCustomerCard || showShopCard ? "-mt-4 sm:-mt-5.5" : "w-full"}>
                <div
                  onClick={(e) => handleElementClick(e, "orderInfo_frame", "order_info")}
                  className={`relative w-full rounded-[22px] sm:rounded-[28px] bg-no-repeat bg-[length:100%_100%] shadow-2xl overflow-hidden p-3.5 sm:p-5 md:p-6 transition-all mx-auto cursor-pointer ${
                    selectedElementId === "orderInfo_frame"
                      ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-black shadow-[0_0_15px_rgba(245,215,127,0.7)]"
                      : activeTab === "order_info"
                      ? "ring-1 ring-amber-400/50 hover:ring-2 hover:ring-amber-400/80"
                      : "opacity-85 hover:opacity-100 hover:ring-1 hover:ring-amber-400/40"
                  }`}
                  style={getCardContainerStyle(
                    config.orderInfoCard?.frameConfig,
                    config.orderInfoCard?.frameBgUrl || "/images/order-luxury/order-info-card/order-info-frame.jpg"
                  )}
                  title="انقر لفتح إعدادات وتخصيص خلفية وأبعاد إطار كارت نوع الطلبية"
                >
              {/* طبقة خطوط وشبكة المحاذاة الذكية */}
              {showGuides && (
                <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0 border-r border-dashed border-amber-400/40" />
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0 border-b border-dashed border-amber-400/40" />

                  {selectedElementId && (
                    <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
                      <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded bg-black/80 text-amber-300 border border-amber-400/50 shadow-md">
                        📐 محاذاة نشطة: {currentSelectedDef?.title}
                      </span>
                      {currentSelectedConfig && (
                        <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded bg-[#06281D]/90 text-emerald-300 border border-emerald-400/50 shadow-md">
                          X: {currentSelectedConfig.offsetX || 0}px | Y: {currentSelectedConfig.offsetY || 0}px
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 sm:gap-5 md:gap-7 items-start min-w-0 relative z-10">
                {/* الجانب الأيمن: تفاصيل الطلب والأسعار */}
                <div className="flex flex-col justify-between items-start gap-2 sm:gap-3 min-w-0">
                  <div
                    onClick={(e) => handleElementClick(e, "orderInfo_headerInfo", "order_info")}
                    className={`cursor-pointer rounded-xl transition-all w-fit inline-flex self-start ${
                      selectedElementId === "orderInfo_headerInfo"
                        ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 scale-105 shadow-amber-400/40"
                        : "hover:opacity-90 hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                    }`}
                    style={getElementStyle(config.orderInfoCard?.headerInfo)}
                    title="انقر لتعديل كبسولة عنوان تفاصيل الطلب"
                  >
                    {config.orderInfoCard?.headerInfo?.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={config.orderInfoCard.headerInfo.imageUrl}
                        alt="تفاصيل الطلب"
                        className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md pointer-events-none"
                      />
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 bg-gradient-to-r from-[#0F4D3A] via-[#164E3D] to-[#0A3D2E] border-2 border-[#C9A86A] rounded-2xl shadow-lg pointer-events-none">
                        <span className="text-xs sm:text-sm">📦</span>
                        <span className="font-black text-xs sm:text-sm text-[#F5D77F] drop-shadow-md tracking-wide">
                          تفاصيل وحساب الطلبية
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 sm:space-y-2 py-0.5 w-full">
                    {/* 1. سطر نوع الطلبية */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                      <div
                        onClick={(e) => handleElementClick(e, "orderInfo_iconOrderBox", "order_info")}
                        className={`cursor-pointer rounded-lg p-0.5 transition-all w-fit inline-flex shrink-0 ${
                          selectedElementId === "orderInfo_iconOrderBox"
                            ? "ring-4 ring-[#F5D77F] ring-offset-1 ring-offset-black/50 scale-110 shadow-amber-400/40"
                            : "hover:opacity-90 hover:scale-110 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        title="انقر لتعديل أيقونة نوع الطلبية"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            config.orderInfoCard?.iconOrderBox?.imageUrl ||
                            "/images/order-luxury/order-info-card/icon-order-box.jpg"
                          }
                          alt="نوع الطلبية"
                          style={getElementStyle(config.orderInfoCard?.iconOrderBox)}
                          className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform pointer-events-none"
                        />
                      </div>
                      <div
                        onClick={(e) => handleElementClick(e, "orderInfo_textOrderType", "order_info")}
                        className={`min-w-0 cursor-pointer rounded-lg px-1 py-0.5 transition-all w-fit inline-flex ${
                          selectedElementId === "orderInfo_textOrderType"
                            ? "ring-4 ring-amber-400 ring-offset-1 ring-offset-black/50 bg-amber-500/20 scale-105"
                            : "hover:opacity-90 hover:bg-white/10 hover:ring-1 hover:ring-amber-400/60"
                        }`}
                        title="انقر لتعديل نص نوع الطلبية"
                      >
                        <span
                          style={getElementStyle(config.orderInfoCard?.textOrderType)}
                          className="font-black text-xs sm:text-sm md:text-base text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform pointer-events-none"
                        >
                          ملابس نسائية فاخرة
                        </span>
                      </div>
                    </div>

                    {/* 2. سطر وقت وتاريخ الطلب */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                      <div
                        onClick={(e) => handleElementClick(e, "orderInfo_iconClock", "order_info")}
                        className={`cursor-pointer rounded-lg p-0.5 transition-all w-fit inline-flex shrink-0 ${
                          selectedElementId === "orderInfo_iconClock"
                            ? "ring-4 ring-[#F5D77F] ring-offset-1 ring-offset-black/50 scale-110 shadow-amber-400/40"
                            : "hover:opacity-90 hover:scale-110 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        title="انقر لتعديل أيقونة الوقت والتاريخ"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            config.orderInfoCard?.iconClock?.imageUrl ||
                            "/images/order-luxury/order-info-card/icon-order-clock.jpg"
                          }
                          alt="وقت الطلب"
                          style={getElementStyle(config.orderInfoCard?.iconClock)}
                          className="w-6 h-6 sm:w-7.5 sm:h-7.5 md:w-8.5 md:h-8.5 object-contain shrink-0 drop-shadow-sm transition-transform pointer-events-none"
                        />
                      </div>
                      <div
                        onClick={(e) => handleElementClick(e, "orderInfo_textOrderTime", "order_info")}
                        className={`min-w-0 cursor-pointer rounded-lg px-1 py-0.5 transition-all w-fit inline-flex ${
                          selectedElementId === "orderInfo_textOrderTime"
                            ? "ring-4 ring-amber-400 ring-offset-1 ring-offset-black/50 bg-amber-500/20 scale-105"
                            : "hover:opacity-90 hover:bg-white/10 hover:ring-1 hover:ring-amber-400/60"
                        }`}
                        title="انقر لتعديل نص وقت الطلب"
                      >
                        <span
                          style={getElementStyle(config.orderInfoCard?.textOrderTime)}
                          className="font-bold text-xs sm:text-sm md:text-base text-emerald-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate inline-block transition-transform pointer-events-none"
                        >
                          اليوم 04:30 م
                        </span>
                      </div>
                    </div>

                    {/* 3. كتل الأسعار والمبالغ */}
                    <div className="space-y-1 pt-1 border-t border-[#C9A86A]/30">
                      {/* سعر المفرد */}
                      <div
                        onClick={(e) => handleElementClick(e, "orderInfo_blockSubtotal", "order_info")}
                        className={`cursor-pointer rounded-lg px-2 py-1 bg-black/40 border border-[#C9A86A]/30 transition-all flex items-center justify-between text-[11px] sm:text-xs ${
                          selectedElementId === "orderInfo_blockSubtotal"
                            ? "ring-4 ring-amber-400 bg-amber-500/20 scale-105"
                            : "hover:border-[#F5D77F] hover:ring-1 hover:ring-amber-400/60"
                        }`}
                        style={getElementStyle(config.orderInfoCard?.blockSubtotal)}
                        title="انقر لتعديل كتلة سعر المفرد"
                      >
                        <span className="text-white/80 font-bold">سعر المفرد:</span>
                        <span className="text-[#F5D77F] font-mono font-black">25,000 د.ع</span>
                      </div>

                      {/* أجور التوصيل */}
                      <div
                        onClick={(e) => handleElementClick(e, "orderInfo_blockDelivery", "order_info")}
                        className={`cursor-pointer rounded-lg px-2 py-1 bg-black/40 border border-[#C9A86A]/30 transition-all flex items-center justify-between text-[11px] sm:text-xs ${
                          selectedElementId === "orderInfo_blockDelivery"
                            ? "ring-4 ring-amber-400 bg-amber-500/20 scale-105"
                            : "hover:border-[#F5D77F] hover:ring-1 hover:ring-amber-400/60"
                        }`}
                        style={getElementStyle(config.orderInfoCard?.blockDelivery)}
                        title="انقر لتعديل كتلة أجور التوصيل"
                      >
                        <span className="text-white/80 font-bold">أجور التوصيل:</span>
                        <span className="text-emerald-300 font-mono font-black">5,000 د.ع</span>
                      </div>

                      {/* الحساب الكلي الواصل */}
                      <div
                        onClick={(e) => handleElementClick(e, "orderInfo_blockTotal", "order_info")}
                        className={`cursor-pointer rounded-lg px-2.5 py-1.5 bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] border-2 border-[#C9A86A] transition-all flex items-center justify-between text-xs sm:text-sm font-black ${
                          selectedElementId === "orderInfo_blockTotal"
                            ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black scale-105 shadow-amber-400/40"
                            : "hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        style={getElementStyle(config.orderInfoCard?.blockTotal)}
                        title="انقر لتعديل كتلة الحساب الكلي الواصل"
                      >
                        <span className="text-[#F5D77F] font-black">المجموع الكلي الواصل:</span>
                        <span className="text-[#F5D77F] font-mono font-black text-sm sm:text-base">30,000 د.ع</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* الجانب الأيسر: صورة الطلبية */}
                <div className="flex flex-col items-center justify-between gap-2 sm:gap-3 min-w-0 h-full">
                  <div
                    onClick={(e) => handleElementClick(e, "orderInfo_headerPhoto", "order_info")}
                    className={`flex justify-center w-fit mx-auto cursor-pointer transition-all ${
                      selectedElementId === "orderInfo_headerPhoto"
                        ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40"
                        : "hover:opacity-90 hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                    }`}
                    style={getElementStyle(config.orderInfoCard?.headerPhoto)}
                    title="انقر لتعديل كبسولة عنوان صورة الطلبية"
                  >
                    {config.orderInfoCard?.headerPhoto?.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={config.orderInfoCard.headerPhoto.imageUrl}
                        alt="صورة الطلبية"
                        className="h-8.5 sm:h-11 md:h-13 w-auto object-contain drop-shadow-md pointer-events-none"
                      />
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1 bg-gradient-to-r from-[#0F4D3A] via-[#164E3D] to-[#0A3D2E] border-2 border-[#C9A86A] rounded-2xl shadow-lg pointer-events-none">
                        <span className="text-xs sm:text-sm">📸</span>
                        <span className="font-black text-xs sm:text-sm text-[#F5D77F] drop-shadow-md tracking-wide">
                          صورة الطلبية
                        </span>
                      </div>
                    )}
                  </div>

                  <div
                    onClick={(e) => handleElementClick(e, "orderInfo_placeholderNoPhoto", "order_info")}
                    className={`w-fit inline-flex mx-auto justify-center items-center py-0.5 cursor-pointer transition-all ${
                      selectedElementId === "orderInfo_placeholderNoPhoto"
                        ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40"
                        : "hover:opacity-90 hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                    }`}
                    style={getElementStyle(config.orderInfoCard?.placeholderNoPhoto)}
                    title="انقر لتعديل صورة الطلبية"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        config.orderInfoCard?.placeholderNoPhoto?.imageUrl ||
                        "/images/order-luxury/shop-card/placeholder-no-photo.webp"
                      }
                      alt="لا توجد صورة طلبية"
                      className="w-[82px] sm:w-[105px] md:w-[125px] h-auto max-h-[54px] sm:max-h-[70px] md:max-h-[82px] object-contain drop-shadow-xl opacity-95 pointer-events-none"
                    />
                  </div>

                  {/* أزرار الكاميرا والمعرض */}
                  <div className="grid grid-cols-2 gap-1 sm:gap-2 pt-1 w-full items-center">
                    <div className="w-full flex justify-center min-w-0">
                      <div
                        onClick={(e) => handleElementClick(e, "orderInfo_btnCamera", "order_info")}
                        className={`cursor-pointer transition-all w-fit inline-flex ${
                          selectedElementId === "orderInfo_btnCamera"
                            ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40"
                            : "hover:opacity-90 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        style={getElementStyle(config.orderInfoCard?.btnCamera)}
                        title="انقر لتعديل زر الكاميرا"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            config.orderInfoCard?.btnCamera?.imageUrl ||
                            "/images/order-luxury/shop-card/btn-camera.webp"
                          }
                          alt="كاميرا"
                          className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl block pointer-events-none"
                        />
                      </div>
                    </div>
                    <div className="w-full flex justify-center min-w-0">
                      <div
                        onClick={(e) => handleElementClick(e, "orderInfo_btnGallery", "order_info")}
                        className={`cursor-pointer transition-all w-fit inline-flex ${
                          selectedElementId === "orderInfo_btnGallery"
                            ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black/50 rounded-xl scale-105 shadow-amber-400/40"
                            : "hover:opacity-90 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                        }`}
                        style={getElementStyle(config.orderInfoCard?.btnGallery)}
                        title="انقر لتعديل زر المعرض"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            config.orderInfoCard?.btnGallery?.imageUrl ||
                            "/images/order-luxury/shop-card/btn-gallery.webp"
                          }
                          alt="معرض"
                          className="h-7 sm:h-8.5 md:h-10 w-full max-w-[110px] object-contain drop-shadow-xl block pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

        {/* معاينة شكل المعاملات المالية (الصادر والوارد) */}
        {activeTab === "money_flow" && (
          <div className="w-full space-y-3">
            {/* أزرار الحركات المالية السريعة */}
            <div className="grid grid-cols-2 gap-2">
              <div
                onClick={(e) => handleElementClick(e, "money_btnSaderAction", "money_flow")}
                className={`cursor-pointer rounded-2xl p-2.5 bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 border-2 border-rose-500/80 shadow-xl flex items-center justify-center gap-2 transition-all ${
                  selectedElementId === "money_btnSaderAction"
                    ? "ring-4 ring-[#F5D77F] scale-105 shadow-rose-500/50"
                    : "hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                }`}
                style={getElementStyle(config.moneyFlowCard?.btnSaderAction)}
                title="انقر لتعديل زر حركة أعطيت للعميل (صادر 💸)"
              >
                <span className="text-base">💸</span>
                <span className="text-xs font-black text-rose-200">أعطيت للعميل (صادر)</span>
              </div>

              <div
                onClick={(e) => handleElementClick(e, "money_btnWardAction", "money_flow")}
                className={`cursor-pointer rounded-2xl p-2.5 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 border-2 border-emerald-400 shadow-xl flex items-center justify-center gap-2 transition-all ${
                  selectedElementId === "money_btnWardAction"
                    ? "ring-4 ring-[#F5D77F] scale-105 shadow-emerald-500/50"
                    : "hover:scale-[1.03] hover:ring-2 hover:ring-amber-400/70"
                }`}
                style={getElementStyle(config.moneyFlowCard?.btnWardAction)}
                title="انقر لتعديل زر حركة أخذت من الزبون (وارد 🫴)"
              >
                <span className="text-base">🫴</span>
                <span className="text-xs font-black text-emerald-200">أخذت من الزبون (وارد)</span>
              </div>
            </div>

            {/* بطاقة وسجل المعاملات المالية */}
            <div
              onClick={(e) => handleElementClick(e, "money_frame", "money_flow")}
              className={`relative w-full rounded-[22px] sm:rounded-[28px] bg-no-repeat bg-[length:100%_100%] shadow-2xl overflow-hidden p-3.5 sm:p-5 transition-all mx-auto cursor-pointer ${
                selectedElementId === "money_frame"
                  ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-black shadow-[0_0_15px_rgba(245,215,127,0.7)]"
                  : "ring-1 ring-amber-400/50 hover:ring-2 hover:ring-amber-400/80"
              }`}
              style={getCardContainerStyle(
                config.moneyFlowCard?.frameConfig,
                config.moneyFlowCard?.frameBgUrl || "/images/order-luxury/luxury-money-card-bg.jpg"
              )}
              title="انقر لفتح إعدادات وتخصيص خلفية وإطار سجل المعاملات المالية"
            >
              {/* شريط عنوان السجل */}
              <div className="flex items-center justify-between border-b border-[#C9A86A]/40 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">📜</span>
                  <h4 className="text-xs sm:text-sm font-black text-[#F5D77F]">سجل الحركات والمعاملات المالية</h4>
                </div>
                <span className="text-[10px] font-bold text-amber-300 bg-black/60 px-2.5 py-0.5 rounded-full border border-[#C9A86A]/40">
                  حركات الطلب 💰
                </span>
              </div>

              {/* نماذج الحركات المالية في السجل */}
              <div className="space-y-2">
                {/* 1. حركة صادر */}
                <div
                  onClick={(e) => handleElementClick(e, "money_badgeSader", "money_flow")}
                  className={`p-2.5 rounded-xl bg-black/60 border border-rose-500/60 flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    selectedElementId === "money_badgeSader"
                      ? "ring-4 ring-[#F5D77F] bg-rose-950/40 scale-[1.03] shadow-amber-400/40"
                      : "hover:border-rose-400 hover:ring-2 hover:ring-amber-400/70"
                  }`}
                  style={getElementStyle(config.moneyFlowCard?.badgeSader)}
                  title="انقر لتعديل شارة وبطاقة حركة (صادر 💸)"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-rose-600 text-white rounded-lg text-[10px] font-black">
                      صادر 💸
                    </span>
                    <span className="text-xs font-black text-rose-200">25,000 د.ع</span>
                    <span className="text-[10px] text-white/60">(تسليم للمحل)</span>
                  </div>
                  <div
                    onClick={(e) => handleElementClick(e, "money_btnDeleteAction", "money_flow")}
                    className={`px-2 py-1 bg-rose-900/60 border border-rose-500/50 text-rose-300 rounded-lg text-[10px] font-black transition-all ${
                      selectedElementId === "money_btnDeleteAction"
                        ? "ring-4 ring-[#F5D77F] scale-110 shadow-amber-400/40"
                        : "hover:bg-rose-900 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                    }`}
                    style={getElementStyle(config.moneyFlowCard?.btnDeleteAction)}
                    title="انقر لتعديل زر الحذف"
                  >
                    🗑️ حذف
                  </div>
                </div>

                {/* 2. حركة وارد */}
                <div
                  onClick={(e) => handleElementClick(e, "money_badgeWard", "money_flow")}
                  className={`p-2.5 rounded-xl bg-black/60 border border-emerald-500/60 flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    selectedElementId === "money_badgeWard"
                      ? "ring-4 ring-[#F5D77F] bg-emerald-950/40 scale-[1.03] shadow-amber-400/40"
                      : "hover:border-emerald-400 hover:ring-2 hover:ring-amber-400/70"
                  }`}
                  style={getElementStyle(config.moneyFlowCard?.badgeWard)}
                  title="انقر لتعديل شارة وبطاقة حركة (وارد 🫴)"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black">
                      وارد 🫴
                    </span>
                    <span className="text-xs font-black text-emerald-200">30,000 د.ع</span>
                    <span className="text-[10px] text-white/60">(قبض من الزبون)</span>
                  </div>
                  <div
                    onClick={(e) => handleElementClick(e, "money_btnDeleteAction", "money_flow")}
                    className={`px-2 py-1 bg-rose-900/60 border border-rose-500/50 text-rose-300 rounded-lg text-[10px] font-black transition-all ${
                      selectedElementId === "money_btnDeleteAction"
                        ? "ring-4 ring-[#F5D77F] scale-110 shadow-amber-400/40"
                        : "hover:bg-rose-900 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                    }`}
                    style={getElementStyle(config.moneyFlowCard?.btnDeleteAction)}
                    title="انقر لتعديل زر الحذف"
                  >
                    🗑️ حذف
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
                  onClick={(e) => handleElementClick(e, `wa_${btn.id}`, "wa_buttons")}
                  style={getElementStyle(btnCustom)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] text-[#F5D77F] font-black text-xs shadow-md cursor-pointer transition-all ${
                    isSelected ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black scale-105 shadow-[0_0_15px_rgba(245,215,127,0.7)]" : "hover:opacity-90 hover:scale-105 hover:ring-2 hover:ring-amber-400/70"
                  }`}
                  title={`انقر لتعديل إعدادات زر: ${btn.label}`}
                >
                  {previewImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewImg} alt={btn.label} className="w-5 h-5 object-contain shrink-0 pointer-events-none" />
                  ) : (
                    <span>💬</span>
                  )}
                  <span className="pointer-events-none">{btn.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. الزر العائم للاستلام والتسليم في المعاينة */}
        {activeTab === "floating_btn" && (
          <div className="relative h-44 w-full bg-gradient-to-b from-[#0A3D2E]/90 to-[#06281D] border-2 border-dashed border-[#C9A86A]/60 rounded-2xl flex flex-col items-center justify-center overflow-hidden p-4 select-none">
            <div className="absolute top-2 right-3 text-[10px] font-bold text-amber-300 bg-black/60 px-2.5 py-0.5 rounded-full border border-[#C9A86A]/40">
              💡 انقر على الزر لتعديله فوراً
            </div>
            <div
              onClick={(e) => handleElementClick(e, "floating_action_btn", "floating_btn")}
              style={{
                transform: `scale(${config.floatingActionBtn?.scale ?? 1}) rotate(${config.floatingActionBtn?.rotate ?? 0}deg) translate(${config.floatingActionBtn?.offsetX ?? 0}px, ${config.floatingActionBtn?.offsetY ?? 0}px)`,
                backgroundColor: config.floatingActionBtn?.bgColor || "#003399",
                color: config.floatingActionBtn?.textColor || "#FFFFFF",
                borderColor: config.floatingActionBtn?.borderColor || "#C9A86A",
              }}
              className={`h-20 w-20 rounded-full border-4 font-black shadow-2xl flex items-center justify-center flex-col transition-all cursor-pointer select-none active:scale-95 ${
                selectedElementId === "floating_action_btn"
                  ? "ring-4 ring-[#F5D77F] ring-offset-2 ring-offset-black scale-105 shadow-amber-400/50"
                  : "hover:scale-105 hover:shadow-blue-500/50 hover:ring-2 hover:ring-amber-400/70"
              }`}
              title="انقر لتعديل أبعاد وألوان وصورة الزر العائم"
            >
              {config.floatingActionBtn?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={config.floatingActionBtn.imageUrl}
                  alt="أيقونة الزر"
                  className="h-8 w-8 object-contain mb-0.5 drop-shadow-sm pointer-events-none"
                />
              ) : (
                <span className="text-2xl mb-0.5 pointer-events-none">✈️</span>
              )}
              <span className="text-[10px] font-black pointer-events-none tracking-tight">
                {config.floatingActionBtn?.customLabel || "استلام"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// مكون محرر الزر العائم المخصص (الألوان، الحجم، التدوير، والأيقونة)
// =============================================================================
function DedicatedFloatingBtnInspector({
  floatingConfig,
  onChange,
  onUploadImg,
}: {
  floatingConfig?: FloatingActionBtnConfig;
  onChange: (field: keyof FloatingActionBtnConfig, val: any) => void;
  onUploadImg: () => void;
}) {
  const currentImg = floatingConfig?.imageUrl || "";
  const currentScale = floatingConfig?.scale ?? 1;
  const currentRotate = floatingConfig?.rotate ?? 0;
  const currentOffsetX = floatingConfig?.offsetX ?? 0;
  const currentOffsetY = floatingConfig?.offsetY ?? 0;
  const currentTextColor = floatingConfig?.textColor || "#FFFFFF";
  const currentBgColor = floatingConfig?.bgColor || "#003399";
  const currentBorderColor = floatingConfig?.borderColor || "#C9A86A";
  const currentLabel = floatingConfig?.customLabel || "استلام";

  const [activeSubTab, setActiveSubTab] = useState<"colors" | "size_rotate" | "text" | "image">("colors");

  const presetBgColors = [
    { label: "أزرق ملكي", val: "#003399" },
    { label: "كحلي داكن", val: "#0A2540" },
    { label: "أخضر زمردي", val: "#0F4D3A" },
    { label: "أخضر غامق", val: "#006633" },
    { label: "أحمر عنابي", val: "#8B0000" },
    { label: "ذهبي فاخر", val: "#C9A86A" },
    { label: "بنفسجي", val: "#4B0082" },
    { label: "أسود داكن", val: "#0f172a" },
  ];

  const presetTextColors = [
    { label: "أبيض", val: "#FFFFFF" },
    { label: "ذهبي فاتح", val: "#F5D77F" },
    { label: "أصفر ساطع", val: "#FACC15" },
    { label: "أسود", val: "#000000" },
    { label: "أخضر فاتح", val: "#86EFAC" },
    { label: "سماوي", val: "#7DD3FC" },
  ];

  const presetBorderColors = [
    { label: "ذهبي ملكي", val: "#C9A86A" },
    { label: "أبيض ناصع", val: "#FFFFFF" },
    { label: "فضي أنيق", val: "#CBD5E1" },
    { label: "زمردي", val: "#10B981" },
    { label: "سماوي", val: "#38BDF8" },
    { label: "شفاف", val: "transparent" },
  ];

  const handleReset = () => {
    onChange("scale", 1);
    onChange("rotate", 0);
    onChange("offsetX", 0);
    onChange("offsetY", 0);
    onChange("textColor", "#FFFFFF");
    onChange("bgColor", "#003399");
    onChange("borderColor", "#C9A86A");
    onChange("customLabel", "استلام");
    onChange("imageUrl", "");
  };

  return (
    <div className="space-y-4 text-[#FFF8F0]">
      {/* شريط رأس المفتش وأزرار الحفظ والإعادة */}
      <div className="flex items-center justify-between gap-2 bg-black/40 border border-[#C9A86A]/40 rounded-2xl p-2.5 sm:p-3">
        <h4 className="font-black text-xs sm:text-sm text-[#F5D77F] flex items-center gap-1.5 truncate">
          <span>🔘</span> تخصيص الزر العائم للاستلام والتسليم
        </h4>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onUploadImg}
            className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl text-[11px] font-black hover:scale-105 active:scale-95 transition cursor-pointer shadow-md flex items-center gap-1"
          >
            <span>📤</span> رفع صورة للزر
          </button>
          {currentImg && (
            <button
              type="button"
              onClick={() => onChange("imageUrl", "")}
              className="px-2 py-1 bg-rose-900/50 text-rose-200 border border-rose-500/50 rounded-xl text-[11px] font-bold hover:bg-rose-900/80 transition cursor-pointer"
            >
              استعادة الأيقونة
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1 bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 rounded-xl text-[11px] font-black hover:bg-emerald-900 hover:text-white transition hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1 shadow-sm"
          >
            <span>🔄</span> ضبط افتراضي
          </button>
        </div>
      </div>

      {/* ================= وحدة التحكم الاتجاهية D-Pad للزر العائم ================= */}
      <div className="bg-[#06281D]/90 border border-[#C9A86A]/50 rounded-2xl p-2.5 sm:p-3.5 shadow-xl">
        <div className="flex items-center justify-between text-xs font-black text-[#F5D77F] mb-2 border-b border-[#C9A86A]/20 pb-1.5">
          <span className="flex items-center gap-1">
            <span>🕹️</span> موضع وإزاحة الزر:
          </span>
          <span className="text-[10px] text-emerald-300 font-mono bg-black/60 px-2 py-0.5 rounded border border-[#C9A86A]/40">
            X: {currentOffsetX}px | Y: {currentOffsetY}px
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5 w-full max-w-md mx-auto" dir="ltr">
          <button
            type="button"
            onClick={() => onChange("offsetX", currentOffsetX - 1)}
            className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-emerald-200 rounded-xl border border-[#C9A86A]/60 font-black text-xs hover:scale-105 active:scale-95 transition shadow-sm flex flex-col items-center justify-center cursor-pointer"
            title="تحريك لليسار 1px"
          >
            <span>◀</span>
            <span className="text-[9px]">يسار</span>
          </button>
          <button
            type="button"
            onClick={() => onChange("offsetY", currentOffsetY - 1)}
            className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-emerald-200 rounded-xl border border-[#C9A86A]/60 font-black text-xs hover:scale-105 active:scale-95 transition shadow-sm flex flex-col items-center justify-center cursor-pointer"
            title="تحريك لأعلى 1px"
          >
            <span>▲</span>
            <span className="text-[9px]">فوق</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onChange("offsetX", 0);
              onChange("offsetY", 0);
            }}
            className="py-1.5 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl font-black text-xs hover:scale-105 active:scale-95 transition shadow-md flex flex-col items-center justify-center cursor-pointer"
            title="إعادة ضبط للوسط (0,0)"
          >
            <span>🎯</span>
            <span className="text-[9px] font-black">وسط</span>
          </button>
          <button
            type="button"
            onClick={() => onChange("offsetY", currentOffsetY + 1)}
            className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-emerald-200 rounded-xl border border-[#C9A86A]/60 font-black text-xs hover:scale-105 active:scale-95 transition shadow-sm flex flex-col items-center justify-center cursor-pointer"
            title="تحريك لأسفل 1px"
          >
            <span>▼</span>
            <span className="text-[9px]">أسفل</span>
          </button>
          <button
            type="button"
            onClick={() => onChange("offsetX", currentOffsetX + 1)}
            className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-emerald-200 rounded-xl border border-[#C9A86A]/60 font-black text-xs hover:scale-105 active:scale-95 transition shadow-sm flex flex-col items-center justify-center cursor-pointer"
            title="تحريك لليمين 1px"
          >
            <span>▶</span>
            <span className="text-[9px]">يمين</span>
          </button>
        </div>
      </div>

      {/* شريط تبويبات إعدادات الزر العائم */}
      <div className="flex items-center gap-1.5 bg-[#06281D]/80 p-1 rounded-xl border border-[#C9A86A]/30 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab("colors")}
          className={`flex-1 min-w-[85px] py-1.5 px-2 rounded-lg text-xs font-black transition ${
            activeSubTab === "colors"
              ? "bg-[#C9A86A] text-[#06281D] shadow-md"
              : "bg-[#0A3D2E] text-white/80 hover:text-white"
          }`}
        >
          🎨 الألوان
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("size_rotate")}
          className={`flex-1 min-w-[85px] py-1.5 px-2 rounded-lg text-xs font-black transition ${
            activeSubTab === "size_rotate"
              ? "bg-[#C9A86A] text-[#06281D] shadow-md"
              : "bg-[#0A3D2E] text-white/80 hover:text-white"
          }`}
        >
          🔍 الحجم والتدوير
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("text")}
          className={`flex-1 min-w-[85px] py-1.5 px-2 rounded-lg text-xs font-black transition ${
            activeSubTab === "text"
              ? "bg-[#C9A86A] text-[#06281D] shadow-md"
              : "bg-[#0A3D2E] text-white/80 hover:text-white"
          }`}
        >
          ✍️ نص الزر
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("image")}
          className={`flex-1 min-w-[85px] py-1.5 px-2 rounded-lg text-xs font-black transition ${
            activeSubTab === "image"
              ? "bg-[#C9A86A] text-[#06281D] shadow-md"
              : "bg-[#0A3D2E] text-white/80 hover:text-white"
          }`}
        >
          🖼️ الصورة المخصصة
        </button>
      </div>

      {/* ================= 1. أداة الألوان ================= */}
      {activeSubTab === "colors" && (
        <div className="space-y-3">
          {/* لون الخلفية */}
          <div className="bg-[#06281D]/80 p-3 rounded-xl border border-[#C9A86A]/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-200 font-bold">لون خلفية الزر العائم:</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentBgColor.startsWith("#") ? currentBgColor : "#003399"}
                  onChange={(e) => onChange("bgColor", e.target.value)}
                  className="w-7 h-7 rounded-lg border border-[#C9A86A] cursor-pointer bg-transparent"
                />
                <span className="font-mono text-xs text-emerald-300 bg-black/60 px-2 py-0.5 rounded border border-[#C9A86A]/40">
                  {currentBgColor}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1">
              {presetBgColors.map((c) => (
                <button
                  key={c.val}
                  type="button"
                  onClick={() => onChange("bgColor", c.val)}
                  style={{ backgroundColor: c.val }}
                  className={`h-7 rounded-lg border text-[10px] font-bold text-white shadow-sm flex items-center justify-center transition hover:scale-105 active:scale-95 ${
                    currentBgColor.toLowerCase() === c.val.toLowerCase() ? "ring-2 ring-amber-300 border-white font-black" : "border-[#C9A86A]/40"
                  }`}
                  title={c.label}
                >
                  {c.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* لون النص والكتابة */}
          <div className="bg-[#06281D]/80 p-3 rounded-xl border border-[#C9A86A]/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-200 font-bold">لون كتابة ونصوص الزر:</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentTextColor.startsWith("#") ? currentTextColor : "#FFFFFF"}
                  onChange={(e) => onChange("textColor", e.target.value)}
                  className="w-7 h-7 rounded-lg border border-[#C9A86A] cursor-pointer bg-transparent"
                />
                <span className="font-mono text-xs text-emerald-300 bg-black/60 px-2 py-0.5 rounded border border-[#C9A86A]/40">
                  {currentTextColor}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
              {presetTextColors.map((c) => (
                <button
                  key={c.val}
                  type="button"
                  onClick={() => onChange("textColor", c.val)}
                  style={{ backgroundColor: c.val === "#FFFFFF" ? "#0A3D2E" : "#06281D", color: c.val }}
                  className={`py-1 px-2 rounded-lg border text-xs font-black shadow-sm flex items-center justify-center transition hover:scale-105 active:scale-95 ${
                    currentTextColor.toLowerCase() === c.val.toLowerCase() ? "ring-2 ring-amber-400 border-amber-400" : "border-[#C9A86A]/40"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* لون الإطار والحدود */}
          <div className="bg-[#06281D]/80 p-3 rounded-xl border border-[#C9A86A]/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-200 font-bold">لون إطار وحدود الزر:</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentBorderColor.startsWith("#") ? currentBorderColor : "#C9A86A"}
                  onChange={(e) => onChange("borderColor", e.target.value)}
                  className="w-7 h-7 rounded-lg border border-[#C9A86A] cursor-pointer bg-transparent"
                />
                <span className="font-mono text-xs text-emerald-300 bg-black/60 px-2 py-0.5 rounded border border-[#C9A86A]/40">
                  {currentBorderColor}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
              {presetBorderColors.map((c) => (
                <button
                  key={c.val}
                  type="button"
                  onClick={() => onChange("borderColor", c.val)}
                  className={`py-1 px-2 rounded-lg border text-xs font-bold bg-[#0A3D2E] text-white shadow-sm flex items-center justify-center transition hover:scale-105 active:scale-95 ${
                    currentBorderColor.toLowerCase() === c.val.toLowerCase() ? "ring-2 ring-amber-400 border-amber-400 font-black" : "border-[#C9A86A]/40"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. أداة الحجم والتدوير ================= */}
      {activeSubTab === "size_rotate" && (
        <div className="space-y-3">
          {/* سلايدر التكبير العام */}
          <div className="bg-[#06281D]/80 p-3.5 rounded-xl border border-[#C9A86A]/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-200 font-bold">حجم وتكبير الزر العائم (Scale):</span>
              <span className="font-mono text-base font-black text-emerald-300 bg-black/60 px-3 py-1 rounded-lg border border-[#C9A86A]">
                {Math.round(currentScale * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2" dir="ltr">
              <button
                type="button"
                onClick={() => onChange("scale", Math.max(0.4, parseFloat((currentScale - 0.05).toFixed(2))))}
                className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
              >
                ➖ تصغير (-5%)
              </button>
              <input
                type="range"
                dir="ltr"
                min="0.4"
                max="2.5"
                step="0.05"
                value={currentScale}
                onChange={(e) => onChange("scale", parseFloat(e.target.value))}
                className="flex-1 accent-[#C9A86A] cursor-pointer h-3 rounded-lg"
              />
              <button
                type="button"
                onClick={() => onChange("scale", Math.min(2.5, parseFloat((currentScale + 0.05).toFixed(2))))}
                className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
              >
                (+5%) تكبير ➕
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2 pt-1 text-xs">
              <button type="button" onClick={() => onChange("scale", 0.8)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">80% صغير</button>
              <button type="button" onClick={() => onChange("scale", 1.0)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">100% عادي</button>
              <button type="button" onClick={() => onChange("scale", 1.25)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">125% كبير</button>
              <button type="button" onClick={() => onChange("scale", 1.5)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">150% ضخم</button>
              <button type="button" onClick={() => onChange("scale", 1.8)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">180% عملاق</button>
            </div>
          </div>

          {/* سلايدر التدوير */}
          <div className="bg-[#06281D]/80 p-3.5 rounded-xl border border-[#C9A86A]/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-200 font-bold">زاوية تدوير الزر العائم (Rotate):</span>
              <span className="font-mono text-base font-black text-amber-300 bg-black/60 px-3 py-1 rounded-lg border border-[#C9A86A]">
                {currentRotate}°
              </span>
            </div>
            <div className="flex items-center gap-2" dir="ltr">
              <button
                type="button"
                onClick={() => onChange("rotate", (currentRotate - 5 + 360) % 360)}
                className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
              >
                ⟲ -5°
              </button>
              <input
                type="range"
                dir="ltr"
                min="0"
                max="360"
                step="1"
                value={currentRotate}
                onChange={(e) => onChange("rotate", parseInt(e.target.value))}
                className="flex-1 accent-[#C9A86A] cursor-pointer h-3 rounded-lg"
              />
              <button
                type="button"
                onClick={() => onChange("rotate", (currentRotate + 5) % 360)}
                className="px-3 py-1.5 bg-[#0A3D2E] text-white rounded-lg text-xs font-black border border-[#C9A86A]/40 hover:bg-[#0F4D3A] cursor-pointer"
              >
                +5° ⟳
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1 text-xs">
              <button type="button" onClick={() => onChange("rotate", 0)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">0° عدل</button>
              <button type="button" onClick={() => onChange("rotate", 90)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">90° عمودي</button>
              <button type="button" onClick={() => onChange("rotate", 180)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">180° مقلوب</button>
              <button type="button" onClick={() => onChange("rotate", 270)} className="py-1 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg">270° معاكس</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 3. أداة نص وكتابة الزر ================= */}
      {activeSubTab === "text" && (
        <div className="bg-[#06281D]/80 p-3.5 rounded-xl border border-[#C9A86A]/30 space-y-3">
          <div>
            <label className="block text-xs font-bold text-amber-200 mb-1">
              النص المكتوب داخل الزر العائم:
            </label>
            <input
              type="text"
              value={currentLabel}
              onChange={(e) => onChange("customLabel", e.target.value)}
              placeholder="مثال: استلام أو تسليم أو إجراء سريع"
              className="w-full bg-[#0A3D2E] border-2 border-[#C9A86A] rounded-xl px-3 py-2 text-sm text-white font-black"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
            <button type="button" onClick={() => onChange("customLabel", "استلام")} className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg font-bold">✈️ استلام</button>
            <button type="button" onClick={() => onChange("customLabel", "تسليم")} className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg font-bold">📦 تسليم</button>
            <button type="button" onClick={() => onChange("customLabel", "إجراء سريع")} className="py-1.5 bg-[#0A3D2E] hover:bg-[#0F4D3A] text-white rounded-lg font-bold">⚡ إجراء سريع</button>
          </div>
        </div>
      )}

      {/* ================= 4. أداة الصورة المخصصة ================= */}
      {activeSubTab === "image" && (
        <div className="bg-[#06281D]/80 p-4 rounded-xl border border-[#C9A86A]/30 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full border-2 border-[#C9A86A] bg-black/60 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
              {currentImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentImg} alt="صورة الزر" className="h-12 w-12 object-contain" />
              ) : (
                <span className="text-3xl">✈️</span>
              )}
            </div>
            <div>
              <h5 className="font-black text-xs text-[#F5D77F]">الأيقونة أو الصورة الحالية للزر</h5>
              <p className="text-[10px] text-emerald-200 mt-0.5">
                {currentImg ? "صورة مخصصة مرفوعة" : "الأيقونة الافتراضية للنظام"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onUploadImg}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-[#C9A86A] text-[#06281D] rounded-xl text-xs font-black hover:scale-105 active:scale-95 transition cursor-pointer shadow-lg"
            >
              📤 رفع صورة مخصصة (WEBP)
            </button>
            {currentImg && (
              <button
                type="button"
                onClick={() => onChange("imageUrl", "")}
                className="px-3 py-2.5 bg-rose-900/50 text-rose-200 border border-rose-500/50 rounded-xl text-xs font-bold hover:bg-rose-900/80 transition cursor-pointer"
              >
                استعادة الأيقونة الأصلية
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
