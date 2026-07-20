"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useActionState, useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

import {
  assignPendingOrderToCourier,
  assignOrderToPreparer,
  setDraftAutoCourier,
  reassignOrderToPreparer,
  deleteOrderPermanently,
  rejectPendingOrder,
  rejectPreparerDraft,
  saveOrderLocationOnly,
  bulkDeleteOrdersPermanently,
  bulkAssignOrdersToCourier,
  revertPreparedOrderToPreparing,
  type AssignOrderState,
  type RejectOrderState,
} from "../actions";
import {
  bulkUpdateOrdersStatus,
  type BulkOrdersState,
} from "../bulk-actions";
import { updateOrderPricingByAdmin, savePricingProgress, duplicateOrderOrDraft } from "./pricing-actions";
import { orderStatusPendingCardBorderBg } from "@/lib/order-status-style";
import { OrderStatusRadioGroup } from "@/components/order-status-radio-group";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import { calculateAutoSellPrice, isMeatProduct } from "@/lib/auto-pricing";
import { normalizeNumerals } from "@/lib/money-alf";
import { matchFishAndCalculatePrice, parseFishPricesList } from "@/lib/fish-pricing";

import { resolvePublicAssetSrc } from "@/lib/image-url";
import { VoiceNoteAudio } from "@/components/voice-note-audio";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export type PendingOrderRow = {
  id: string;
  orderNumber: number;
  routeMode: "single" | "double";
  shopName: string;
  secondCustomerRegionName?: string | null;
  shopCustomerLabel?: string;
  regionName: string;
  orderType: string;
  customerOrderTime: string;
  createdAtLabel: string;
  summary: string;
  customerPhone: string;
  customerAlternatePhone: string;
  customerDoorPhotoUrl: string;
  totalAmount: string | null;
  orderSubtotal?: string | null;
  requestLocationWaUrl?: string | null;
  notifyCustomerWaUrl?: string | null;
  deliveryPrice: string | null;
  rawDeliveryPriceDinar: number | null;
  submittedByName: string | null;
  submissionLabel: string | null;
  customerLocationUrl: string;
  customerLandmark: string;
  secondCustomerLocationUrl?: string;
  secondCustomerLandmark?: string;
  secondCustomerDoorPhotoUrl?: string;
  voiceNoteUrl?: string | null;
  adminVoiceNoteUrl?: string | null;
  hasCustomerLocation: boolean;
  hasCourierUploadedLocation: boolean;
  reversePickup?: boolean;
  wardMismatchType?: "excess" | "deficit" | null;
  saderMismatchType?: "excess" | "deficit" | null;
  preparerShoppingJson?: any;
  vehiclePreference?: string | null;
  assignedPreparerIds: string[];
};

function CheckIcon({ icons }: { icons: GlobalIconsConfig | null }) {
  return (
    <DynamicIcon
      icon={icons?.preparer_delegate}
      className="h-6 w-6"
      fallback={
        <div className="h-6 w-6" />
      }
    />
  );
}

/** لوحة إسناد الطلب لمجهز (تدعم اختيار متعدد وتأشير مسبق) */
export function AssignToPreparerPanel({
  orderId,
  preparers,
  isDraft,
  initialPreparerIds = [],
  onSuccess,
  icons,
  hideContainer = false,
}: {
  orderId: string;
  preparers: { id: string; name: string }[];
  isDraft?: boolean;
  initialPreparerIds?: string[];
  onSuccess?: () => void;
  icons?: GlobalIconsConfig;
  hideContainer?: boolean;
}) {
  const [selectedPreparers, setSelectedPreparers] = useState<string[]>(initialPreparerIds);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const togglePreparer = async (id: string) => {
    if (pending) return; // منع النقرات المزدوجة أثناء التحديث
    
    const nextPreparers = selectedPreparers.includes(id)
      ? selectedPreparers.filter(i => i !== id)
      : [...selectedPreparers, id];
    
    setSelectedPreparers(nextPreparers);
    setPending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const fd = new FormData();
      fd.append("orderId", orderId);
      fd.append("preparerIdsJson", JSON.stringify(nextPreparers));
      fd.append("isDraft", isDraft ? "true" : "false");
      
      const result = await assignOrderToPreparer({} as AssignOrderState, fd);
      if (result.error) {
        setError(result.error);
        setSelectedPreparers(selectedPreparers); // التراجع في حال الفشل
      } else if (result.ok) {
        setSuccessMsg("✅ تم الحفظ تلقائياً");
        setTimeout(() => setSuccessMsg(null), 2000);
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع أثناء حفظ الإسناد");
      setSelectedPreparers(selectedPreparers); // التراجع في حال الفشل
    } finally {
      setPending(false);
    }
  };

  if (preparers.length === 0) return <p className="p-3 bg-amber-50 text-amber-900 rounded-lg text-xs font-bold border border-amber-200 text-center flex items-center justify-center gap-2"><DynamicIcon icon={icons?.ui_warning} fallback="⚠️" width={14} height={14} /> لا يوجد مجهزون متاحون حالياً.</p>;

  return (
    <div className={hideContainer ? "" : "p-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm"} dir="rtl">
       <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">إسناد الطلب للمجهزين</p>
             {pending && (
                <span className="text-[8px] font-black text-emerald-500 animate-pulse bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                   <span className="h-1 w-1 rounded-full bg-emerald-500 animate-ping" />
                   جاري الحفظ...
                </span>
             )}
             {successMsg && !pending && (
                <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded animate-bounce">
                   {successMsg}
                </span>
             )}
          </div>
          <div className="flex items-center gap-1.5 bg-sky-100 dark:bg-sky-900/30 px-2 py-1 rounded-lg">
             <span className="text-[10px] font-black text-sky-700 dark:text-sky-400">{selectedPreparers.length}</span>
             <span className="text-[9px] font-bold text-sky-600/70">مختار</span>
          </div>
       </div>

       <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {preparers.map(p => {
             const active = selectedPreparers.includes(p.id);
             return (
               <button
                 key={p.id}
                 type="button"
                 disabled={pending}
                 onClick={() => togglePreparer(p.id)}
                 className={`group relative flex items-center gap-2 p-2 rounded-xl border-2 transition-all duration-200 disabled:opacity-85 ${
                    active
                    ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20 shadow-md scale-[1.02]"
                    : "border-slate-100 dark:border-white/5 bg-white dark:bg-slate-800/40 hover:border-slate-200"
                 }`}
               >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${active ? "border-sky-500 bg-sky-500 text-white" : "border-slate-200 bg-slate-50"}`}>
                     {active && <DynamicIcon icon={icons?.ui_success} fallback="✓" width={12} height={12} />}
                  </div>
                  <span className={`truncate text-[10px] font-black ${active ? "text-sky-900 dark:text-sky-100" : "text-slate-600 dark:text-slate-400"}`}>{p.name}</span>
               </button>
             );
          })}
       </div>

       {error && <p className="mt-2 text-xs font-bold text-rose-600 text-center bg-rose-50 dark:bg-rose-950/20 p-2 rounded-lg mb-3">{error}</p>}

       {onSuccess && (
          <button
            type="button"
            onClick={onSuccess}
            className="w-full h-9 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black transition-all active:scale-95 flex items-center justify-center gap-1 shadow-md"
          >
             ✕ إنهاء وحفظ الإسناد (تحديث الصفحة) 🔄
          </button>
       )}
    </div>
  );
}

/** لوحة تسعير الطلب (للمسودات والطلبات المعلقة) */
export function AdminPricingPanel({
  orderId,
  initialData,
  preparers,
  couriers,
  isDraft,
  onSuccess,
  hideContainer = false,
  footerActions,
  extraActions,
  icons = null,
  storeProducts = [],
  currentPreparerIds = [],
  regions = [],
  fishPricesRaw = "",
}: {
  orderId: string;
  initialData: any;
  preparers: { id: string; name: string }[];
  couriers?: { id: string; name: string }[];
  isDraft?: boolean;
  onSuccess?: () => void;
  hideContainer?: boolean;
  footerActions?: React.ReactNode;
  extraActions?: React.ReactNode;
  icons?: GlobalIconsConfig | null;
  storeProducts?: any[];
  currentPreparerIds?: string[];
  regions?: { id: string; name: string }[];
  fishPricesRaw?: string;
}) {
  // Alias for backward compatibility if needed elsewhere
  return <OrderPricingPanel
    orderId={orderId}
    initialData={initialData}
    preparers={preparers}
    couriers={couriers}
    isDraft={isDraft}
    onSuccess={onSuccess}
    hideContainer={hideContainer}
    footerActions={footerActions}
    extraActions={extraActions}
    icons={icons}
    storeProducts={storeProducts}
    currentPreparerIds={currentPreparerIds}
    regions={regions}
    fishPricesRaw={fishPricesRaw}
  />;
}


function cleanText(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "y") // لتجنب الخلط مع الياء
    .replace(/ي/g, "y")
    .replace(/[\u064B-\u065F]/g, "") // إزالة التشكيل
    .replace(/[^a-zA-Z0-9\u0621-\u064A\s]/g, " ") // إزالة الرموز الخاصة
    .replace(/\s+/g, " ")
    .trim();
}

function findStoreProductDetails(line: string, storeProducts: any[]): { salePrice: number; purchasePrice: number } | null {
  if (!line || !storeProducts || storeProducts.length === 0) return null;
  
  const cleanedLine = cleanText(line);
  if (!cleanedLine) return null;

  // 1. محاولة المطابقة التامة للمنتج
  for (const product of storeProducts) {
    const cleanedName = cleanText(product.name);
    if (cleanedName && cleanedLine === cleanedName) {
      if (product.hasVariants && product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          const cleanedVarName = cleanText(variant.name);
          if (cleanedVarName && cleanedLine.includes(cleanedVarName)) {
            return {
              salePrice: Number(variant.salePrice),
              purchasePrice: Number(variant.purchasePrice || product.purchasePrice || 0)
            };
          }
        }
      }
      return {
        salePrice: Number(product.salePrice),
        purchasePrice: Number(product.purchasePrice || 0)
      };
    }
  }

  // 2. محاولة المطابقة الجزئية (الاسم الأطول أولاً لتجنب التضارب)
  const sortedProducts = [...storeProducts].sort((a, b) => b.name.length - a.name.length);
  for (const product of sortedProducts) {
    const cleanedName = cleanText(product.name);
    if (cleanedName && cleanedLine.includes(cleanedName)) {
      if (product.hasVariants && product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          const cleanedVarName = cleanText(variant.name);
          if (cleanedVarName && cleanedLine.includes(cleanedVarName)) {
            return {
              salePrice: Number(variant.salePrice),
              purchasePrice: Number(variant.purchasePrice || product.purchasePrice || 0)
            };
          }
        }
      }
      return {
        salePrice: Number(product.salePrice),
        purchasePrice: Number(product.purchasePrice || 0)
      };
    }
  }

  return null;
}

// دالة مساعدة للحصول على فرع وصورة المنتج من قائمة منتجات المتجر
function findStoreProductBranchAndPhoto(line: string, storeProducts: any[]): { branchName: string | null; photoUrl: string | null } {
  if (!line || !storeProducts || storeProducts.length === 0) return { branchName: null, photoUrl: null };
  const cleanedLine = cleanText(line);
  if (!cleanedLine) return { branchName: null, photoUrl: null };

  for (const product of storeProducts) {
    const cleanedName = cleanText(product.name);
    if (cleanedName && (cleanedLine === cleanedName || cleanedLine.includes(cleanedName))) {
      let photoUrl: string | null = null;
      if (product.photoUrls && Array.isArray(product.photoUrls) && product.photoUrls.length > 0) {
        photoUrl = product.photoUrls[0];
      } else if (typeof product.photoUrls === 'string' && product.photoUrls) {
        photoUrl = product.photoUrls;
      }
      return {
        branchName: product.branch?.name || null,
        photoUrl
      };
    }
  }
  return { branchName: null, photoUrl: null };
}

export function OrderPricingPanel({
  orderId,
  initialData,
  preparers,
  couriers,
  isDraft,
  onSuccess,
  hideContainer = false,
  footerActions,
  extraActions,
  icons = null,
  storeProducts = [],
  currentPreparerIds = [],
  regions = [],
  fishPricesRaw = "",
}: {
  orderId: string;
  initialData: any;
  preparers: { id: string; name: string }[];
  couriers?: { id: string; name: string }[];
  isDraft?: boolean;
  onSuccess?: () => void;
  hideContainer?: boolean;
  footerActions?: React.ReactNode;
  extraActions?: React.ReactNode;
  icons?: GlobalIconsConfig | null;
  storeProducts?: any[];
  currentPreparerIds?: string[];
  regions?: { id: string; name: string }[];
  fishPricesRaw?: string;
}) {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>(initialData?.products || []);
  const [placesCount, setPlacesCount] = useState<number>(initialData?.placesCount || 1);
  const [noProfit, setNoProfit] = useState(!!initialData?.noProfit);
  const [filterType, setFilterType] = useState<'all' | 'unpriced' | 'priced'>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [activeBranch, setActiveBranch] = useState<string | null>(null);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [buyText, setBuyText] = useState("");
  const [sellText, setSellText] = useState("");
  const [isAdminFulfilled, setIsAdminFulfilled] = useState(false);
  const [pricingErr, setPricingErr] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showReassign, setShowReassign] = useState(false);
  const [selectedProductIndexes, setSelectedProductIndexes] = useState<number[]>([]);
  const [productAssigneeId, setProductAssigneeId] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [showAutoCourier, setShowAutoCourier] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [sortError, setSortError] = useState<string | null>(null);

  const [preAdminProducts, setPreAdminProducts] = useState<any[] | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [hideBuyPrice, setHideBuyPrice] = useState(false);
  const [hideSellPrice, setHideSellPrice] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicatePhone, setDuplicatePhone] = useState("");
  const [duplicateRegionId, setDuplicateRegionId] = useState("");
  const [regionSearch, setRegionSearch] = useState("");
  const [showRegionSuggestions, setShowRegionSuggestions] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [templateSuccess, setTemplateSuccess] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const fishPrices = useMemo(() => {
    return parseFishPricesList(fishPricesRaw || "");
  }, [fishPricesRaw]);

  const applyAutoFishPricing = () => {
    if (products.length === 0 || fishPrices.length === 0) return;
    let changed = false;
    const next = products.map((p) => {
      const buyNum = parseFloat(normalizeNumerals((p.buyAlf || "0").toString())) || 0;
      if (buyNum === 0) {
        const fishMatch = matchFishAndCalculatePrice(p.line, fishPrices);
        if (fishMatch) {
          changed = true;
          return {
            ...p,
            buyAlf: fishMatch.buyAlf.toString(),
            sellAlf: fishMatch.sellAlf.toString(),
            pricedBy: "تسعير تلقائي للسمك 🐟"
          };
        }
      }
      return p;
    });
    if (changed) {
      setProducts(next);
      hasChangedRef.current = true;
    }
  };

  useEffect(() => {
    if (products.length > 0 && fishPrices.length > 0) {
      applyAutoFishPricing();
    }
  }, [fishPrices, products.length]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (initialData?.customerPhone) {
      setDuplicatePhone(initialData.customerPhone);
    }
    if (initialData?.customerRegionId) {
      setDuplicateRegionId(initialData.customerRegionId);
    }
    if (initialData?.customerRegionName) {
      setRegionSearch(initialData.customerRegionName);
    }
  }, [initialData]);

  const handleCopyTemplate = () => {
    try {
      const productsText = products.map((p, index) => `${index + 1}. ${p.line}`).join("\n");
      const regionName = initialData?.customerRegionName || regions.find(r => r.id === (initialData?.customerRegionId || initialData?.regionId))?.name || "غير محددة";
      const landmarkText = initialData?.customerLandmark ? `\n${initialData.customerLandmark}` : "";
      
      const template = `${initialData?.customerPhone || "غير محدد"}
${regionName}${landmarkText}
${productsText}`;

      navigator.clipboard.writeText(template);
      setTemplateSuccess(true);
      setTimeout(() => setTemplateSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy template:", err);
    }
  };

  const handleDuplicateOrder = async () => {
    setIsDuplicating(true);
    setDuplicateError(null);
    try {
      const result = await duplicateOrderOrDraft(orderId, !!isDraft, duplicatePhone, duplicateRegionId);
      if (result.error) {
        setDuplicateError(result.error);
      } else if (result.ok && result.newOrderId) {
        setShowDuplicateModal(false);
        router.push(`${SECRET_ADMIN_PATH}/orders/${result.newOrderId}/price`);
      }
    } catch (err: any) {
      setDuplicateError(err.message || "حدث خطأ غير متوقع أثناء نسخ الطلب");
    } finally {
      setIsDuplicating(false);
    }
  };

  const sellInputRef = useRef<HTMLInputElement>(null);
  const buyInputRef = useRef<HTMLInputElement>(null);
  const hasChangedRef = useRef(false);

  useEffect(() => {
    if (!hasChangedRef.current) return;

    setIsSaving(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        await savePricingProgress(orderId, !!isDraft, products, placesCount, !!noProfit);
      } catch (err) {
        console.error("Auto save failed:", err);
      } finally {
        setIsSaving(false);
      }
    }, 1200);

    return () => clearTimeout(delayDebounceFn);
  }, [products, placesCount, noProfit, orderId, isDraft]);

  useEffect(() => {
    let touchStartClientY = 0;
    const preventPullToRefresh = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const clientY = touch.clientY;
      
      // التحقق من الحاويات الداخلية القابلة للتمرير
      let target = e.target as HTMLElement | null;
      let isAtTop = true;
      while (target) {
        if (target.scrollHeight > target.clientHeight) {
          if (target.scrollTop > 0) {
            isAtTop = false;
            break;
          }
        }
        target = target.parentElement;
      }

      if (isAtTop && window.scrollY === 0 && clientY > touchStartClientY) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartClientY = e.touches[0].clientY;
      }
    };
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", preventPullToRefresh, { passive: false });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", preventPullToRefresh);
    };
  }, []);

  const unpricedCount = useMemo(() => {
    return products.filter(p => !(parseFloat(normalizeNumerals((p.buyAlf || "0").toString())) > 0)).length;
  }, [products]);

  const pricedCount = useMemo(() => {
    return products.filter(p => parseFloat(normalizeNumerals((p.buyAlf || "0").toString())) > 0).length;
  }, [products]);

  const getNextUnpricedIndex = (currentIndex: number, currentProductsList: any[]) => {
    for (let i = currentIndex + 1; i < currentProductsList.length; i++) {
      const priced = parseFloat(normalizeNumerals((currentProductsList[i]?.buyAlf ?? "0").toString())) > 0;
      if (!priced) return i;
    }
    for (let i = 0; i < currentIndex; i++) {
      const priced = parseFloat(normalizeNumerals((currentProductsList[i]?.buyAlf ?? "0").toString())) > 0;
      if (!priced) return i;
    }
    return null;
  };

  const getNextIndex = (currentIndex: number) => {
    return currentIndex < products.length - 1 ? currentIndex + 1 : 0;
  };

  const getPrevIndex = (currentIndex: number) => {
    return currentIndex > 0 ? currentIndex - 1 : products.length - 1;
  };

  // تعبئة الحقول تلقائياً عند تغيير المنتج الذي يتم تعديله
  useEffect(() => {
    if (editingIndex !== null && products[editingIndex]) {
      const p = products[editingIndex];
      const priced = parseFloat(normalizeNumerals((p?.buyAlf ?? "0").toString())) > 0;
      setBuyText(priced ? p.buyAlf : "");
      setSellText(priced ? p.sellAlf : "");
      setIsAdminFulfilled(!!p.isFulfilledByAdmin);
      setPricingErr("");

      // تمرير وتركيز تلقائي
      setTimeout(() => {
        buyInputRef.current?.focus();
      }, 100);
    }
  }, [editingIndex, products]);

  const bound = updateOrderPricingByAdmin.bind(null, orderId);
  const [state, formAction, pending] = useActionState(bound, { ok: false });

  const totals = useMemo(() => {
    let buySum = 0;
    let sellSum = 0;
    products.forEach((p: any) => {
      const b = parseFloat(normalizeNumerals((p.buyAlf || "0").toString())) || 0;
      const s = parseFloat(normalizeNumerals((p.sellAlf || "0").toString())) || 0;
      buySum += b;
      sellSum += s;
    });
    const extra = calculateExtraAlfFromPlacesCount(placesCount);
    return { buySum, sellSum, extra, total: sellSum + extra };
  }, [products, placesCount]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (products.length > 0) {
        setIsSaving(true);
        try {
          await savePricingProgress(orderId, !!isDraft, products, placesCount, noProfit);
        } catch {}
        setIsSaving(false);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [products, placesCount, orderId, isDraft, noProfit]);

  const handleToggleNoProfit = async (newVal: boolean) => {
    setNoProfit(newVal);
    const updatedProducts = products.map(p => {
      const buyNum = parseFloat(normalizeNumerals((p.buyAlf || "0").toString())) || 0;
      if (buyNum > 0) {
        return {
          ...p,
          sellAlf: calculateAutoSellPrice(p.line, buyNum, newVal).toString()
        };
      }
      return p;
    });
    setProducts(updatedProducts);
    setIsSaving(true);
    await savePricingProgress(orderId, !!isDraft, updatedProducts, placesCount, newVal);
    setIsSaving(false);
  };

  const updateProduct = (idx: number, field: string, val: any) => {
    const next = [...products];
    next[idx] = { ...next[idx], [field]: val };
    setProducts(next);
    hasChangedRef.current = true;
  };

  const markAllAsAdminFulfilled = () => {
    setPreAdminProducts(products); // حفظ النسخة الأصلية للتراجع
    const next = products.map(p => ({
      ...p,
      isFulfilledByAdmin: true,
      assignedPreparerId: null,
      assignedPreparerName: "تجهيز الإدارة 🏛️",
      pricedBy: "تجهيز الإدارة 🏛️"
    }));
    setProducts(next);
    hasChangedRef.current = true;
  };

  const revertAdminFullfillment = () => {
    if (preAdminProducts) {
      setProducts(preAdminProducts);
      setPreAdminProducts(null);
      hasChangedRef.current = true;
    }
  };

  const applyPricingPanel = () => {
    if (editingIndex === null) return;
    const bNum = parseFloat(normalizeNumerals(buyText)) || 0;
    const sNum = parseFloat(normalizeNumerals(sellText)) || 0;
    if (bNum <= 0 || sNum <= 0) {
      setPricingErr("يرجى إدخال أسعار صحيحة");
      return;
    }
    const next = [...products];
    next[editingIndex] = {
      ...next[editingIndex],
      buyAlf: bNum.toString(),
      sellAlf: sNum.toString(),
      isFulfilledByAdmin: isAdminFulfilled,
      assignedPreparerId: isAdminFulfilled ? null : next[editingIndex].assignedPreparerId,
      assignedPreparerName: isAdminFulfilled ? "تجهيز الإدارة 🏛️" : next[editingIndex].assignedPreparerName,
      pricedBy: "الإدارة"
    };
    setProducts(next);

    const nextUnpriced = getNextUnpricedIndex(editingIndex, next);
    if (nextUnpriced !== null) {
      setEditingIndex(nextUnpriced);
    } else {
      setEditingIndex(null);
    }
    setPricingErr("");
  };

  const suggestedPrices = useMemo(() => {
    const buyNum = parseFloat(normalizeNumerals(buyText)) || 0;
    if (buyNum <= 0) return [];
    let limit = 1.0;
    if (buyNum < 2) {
      limit = 1.0;
    } else if (buyNum < 5) {
      limit = 2.0;
    } else if (buyNum < 10) {
      limit = 3.0;
    } else {
      limit = 5.0;
    }
    const prices: number[] = [];
    for (let offset = 0.25; offset <= limit; offset += 0.25) {
      prices.push(parseFloat((buyNum + offset).toFixed(2)));
    }
    return prices;
  }, [buyText]);

  const applyPriceDirectly = (sellVal: number) => {
    if (editingIndex === null) return;
    const bNum = parseFloat(normalizeNumerals(buyText)) || 0;
    if (bNum <= 0 || sellVal <= 0) return;
    const next = [...products];
    next[editingIndex] = {
      ...next[editingIndex],
      buyAlf: bNum.toString(),
      sellAlf: sellVal.toString(),
      isFulfilledByAdmin: isAdminFulfilled,
      assignedPreparerId: isAdminFulfilled ? null : next[editingIndex].assignedPreparerId,
      assignedPreparerName: isAdminFulfilled ? "تجهيز الإدارة 🏛️" : next[editingIndex].assignedPreparerName,
      pricedBy: "الإدارة"
    };
    setProducts(next);

    const nextUnpriced = getNextUnpricedIndex(editingIndex, next);
    if (nextUnpriced !== null) {
      setEditingIndex(nextUnpriced);
    } else {
      setEditingIndex(null);
    }
    setPricingErr("");
  };

  const cancelPricingPanel = () => {
    setEditingIndex(null);
    setPricingErr("");
  };

  const resetProductPricing = (idx: number) => {
    const next = [...products];
    next[idx] = { ...next[idx], buyAlf: "0", sellAlf: "0", isFulfilledByAdmin: false };
    setProducts(next);
    hasChangedRef.current = true;
  };

  const addBulkProducts = () => {
    const lines = bulkText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;
    const newItems = lines.map(line => ({
      line,
      buyAlf: "0",
      sellAlf: "0",
      isFulfilledByAdmin: false
    }));
    setProducts([...products, ...newItems]);
    setBulkText("");
    setShowBulkAdd(false);
    hasChangedRef.current = true;
  };

  const toggleProductSelection = (idx: number) => {
    setSelectedProductIndexes(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const toggleSelectAllProducts = () => {
    if (selectedProductIndexes.length === products.length) {
      setSelectedProductIndexes([]);
    } else {
      setSelectedProductIndexes(products.map((_, i) => i));
    }
  };

  const clearSelection = () => {
    setSelectedProductIndexes([]);
    setProductAssigneeId("");
  };

  const assignSelectedProductsToPreparer = () => {
    if (!productAssigneeId) return;
    const next = [...products];
    const prep = preparers.find(p => p.id === productAssigneeId);
    selectedProductIndexes.forEach(idx => {
      next[idx] = {
        ...next[idx],
        assignedPreparerId: productAssigneeId,
        assignedPreparerName: prep?.name || "",
        isFulfilledByAdmin: false
      };
    });
    setProducts(next);
    clearSelection();
    hasChangedRef.current = true;
  };

  async function handleAiSort() {
    if (products.length === 0) return;
    setIsSorting(true);
    setSortError(null);
    try {
      const textToSend = products.map(p => p.line).join("\n");
      const res = await fetch("/api/ai/sort-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend })
      });
      const data = await res.json();
      if (data.error) {
        setSortError(data.error);
      } else if (data.sortedText) {
        const sortedLines = data.sortedText
          .split("\n")
          .map((l: string) => l.trim())
          .filter(Boolean);

        const newProducts: any[] = [];
        sortedLines.forEach((line: string) => {
          const matchedOriginal = products.find(
            (orig) => orig.line.trim().toLowerCase() === line.toLowerCase()
          );
          if (matchedOriginal) {
            newProducts.push({
              ...matchedOriginal
            });
          } else {
            newProducts.push({
              line,
              buyAlf: "0",
              sellAlf: "0",
              isFulfilledByAdmin: false
            });
          }
        });

        // لضمان الأمان وعدم ضياع أي منتج
        products.forEach((orig) => {
          if (!newProducts.some((p) => p.line.toLowerCase() === orig.line.toLowerCase())) {
            newProducts.push(orig);
          }
        });

        setProducts(newProducts);
        hasChangedRef.current = true;
      }
    } catch (err) {
      setSortError("فشل الاتصال بخدمة الترتيب.");
    } finally {
      setIsSorting(false);
    }
  }

  const findPreparerName = (id?: string | null) => preparers.find(p => p.id === id)?.name;

  const allProductsPriced = products.length > 0 && products.every(p => parseFloat(normalizeNumerals((p.buyAlf || "0").toString())) > 0);
  const canSubmitFinal = allProductsPriced && placesCount > 0;

  useEffect(() => {
    if (state.ok && onSuccess) onSuccess();
  }, [state.ok, onSuccess]);

  const initialPreparerIds = useMemo(() => {
    if (currentPreparerIds && currentPreparerIds.length > 0) {
      return currentPreparerIds;
    }
    const ids = new Set<string>();
    if (initialData?.preparerId) {
      ids.add(initialData.preparerId);
    }
    products.forEach(p => {
      if (p.assignedPreparerId) {
        ids.add(p.assignedPreparerId);
      }
    });
    return Array.from(ids);
  }, [products, initialData, currentPreparerIds]);

  const branches = useMemo(() => {
    const bSet = new Set<string>();
    products.forEach(p => {
      const details = findStoreProductBranchAndPhoto(p.line, storeProducts);
      const b = details.branchName || "أخرى";
      bSet.add(b);
    });
    return Array.from(bSet).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [products, storeProducts]);

  const stats = useMemo(() => {
    const total = products.length;
    const priced = products.filter(p => parseFloat(normalizeNumerals((p.buyAlf || "0").toString())) > 0).length;
    const percent = total > 0 ? Math.round((priced / total) * 100) : 0;
    return { total, priced, percent };
  }, [products]);

  const orderedForButtons = useMemo(() => {
    const withIndex = products.map((p, idx) => {
      const details = findStoreProductBranchAndPhoto(p.line, storeProducts);
      return {
        p,
        idx,
        branch: details.branchName || "أخرى",
        photoUrl: details.photoUrl
      };
    });

    // تطبيق فلتر البحث
    let filtered = searchTerm.trim()
      ? withIndex.filter(item => item.p.line.toLowerCase().includes(searchTerm.toLowerCase()))
      : withIndex;

    // تطبيق فلتر الفرع
    if (activeBranch) {
      filtered = filtered.filter(item => item.branch === activeBranch);
    }

    // تطبيق فلتر الحالة (الكل، غير مسعر، مسعر)
    if (filterType === 'unpriced') {
      filtered = filtered.filter(item => !(parseFloat(normalizeNumerals((item.p.buyAlf || "0").toString())) > 0));
    } else if (filterType === 'priced') {
      filtered = filtered.filter(item => parseFloat(normalizeNumerals((item.p.buyAlf || "0").toString())) > 0);
    }

    return filtered.sort((a, b) => {
      const aPriced = parseFloat(normalizeNumerals((a.p.buyAlf || "0").toString())) > 0;
      const bPriced = parseFloat(normalizeNumerals((b.p.buyAlf || "0").toString())) > 0;

      // 1. غير المسعر يظهر أولاً
      if (aPriced !== bPriced) {
        return aPriced ? 1 : -1;
      }

      // 2. الترتيب حسب اسم الفرع/المحل
      if (a.branch !== b.branch) {
        return a.branch.localeCompare(b.branch, 'ar');
      }

      // 3. الترتيب الأصلي
      return a.idx - b.idx;
    });
  }, [products, storeProducts, searchTerm, activeBranch, filterType]);

  return (
    <div className={hideContainer ? "relative text-right h-full flex flex-col" : "relative overflow-hidden rounded-[2.5rem] border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] ring-1 ring-white/20 dark:ring-white/10 text-right transition-colors h-full flex flex-col"} dir="rtl">
      <form
        id="order-pricing-form"
        action={formAction}
        className={hideContainer ? "flex-1 flex flex-col overflow-hidden relative" : "flex-1 flex flex-col overflow-hidden relative p-3 sm:p-5"}
        onKeyDown={(e) => {
           if (e.key === "Enter" && editingIndex !== null) {
              e.preventDefault();
           }
        }}
      >
        <input type="hidden" name="productsJson" value={JSON.stringify(products)} />
        <input type="hidden" name="placesCount" value={placesCount} />
        <input type="hidden" name="noProfit" value={noProfit ? "true" : "false"} />
        <input type="hidden" id="submit-type-input" name="submitType" value="" />
        {isDraft && <input type="hidden" name="autoCourierId" value={String(initialData?.autoCourierId ?? "")} />}
        {isDraft && <input type="hidden" name="shopId" value={initialData?.shopId} />}
        {isDraft && <input type="hidden" name="isDraft" value="true" />}

        {/* Master Top Bar */}
        <div className="sticky top-0 z-[100] bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md p-3 border-b border-white/10 -mx-1 shadow-2xl rounded-b-[1.5rem] mb-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 w-full text-white">
              {onSuccess && (
                <button
                  type="button"
                  onClick={onSuccess}
                  className="h-10 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-black text-slate-300 border border-slate-700 active:scale-95 transition-all flex items-center gap-1 shrink-0"
                >
                  ✕ إغلاق
                </button>
              )}

              {/* وضع زر التحديد الفوري كخيار مباشر في الشريط العلوي */}
              <button
                type="button"
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setDeleteMode(false);
                  setShowBulkAdd(false);
                }}
                className={`h-10 px-3.5 rounded-xl text-[11px] font-black shadow-md transition-all active:scale-95 flex items-center gap-1.5 shrink-0 ${
                  selectionMode
                    ? "bg-sky-600 text-white ring-2 ring-sky-300"
                    : "bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700"
                }`}
              >
                🔘 وضع التحديد
              </button>

              {/* زر الخيارات المنسدل الموحد */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                  className={`h-10 px-4 rounded-xl text-[11px] font-black shadow-md transition-all flex items-center gap-1.5 active:scale-95 ${
                    showOptionsMenu
                      ? "bg-amber-500 text-white ring-2 ring-amber-300"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  }`}
                >
                  ⚙️ الخيارات
                </button>

                {false && showOptionsMenu && (
                  <>
                    <div className="fixed inset-0 z-[1900]" onClick={() => setShowOptionsMenu(false)} />
                    <div className="fixed left-3 top-[4.5rem] w-72 bg-slate-900/98 dark:bg-slate-950/98 backdrop-blur-2xl border border-slate-800 rounded-3xl p-4 shadow-2xl z-[2000] text-right space-y-3 animate-in fade-in slide-in-from-top-2 duration-200" dir="rtl">
                      
                      {/* 1. حقل البحث مدمج هنا وجانبه زر تجهيز الإدارة */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="ابحث عن مادة..."
                            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-2 pr-8 pl-3 text-xs font-bold text-white outline-none focus:border-indigo-400 transition-all shadow-inner"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                          {searchTerm && (
                            <button
                              type="button"
                              onClick={() => setSearchTerm("")}
                              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 bg-slate-700 text-slate-300 rounded-full text-[8px] flex items-center justify-center"
                            >✕</button>
                          )}
                        </div>
                        {preAdminProducts ? (
                          <button
                            type="button"
                            onClick={() => { revertAdminFullfillment(); setShowOptionsMenu(false); }}
                            className="h-8 px-2 rounded-xl text-[9px] font-black bg-indigo-650 hover:bg-indigo-700 text-white transition-all active:scale-95 flex items-center justify-center gap-1 shrink-0 shadow-sm"
                            title="تراجع عن تجهيز الإدارة"
                          >
                            🏛️ تراجع
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { markAllAsAdminFulfilled(); setShowOptionsMenu(false); }}
                            className="h-8 px-2.5 rounded-xl text-[9px] font-black bg-amber-600 hover:bg-amber-700 text-white transition-all active:scale-95 flex items-center justify-center gap-1 shrink-0 shadow-sm"
                            title="تجهيز الكل من الإدارة"
                          >
                            🏛️ تجهيز إدارة
                          </button>
                        )}
                      </div>

                      {/* 2. أزرار الحفظ والإرسال */}
                      <div className="border-b border-slate-800/50 pb-2 flex flex-col gap-1">
                        {isDraft ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="submit"
                              name="submitType"
                              value="admin_approve"
                              disabled={pending}
                              onClick={() => setShowOptionsMenu(false)}
                              className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[9px] font-black text-white shadow active:scale-95 transition-all flex items-center justify-center gap-1"
                            >
                              {pending ? "..." : <><DynamicIcon icon={icons?.ui_success} fallback="💾" width={10} height={10} /> مسودة معتمدة</>}
                            </button>
                            <button
                              type="submit"
                              name="submitType"
                              value="final_send"
                              disabled={pending}
                              onClick={() => setShowOptionsMenu(false)}
                              className="h-9 rounded-xl bg-violet-600 hover:bg-violet-750 text-[9px] font-black text-white shadow active:scale-95 transition-all flex items-center justify-center gap-1"
                            >
                              {pending ? "..." : <><DynamicIcon icon={icons?.ui_rocket} fallback="🚀" width={10} height={10} /> إرسال نهائي</>}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="submit"
                            disabled={pending}
                            onClick={() => setShowOptionsMenu(false)}
                            className="w-full h-9 rounded-xl bg-sky-600 hover:bg-sky-700 text-[10px] font-black text-white shadow active:scale-95 transition-all flex items-center justify-center gap-1"
                          >
                            {pending ? "..." : <><DynamicIcon icon={icons?.ui_success} fallback="✅" width={12} height={12} /> حفظ وإرسال</>}
                          </button>
                        )}
                      </div>

                      {/* 3. أوامر التجهيز والإسناد */}
                      <div className="border-b border-slate-800/50 pb-2 flex flex-col gap-1">
                        <div className="grid grid-cols-2 gap-1.5">
                          {isDraft && couriers ? (
                            <button
                              type="button"
                              onClick={() => { setShowAutoCourier(!showAutoCourier); setShowOptionsMenu(false); }}
                              className={`h-8 rounded-xl text-[9px] font-black text-white active:scale-95 transition-all flex items-center justify-center gap-1 ${
                                showAutoCourier ? "bg-violet-800" : "bg-violet-650 hover:bg-violet-750"
                              }`}
                            >
                              👤 إسناد تلقائي
                            </button>
                          ) : (
                            <div className="h-8 rounded-xl bg-slate-800/40 text-[8px] font-bold text-slate-500 flex items-center justify-center">إسناد تلقائي مقفل</div>
                          )}
                          <button
                            type="button"
                            onClick={() => { setShowReassign(!showReassign); setShowOptionsMenu(false); }}
                            className="h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-[9px] font-black text-white flex items-center justify-center gap-1 transition-all active:scale-95"
                          >
                            👤 إسناد للمجهزين
                          </button>
                        </div>
                      </div>

                      {/* 4. أوضاع التحكم السريعة */}
                      <div className="border-b border-slate-800/50 pb-2 flex flex-col gap-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                             type="button"
                             onClick={() => {
                               setShowBulkAdd(!showBulkAdd);
                               setDeleteMode(false);
                               setSelectionMode(false);
                               setShowOptionsMenu(false);
                             }}
                             className="h-8 rounded-xl text-[9px] font-black bg-amber-500 text-white hover:bg-amber-600 transition-all active:scale-95 flex items-center justify-center gap-1"
                          >
                             ➕ إضافة منتج
                          </button>
                          <button
                             type="button"
                             onClick={() => {
                               setDeleteMode(!deleteMode);
                               setShowBulkAdd(false);
                               setSelectionMode(false);
                               setShowOptionsMenu(false);
                             }}
                             className={`h-8 rounded-xl text-[9px] font-black transition-all active:scale-95 flex items-center justify-center gap-1 ${
                               deleteMode ? "bg-rose-600 text-white animate-pulse" : "bg-slate-800 hover:bg-slate-700 text-rose-450"
                             }`}
                          >
                             🗑️ حذف منتج
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                             type="button"
                             disabled={isSorting}
                             onClick={() => { handleAiSort(); setShowOptionsMenu(false); }}
                             className="h-8 rounded-xl text-[9px] font-black bg-indigo-650 text-white hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                             ترتيب 🪄
                          </button>
                          <button
                            type="button"
                            onClick={() => { handleToggleNoProfit(!noProfit); setShowOptionsMenu(false); }}
                            className={`h-8 rounded-xl text-[9px] font-black transition-all active:scale-95 flex items-center justify-center gap-1 ${
                              noProfit ? "bg-rose-600 text-white animate-pulse" : "bg-slate-800 text-rose-450"
                            }`}
                          >
                            🚫 إيقاف الربح
                          </button>
                        </div>
                        {fishPrices.length > 0 && (
                          <button
                            type="button"
                            onClick={() => { applyAutoFishPricing(); setShowOptionsMenu(false); }}
                            className="w-full h-8 mt-1.5 rounded-xl text-[9px] font-black bg-gradient-to-r from-sky-600 to-indigo-600 text-white hover:from-sky-750 hover:to-indigo-750 transition-all active:scale-95 flex items-center justify-center gap-1"
                          >
                            🐟 تسعير السمك تلقائياً
                          </button>
                        )}
                      </div>

                      {/* 5. أدوات ونسخ الطلب وخيار إخفاء البيع */}
                      <div className="border-b border-slate-800/50 pb-2 flex flex-col gap-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={handleCopyTemplate}
                            className={`h-8 rounded-xl text-[9px] font-black text-white active:scale-95 transition-all flex items-center justify-center gap-1 ${
                              templateSuccess ? "bg-emerald-600" : "bg-teal-650 hover:bg-teal-750"
                            }`}
                          >
                            {templateSuccess ? "📋 تم النسخ!" : "📝 كليشة الطلب"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowDuplicateModal(true); setShowOptionsMenu(false); }}
                            className="h-8 rounded-xl bg-violet-650 hover:bg-violet-750 text-[9px] font-black text-white flex items-center justify-center gap-1 transition-all active:scale-95"
                          >
                            👯 نسخ وتكرار
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setHideSellPrice(!hideSellPrice); setShowOptionsMenu(false); }}
                          className={`w-full h-8 rounded-xl text-[9px] font-black transition-all active:scale-95 flex items-center justify-center gap-1 ${
                            hideSellPrice ? "bg-indigo-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-indigo-400"
                          }`}
                        >
                          {hideSellPrice ? "👁️ إظهار سعر البيع" : "🙈 إخفاء سعر البيع"}
                        </button>
                      </div>

                      {/* 6. خيارات العرض المتقدمة (سعر المتجر وعدد المحلات بجانب بعضهما) */}
                      <div className="flex flex-col gap-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400">إخفاء سعر المتجر:</span>
                          <button
                            type="button"
                            onClick={() => { setHideBuyPrice(!hideBuyPrice); setShowOptionsMenu(false); }}
                            className={`h-7 px-3 rounded-lg text-[9px] font-black transition-all active:scale-95 flex items-center justify-center gap-1 ${
                              hideBuyPrice ? "bg-amber-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-amber-400"
                            }`}
                          >
                            {hideBuyPrice ? "👁️ إظهار" : "🙈 إخفاء"}
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400">عدد المحلات:</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPlacesCount(Math.max(1, placesCount - 1))}
                              className="h-7 w-7 rounded-lg bg-slate-800 text-white font-black text-xs flex items-center justify-center active:scale-95"
                            >
                              -
                            </button>
                            <span className="px-3 font-mono font-black text-xs text-amber-400">{placesCount}</span>
                            <button
                              type="button"
                              onClick={() => setPlacesCount(Math.min(10, placesCount + 1))}
                              className="h-7 w-7 rounded-lg bg-slate-800 text-white font-black text-xs flex items-center justify-center active:scale-95"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* مؤشر الإنجاز */}
        <div className="p-3 bg-white/40 dark:bg-slate-850/40 rounded-2xl border border-slate-150 dark:border-slate-800 mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black text-slate-500">مستوى الإنجاز</span>
            
            {/* الإجمالي الكلي مدمج في بلوك الإنجاز */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 select-none">
               <span className="text-[8px] font-black text-slate-400">الإجمالي:</span>
               <span className="text-[10px] font-black font-mono text-emerald-700 dark:text-emerald-400">
                  {totals.total.toLocaleString()} الف
               </span>
            </div>

            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${stats.percent === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {stats.priced} من {stats.total} ({stats.percent}%)
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                stats.percent < 40 ? 'bg-rose-500' : stats.percent < 80 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${stats.percent}%` }}
            />
          </div>
        </div>

        {/* أزرار التصفية السريعة للفروع */}
        {branches.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1.5 no-scrollbar -mx-1 px-1 mb-2">
            <button
              type="button"
              onClick={() => setActiveBranch(null)}
              className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black transition-all ${!activeBranch ? 'bg-indigo-650 text-white shadow-md' : 'bg-slate-150 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'}`}
            > الكل </button>
            {branches.map(b => (
              <button
                type="button"
                key={b}
                onClick={() => setActiveBranch(b === activeBranch ? null : b)}
                className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black transition-all ${activeBranch === b ? 'bg-indigo-650 text-white shadow-md' : 'bg-slate-150 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'}`}
              >
                {b}
              </button>
            ))}
          </div>
        )}


          {/* أزرار التصفية السريعة للحالة */}
          <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-900/40 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${filterType === 'all' ? 'bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-755'}`}
            >
              الكل ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('unpriced')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 ${filterType === 'unpriced' ? 'bg-amber-500 text-white shadow' : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'}`}
            >
              ⚠️ غير مسعر ({unpricedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('priced')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 ${filterType === 'priced' ? 'bg-emerald-500 text-white shadow' : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'}`}
            >
              ✅ تم التسعير ({pricedCount})
            </button>
          </div>

        {sortError && <p className="mb-3 text-center text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-lg dark:bg-rose-950/20 dark:text-rose-400">{sortError}</p>}
        {showBulkAdd && (
          <div className="mb-3 p-3 bg-white dark:bg-slate-800 rounded-[1.5rem] border border-amber-200 dark:border-amber-900/50 shadow-inner animate-in slide-in-from-top-2">
             <label className="text-[10px] font-black text-amber-600 mb-1.5 block">إضافة منتجات متعددة (كل سطر منتج)</label>
             <textarea
               autoFocus
               value={bulkText}
               onChange={(e) => setBulkText(e.target.value)}
               rows={3}
               className="w-full bg-slate-50 dark:bg-black/20 rounded-xl p-2 text-xs font-bold border-none outline-none focus:ring-1 ring-amber-400"
               placeholder="مثال:&#10;شاورما لحم&#10;كولا بارد"
             />
             <div className="flex gap-2 mt-2">
               <button type="button" onClick={addBulkProducts} className="flex-1 bg-amber-500 text-white py-2 rounded-xl text-[10px] font-black">إضافة القائمة</button>
               <button type="button" onClick={() => setShowBulkAdd(false)} className="px-3 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-xl text-[10px] font-black">إلغاء</button>
             </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-1 custom-scrollbar pb-32">
          {showReassign && <div className="mt-2 mb-4 animate-in slide-in-from-top-2"><AssignToPreparerPanel orderId={orderId} preparers={preparers} isDraft={isDraft} initialPreparerIds={initialPreparerIds} onSuccess={() => { setShowReassign(false); window.location.reload(); }} icons={icons || undefined} hideContainer={true} /></div>}

          {selectedProductIndexes.length > 0 && (
             <div className="rounded-xl bg-sky-900 p-2 shadow-lg mb-4">
               <div className="flex flex-col gap-1.5">
                 <p className="text-[10px] font-black text-white">تخصيص {selectedProductIndexes.length} منتج لـ:</p>
                 <div className="flex gap-1">
                   <select value={productAssigneeId} onChange={(e) => setProductAssigneeId(e.target.value)} className="flex-1 rounded-lg border-none bg-white p-1.5 text-[10px] font-black outline-none text-slate-900">
                     <option value="">اختر المجهز</option>
                     {preparers.map((prep) => <option key={prep.id} value={prep.id}>{prep.name}</option>)}
                   </select>
                   <button type="button" onClick={assignSelectedProductsToPreparer} disabled={!productAssigneeId} className="rounded-lg bg-emerald-500 px-3 text-[10px] font-black text-white">تطبيق</button>
                   <button type="button" onClick={clearSelection} className="text-[9px] font-bold text-sky-200">إلغاء</button>
                 </div>
               </div>
             </div>
          )}

          {/* تصميم البطاقات الشبكي للمدير */}
          <div className="grid grid-cols-2 gap-1.5">
            {orderedForButtons.map(({ p, idx: i, branch, photoUrl }) => {
              const priced = parseFloat(normalizeNumerals((p.buyAlf || "0").toString())) > 0;
              const isSelected = selectedProductIndexes.includes(i);
              const active = i === editingIndex;
              const prepName = findPreparerName(p?.assignedPreparerId) || p?.assignedPreparerName;
              const isMeat = isMeatProduct(p.line);

              return (
                <div
                  key={`${i}-${p.line}`}
                  className={`w-full relative flex items-center gap-2 rounded-xl border-2 p-2 text-start transition min-h-[64px] ${
                    isSelected ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40 ring-2 ring-sky-250 shadow-md scale-[1.01]" :
                    active ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 ring-2 ring-indigo-200" :
                    priced ? "border-emerald-800 bg-emerald-900 text-white" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm"
                  } cursor-pointer`}
                  onClick={() => {
                    if (selectionMode) {
                      toggleProductSelection(i);
                    } else if (deleteMode) {
                      setProducts(products.filter((_, idx) => idx !== i));
                    } else {
                      setEditingIndex(i);
                    }
                  }}
                >

                  {/* صورة المنتج */}
                  {photoUrl && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImageUrl(resolvePublicAssetSrc(photoUrl)!);
                        setPreviewZoom(1);
                      }}
                      className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-slate-100 bg-white/10 active:scale-90 transition-transform cursor-zoom-in mt-2"
                    >
                      <img
                        src={resolvePublicAssetSrc(photoUrl)!}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 h-full mt-2">
                    <p className={`text-[10px] font-black leading-tight line-clamp-2 pr-1 flex items-center gap-1 ${
                      isSelected ? "text-sky-900 dark:text-sky-100" :
                      active ? "text-indigo-900 dark:text-indigo-100" :
                      priced ? "text-white" : "text-slate-800 dark:text-slate-200"
                    }`}>
                      {priced && <span className="shrink-0">✅</span>}
                      <span>
                        {p.line}
                        {(() => {
                          const details = findStoreProductDetails(p.line, storeProducts);
                          if (!details) return null;
                          return (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = [...products];
                                next[i] = {
                                  ...next[i],
                                  sellAlf: details.salePrice.toString(),
                                  buyAlf: (parseFloat(normalizeNumerals(next[i].buyAlf || "0")) > 0) ? next[i].buyAlf : details.purchasePrice.toString()
                                };
                                setProducts(next);
                                if (editingIndex === i) {
                                  setSellText(details.salePrice.toString());
                                  if (!(parseFloat(normalizeNumerals(buyText || "0")) > 0)) {
                                    setBuyText(details.purchasePrice.toString());
                                  }
                                }
                              }}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black bg-violet-50/80 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 border border-violet-200/50 dark:border-violet-900/30 hover:bg-violet-100 hover:text-violet-800 transition cursor-pointer shrink-0 mr-1 inline-block"
                              title="انقر لاعتماده كسعر بيع بالطلبية"
                            >
                              🏪 متجر: {details.salePrice}
                            </span>
                          );
                        })()}
                      </span>
                    </p>

                    <div className="flex flex-col gap-0.5 mt-1">
                      {branch && (
                        <p className={`text-[7px] font-black px-1 py-0.5 rounded whitespace-nowrap self-start ${
                          isSelected ? 'bg-sky-100/80 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' :
                          active ? 'bg-indigo-100/80 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' :
                          priced ? 'bg-emerald-800 text-emerald-200' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700'
                        }`}>
                          📍 {branch}
                        </p>
                      )}

                      {prepName && (
                        <span className={`text-[7px] font-bold flex items-center gap-0.5 self-start ${
                          p.isFulfilledByAdmin ? "text-amber-500" :
                          isSelected ? "text-sky-700 dark:text-sky-300" :
                          active ? "text-indigo-700 dark:text-indigo-300" :
                          priced ? "text-emerald-300" : "text-slate-400"
                        }`}>
                          👤 {prepName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* شارة السعر */}
                  <div className="absolute top-1 left-1 flex gap-1 items-center">
                    {priced ? (
                      <div className="flex gap-0.5">
                        {!hideBuyPrice && (
                          <span className={`font-mono text-[8px] font-black px-1 py-0.5 rounded shadow-sm ${priced ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>{p.buyAlf}</span>
                        )}
                        {!hideSellPrice && (
                          <span className="font-mono text-[8px] font-black px-1 py-0.5 rounded shadow-sm bg-indigo-500 text-white">{p.sellAlf}</span>
                        )}
                      </div>
                    ) : (
                      isMeat && (
                        <span className="text-[7px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 shadow-sm">تسعير</span>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </form>

      {/* SetDraftAutoCourierPanel - Outside main form to avoid nested forms */}
      {isDraft && showAutoCourier && couriers && (
        <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30">
          <SetDraftAutoCourierPanel
            draftId={orderId}
            couriers={couriers}
            currentCourierId={initialData?.autoCourierId}
            currentCourierName={couriers.find(c => c.id === initialData?.autoCourierId)?.name}
            icons={icons}
            onSuccess={() => {
              window.location.reload();
            }}
          />
        </div>
      )}
      {/* نافذة التسعير المنبثقة الذكية للمدير */}
      {editingIndex !== null && isMounted && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="absolute inset-0" onClick={cancelPricingPanel} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="bg-sky-600 p-3 sm:p-4 text-white flex items-center justify-between gap-3">
               <div className="flex items-center gap-1.5 shrink-0" dir="ltr">
                  <button
                    type="button"
                    onClick={() => {
                      const prevIdx = getPrevIndex(editingIndex);
                      setEditingIndex(prevIdx);
                    }}
                    className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center font-bold text-white transition active:scale-90"
                    title="المنتج السابق"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = getNextIndex(editingIndex);
                      setEditingIndex(nextIdx);
                    }}
                    className="h-8 w-8 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center font-bold text-white transition active:scale-90"
                    title="المنتج التالي"
                  >
                    ▶
                  </button>
               </div>
               <div className="min-w-0 flex-1 text-right">
                  <p className="text-[9px] font-black opacity-80">تسعير المنتج ({editingIndex + 1} من {products.length}):</p>
                  <p className="truncate text-xs sm:text-sm font-black">{products[editingIndex]?.line}</p>
               </div>
               <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAdminFulfilled(!isAdminFulfilled)}
                    className={`h-8 px-2 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all ${
                      isAdminFulfilled
                        ? "bg-amber-500 text-white shadow-inner animate-pulse ring-1 ring-amber-400"
                        : "bg-white/10 hover:bg-white/20 text-white"
                    }`}
                    title="تجهيز المادة من الإدارة وتجاوز الموردين"
                  >
                    🏛️ {isAdminFulfilled ? "تجهيز إدارة: نعم" : "تجهيز إدارة"}
                  </button>
                  <button type="button" onClick={cancelPricingPanel} className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 transition flex items-center justify-center shrink-0">✕</button>
               </div>
            </div>

            <div className="p-6 text-right">
              <div className="mb-4">
                <label className="text-[10px] font-black text-slate-500 mb-1 block">تعديل اسم المنتج (اختياري)</label>
                <input
                  type="text"
                  value={products[editingIndex]?.line}
                  onChange={(e) => updateProduct(editingIndex, "line", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-sm font-bold outline-none"
                />
              </div>


              {/* اقتراحات الكسور الذكية للمدير (بناءً على الشراء) */}
              {(() => {
                const typedValue = parseFloat(buyText);
                if (isNaN(typedValue) || typedValue <= 0) return null;

                const base = Math.floor(typedValue);
                const fractions = [0, 0.25, 0.5, 0.75];

                return (
                  <div className="grid grid-cols-4 gap-1.5 mb-4 animate-in slide-in-from-top-2 duration-300">
                    {fractions.map(frac => {
                      const total = base + frac;
                      return (
                        <button
                          key={frac}
                          type="button"
                          onClick={() => {
                            setBuyText(total.toString());
                            setSellText(calculateAutoSellPrice(products[editingIndex].line, total, noProfit).toString());
                          }}
                          className="py-2 rounded-xl text-xs font-black bg-indigo-600 text-white active:scale-95 transition-all"
                        >
                          {total}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 mb-1 block text-center">سعر الشراء</label>
                  <input
                    ref={buyInputRef}
                    value={buyText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBuyText(val);
                      const buyNum = parseFloat(normalizeNumerals(val)) || 0;
                      if (buyNum > 0) {
                        setSellText(calculateAutoSellPrice(products[editingIndex].line, buyNum, noProfit).toString());
                      }
                    }}
                    onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                          e.preventDefault();
                          sellInputRef.current?.focus();
                       }
                    }}
                    dir="ltr"
                    inputMode="decimal"
                    className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 py-3 text-center font-mono text-lg font-black outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-sky-600 mb-1 block text-center">سعر البيع</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const currentSell = parseFloat(normalizeNumerals(sellText)) || 0;
                        const nextSell = Math.max(0, currentSell - 0.25);
                        setSellText(nextSell.toString());
                      }}
                      className="h-12 w-8 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 text-sm font-black flex items-center justify-center border border-rose-200/50 transition active:scale-95 shrink-0"
                    >
                      -
                    </button>
                    <input
                      ref={sellInputRef}
                      value={sellText}
                      onChange={(e) => setSellText(e.target.value)}
                      onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                            e.preventDefault();
                            applyPricingPanel();
                         }
                      }}
                      dir="ltr"
                      inputMode="decimal"
                      className="w-full flex-1 rounded-2xl border-2 border-sky-100 bg-sky-50 dark:bg-slate-800 dark:border-slate-700 py-3 text-center font-mono text-lg font-black outline-none focus:border-sky-500 text-slate-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const currentSell = parseFloat(normalizeNumerals(sellText)) || 0;
                        setSellText((currentSell + 0.25).toString());
                      }}
                      className="h-12 w-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-600 text-sm font-black flex items-center justify-center border border-emerald-200/50 transition active:scale-95 shrink-0"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* أزرار الإجراءات الثلاثة تحت مربعي التسعير مباشرة */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    applyPricingPanel();
                  }}
                  className="rounded-2xl bg-emerald-600 py-2.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  حفظ ⬅️
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const bNum = parseFloat(normalizeNumerals(buyText)) || 0;
                    const sNum = parseFloat(normalizeNumerals(sellText)) || 0;
                    if (bNum > 0 && sNum > 0) {
                      const next = [...products];
                      next[editingIndex] = {
                        ...next[editingIndex],
                        buyAlf: bNum.toString(),
                        sellAlf: sNum.toString(),
                        isFulfilledByAdmin: isAdminFulfilled,
                        assignedPreparerId: isAdminFulfilled ? null : next[editingIndex].assignedPreparerId,
                        assignedPreparerName: isAdminFulfilled ? "تجهيز الإدارة 🏛️" : next[editingIndex].assignedPreparerName,
                        pricedBy: "الإدارة"
                      };
                      setProducts(next);
                    }
                    cancelPricingPanel();
                  }}
                  className="rounded-2xl bg-sky-600 py-2.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  حفظ ✅
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetProductPricing(editingIndex);
                    cancelPricingPanel();
                  }}
                  className="rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30 py-2.5 text-xs sm:text-sm font-black active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  مسح 💵
                </button>
              </div>

              {pricingErr && <p className="mt-2 text-center text-xs font-bold text-rose-600">{pricingErr}</p>}

              {/* خيارات البيع المقترحة بالأسفل */}
              {(() => {
                const details = findStoreProductDetails(products[editingIndex]?.line, storeProducts);
                const buyNum = parseFloat(normalizeNumerals(buyText)) || 0;
                
                if (buyNum <= 0 && !details) return null;
                
                return (
                  <div className="mt-4 border-t border-slate-100 dark:border-white/5 pt-3">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 mb-2 block">خيارات سريعة للبيع:</label>
                    <div className="flex flex-wrap gap-1.5 justify-start">
                      {/* زر سعر المتجر (لافندر) */}
                      {details && details.salePrice > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSellText(details.salePrice.toString());
                          }}
                          className="px-3 py-1.5 rounded-xl bg-violet-100 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-300 text-violet-700 font-mono text-xs font-black border border-violet-200 dark:border-violet-900 transition active:scale-95 shadow-sm"
                          title="سعر البيع الأصلي في المتجر (تعديل سعر البيع فقط)"
                        >
                          {details.salePrice}
                        </button>
                      )}

                      {/* زر بدون ربح */}
                      {buyNum > 0 && (
                        <button
                          type="button"
                          onClick={() => applyPriceDirectly(buyNum)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs font-black border border-slate-200 dark:border-slate-700 transition active:scale-95"
                        >
                          بدون ربح: {buyNum}
                        </button>
                      )}

                      {/* بقية الأرقام المقترحة */}
                      {buyNum > 0 && suggestedPrices.map((price) => (
                        <button
                          key={price}
                          type="button"
                          onClick={() => applyPriceDirectly(price)}
                          className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-mono text-xs font-black border border-sky-100 dark:border-sky-900/30 transition active:scale-95"
                        >
                          {price}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* مودال نسخ وتكرار الطلب الفخم الطويل بحجم الشاشة */}
      {showDuplicateModal && isMounted && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
          <div className="w-full max-w-md h-[80vh] sm:h-[70vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 flex flex-col justify-between overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            
            {/* الهيدر */}
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <span className="text-xl">👯</span>
              <div>
                <h3 className="text-sm font-black text-slate-950 dark:text-white">نسخ وتكرار الطلب</h3>
                <p className="text-[10px] font-bold text-slate-500">سيتم إنشاء نسخة مطابقة بنفس المواد والمجهزين المسندين</p>
              </div>
            </div>

            {/* محتوى الاستمارة مع التمرير الداخلي لمنع التداخل */}
            <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-0.5 scrollbar-thin">
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 block">رقم الهاتف للطلب الجديد:</label>
                <input
                  type="text"
                  value={duplicatePhone}
                  onChange={(e) => setDuplicatePhone(e.target.value)}
                  placeholder="أدخل رقم الهاتف"
                  className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 py-3 px-4 font-mono text-base font-black outline-none focus:border-sky-500 text-center text-slate-900 dark:text-white"
                  dir="ltr"
                />
              </div>

              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 mb-1.5 block">المنطقة للطلب الجديد (اكتب للبحث):</label>
                <div className="relative">
                  <input
                    type="text"
                    value={regionSearch}
                    onChange={(e) => {
                      setRegionSearch(e.target.value);
                      setShowRegionSuggestions(true);
                      const exact = regions.find(r => r.name.trim() === e.target.value.trim());
                      if (exact) {
                        setDuplicateRegionId(exact.id);
                      }
                    }}
                    onFocus={() => setShowRegionSuggestions(true)}
                    placeholder="اكتب اسم المنطقة للبحث..."
                    className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 py-3 px-4 text-xs font-black outline-none focus:border-sky-500 text-center text-slate-900 dark:text-white"
                  />
                  {showRegionSuggestions && (
                    <>
                      <div className="fixed inset-0 z-[1010]" onClick={() => setShowRegionSuggestions(false)} />
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl z-[1020] p-1.5 space-y-0.5 scrollbar-thin">
                        {regions.filter(r => r.name.toLowerCase().includes(regionSearch.toLowerCase())).length > 0 ? (
                          regions
                            .filter(r => r.name.toLowerCase().includes(regionSearch.toLowerCase()))
                            .map(r => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  setDuplicateRegionId(r.id);
                                  setRegionSearch(r.name);
                                  setShowRegionSuggestions(false);
                                }}
                                className="w-full text-right px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                              >
                                {r.name}
                              </button>
                            ))
                        ) : (
                          <div className="text-center p-3 text-[10px] text-slate-400 font-bold">لا توجد مناطق تطابق بحثك</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {duplicateError && (
                <p className="text-xs font-bold text-rose-600 text-center bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-xl">
                  ⚠️ {duplicateError}
                </p>
              )}
            </div>

            {/* الأزرار في الأسفل دائماً */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                type="button"
                disabled={isDuplicating}
                onClick={handleDuplicateOrder}
                className="rounded-2xl bg-violet-650 hover:bg-violet-750 disabled:opacity-80 py-3 text-xs font-black text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                {isDuplicating ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري النسخ...
                  </>
                ) : (
                  <>👯 إتمام النسخ والتكرار</>
                )}
              </button>
              <button
                type="button"
                disabled={isDuplicating}
                onClick={() => setShowDuplicateModal(false)}
                className="rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-650 dark:text-slate-300 py-3 text-xs font-black transition active:scale-95"
              >
                تراجع
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}


      {showOptionsMenu && (
        <>
          <div className="fixed inset-0 z-[1900]" onClick={() => setShowOptionsMenu(false)} />
          <div className="fixed left-3 top-[4.5rem] w-80 bg-slate-900/98 dark:bg-slate-950/98 backdrop-blur-2xl border border-slate-800 rounded-3xl p-4 shadow-2xl z-[2000] text-right space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200" dir="rtl">
            
            {/* 1. حقل البحث مدمج هنا وجانبه زر تجهيز الإدارة */}
            <div className="flex items-center gap-2 mb-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ابحث عن مادة..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-2 pr-8 pl-3 text-xs font-bold text-white outline-none focus:border-indigo-400 transition-all shadow-inner"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 bg-slate-700 text-slate-300 rounded-full text-[8px] flex items-center justify-center"
                  >✕</button>
                )}
              </div>
              {preAdminProducts ? (
                <button
                  type="button"
                  onClick={() => { revertAdminFullfillment(); setShowOptionsMenu(false); }}
                  className="h-8.5 px-3 rounded-xl text-[10px] font-black bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-95 flex items-center justify-center gap-1 shrink-0 shadow-sm"
                  title="تراجع عن تجهيز الإدارة"
                >
                  🏛️ تراجع
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { markAllAsAdminFulfilled(); setShowOptionsMenu(false); }}
                  className="h-8.5 px-3 rounded-xl text-[10px] font-black bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-95 flex items-center justify-center gap-1 shrink-0 shadow-sm"
                  title="تجهيز الكل من الإدارة"
                >
                  🏛️ تجهيز إدارة
                </button>
              )}
            </div>

            {/* 2. أزرار الحفظ والإرسال */}
            <div className="border-b border-slate-800/50 pb-2.5 flex flex-col gap-1">
              {isDraft ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const formInput = document.getElementById("submit-type-input") as HTMLInputElement;
                      if (formInput) formInput.value = "admin_approve";
                      setShowOptionsMenu(false);
                      const form = document.getElementById("order-pricing-form") as HTMLFormElement;
                      if (form) form.requestSubmit();
                    }}
                    className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-[10px] font-black text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1"
                  >
                    {pending ? "..." : <><DynamicIcon icon={icons?.ui_success} fallback="💾" width={11} height={11} /> حفظ كمسودة</>}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const formInput = document.getElementById("submit-type-input") as HTMLInputElement;
                      if (formInput) formInput.value = "final_send";
                      setShowOptionsMenu(false);
                      const form = document.getElementById("order-pricing-form") as HTMLFormElement;
                      if (form) form.requestSubmit();
                    }}
                    className="h-9 rounded-xl bg-violet-600 hover:bg-violet-550 text-[10px] font-black text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1"
                  >
                    {pending ? "..." : <><DynamicIcon icon={icons?.ui_rocket} fallback="🚀" width={11} height={11} /> إرسال نهائي</>}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const formInput = document.getElementById("submit-type-input") as HTMLInputElement;
                    if (formInput) formInput.value = "";
                    setShowOptionsMenu(false);
                    const form = document.getElementById("order-pricing-form") as HTMLFormElement;
                    if (form) form.requestSubmit();
                  }}
                  className="w-full h-9 rounded-xl bg-sky-600 hover:bg-sky-500 text-[10px] font-black text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  {pending ? "..." : <><DynamicIcon icon={icons?.ui_success} fallback="✅" width={12} height={12} /> حفظ وإرسال</>}
                </button>
              )}
            </div>

            {/* 3. أوامر التجهيز والإسناد */}
            <div className="border-b border-slate-800/50 pb-2.5 flex flex-col gap-1">
              <div className="grid grid-cols-2 gap-2">
                {isDraft && couriers ? (
                  <button
                    type="button"
                    onClick={() => { setShowAutoCourier(!showAutoCourier); setShowOptionsMenu(false); }}
                    className={`h-8.5 rounded-xl text-[10px] active:scale-95 transition-all flex items-center justify-center gap-1 ${
                      showAutoCourier
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm"
                        : "bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 font-bold shadow-sm"
                    }`}
                  >
                    👤 إسناد تلقائي
                  </button>
                ) : (
                  <div className="h-8.5 rounded-xl bg-slate-800/40 text-[9px] font-bold text-slate-500 flex items-center justify-center">إسناد تلقائي مقفل</div>
                )}
                <button
                  type="button"
                  onClick={() => { setShowReassign(!showReassign); setShowOptionsMenu(false); }}
                  className={`h-8.5 rounded-xl text-[10px] active:scale-95 transition-all flex items-center justify-center gap-1 ${
                    showReassign
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm"
                      : "bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 font-bold shadow-sm"
                  }`}
                >
                  👤 إسناد للمجهزين
                </button>
              </div>
            </div>

            {/* 4. أوضاع التحكم السريعة */}
            <div className="border-b border-slate-800/50 pb-2.5 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                   type="button"
                   onClick={() => {
                     setShowBulkAdd(!showBulkAdd);
                     setDeleteMode(false);
                     setSelectionMode(false);
                     setShowOptionsMenu(false);
                   }}
                   className={`h-8.5 rounded-xl text-[10px] active:scale-95 transition-all flex items-center justify-center gap-1 ${
                     showBulkAdd
                       ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm"
                       : "bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 font-bold shadow-sm"
                   }`}
                >
                   ➕ إضافة منتج
                </button>
                <button
                   type="button"
                   onClick={() => {
                     setDeleteMode(!deleteMode);
                     setShowBulkAdd(false);
                     setSelectionMode(false);
                     setShowOptionsMenu(false);
                   }}
                   className={`h-8.5 rounded-xl text-[10px] active:scale-95 transition-all flex items-center justify-center gap-1 ${
                     deleteMode
                       ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm animate-pulse"
                       : "bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 font-bold shadow-sm"
                   }`}
                >
                   🗑️ حذف منتج
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                   type="button"
                   disabled={isSorting}
                   onClick={() => { handleAiSort(); setShowOptionsMenu(false); }}
                   className="h-8.5 rounded-xl text-[10px] font-black bg-indigo-650 hover:bg-indigo-600 text-white active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-sm"
                >
                   ترتيب 🪄
                </button>
                <button
                  type="button"
                  onClick={() => { handleToggleNoProfit(!noProfit); setShowOptionsMenu(false); }}
                  className={`h-8.5 rounded-xl text-[10px] active:scale-95 transition-all flex items-center justify-center gap-1 ${
                    noProfit
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm"
                      : "bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 font-bold shadow-sm"
                  }`}
                >
                  🚫 إيقاف الربح
                </button>
              </div>
            </div>

            {/* 5. أدوات ونسخ الطلب وخيارات إخفاء الأسعار */}
            <div className="border-b border-slate-800/50 pb-2.5 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyTemplate}
                  className={`h-8.5 rounded-xl text-[10px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1 ${
                    templateSuccess
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-sm"
                      : "bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 shadow-sm"
                  }`}
                >
                  {templateSuccess ? "📋 تم النسخ!" : "📝 كليشة الطلب"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDuplicateModal(true); setShowOptionsMenu(false); }}
                  className="h-8.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm"
                >
                  👯 نسخ وتكرار
                </button>
              </div>

              {/* زر إخفاء سعر الشراء بجانب زر إخفاء سعر البيع */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setHideBuyPrice(!hideBuyPrice); setShowOptionsMenu(false); }}
                  className={`h-8.5 rounded-xl text-[9px] active:scale-95 transition-all flex items-center justify-center gap-1 shadow-sm ${
                    hideBuyPrice
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black"
                      : "bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 font-bold"
                  }`}
                >
                  {hideBuyPrice ? "👁️ إظهار الشراء" : "🙈 إخفاء الشراء"}
                </button>
                <button
                  type="button"
                  onClick={() => { setHideSellPrice(!hideSellPrice); setShowOptionsMenu(false); }}
                  className={`h-8.5 rounded-xl text-[9px] active:scale-95 transition-all flex items-center justify-center gap-1 shadow-sm ${
                    hideSellPrice
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black"
                      : "bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 font-bold"
                  }`}
                >
                  {hideSellPrice ? "👁️ إظهار البيع" : "🙈 إخفاء البيع"}
                </button>
              </div>
            </div>

            {/* 6. سعر المتجر وعدد المحلات بجانب بعضهما في سطر واحد بدون نصوص توضيحية */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/50">
              <button
                type="button"
                onClick={() => { setHideBuyPrice(!hideBuyPrice); }}
                className={`h-8.5 px-4 rounded-xl text-[10px] active:scale-95 transition-all flex items-center justify-center gap-1 shadow-sm ${
                  hideBuyPrice
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black"
                    : "bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 font-bold"
                }`}
              >
                {hideBuyPrice ? "🙈 سعر المتجر" : "👁️ سعر المتجر"}
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPlacesCount(Math.max(1, placesCount - 1))}
                  className="h-7.5 w-7.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-xs flex items-center justify-center active:scale-95 border border-slate-700"
                >
                  -
                </button>
                <span className="px-3 font-mono font-black text-xs text-amber-400">{placesCount}</span>
                <button
                  type="button"
                  onClick={() => setPlacesCount(Math.min(10, placesCount + 1))}
                  className="h-7.5 w-7.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-xs flex items-center justify-center active:scale-95 border border-slate-700"
                >
                  +
                </button>
              </div>
            </div>

          </div>
        </>
      )}

      {previewImageUrl && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80" onClick={() => setPreviewImageUrl(null)}>
           <img src={previewImageUrl} className="max-h-screen max-w-full object-contain" style={{ transform: `scale(${previewZoom})` }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

/** حقول إضافية للمندوب التلقائي */
export function SetDraftAutoCourierPanel({
  draftId,
  couriers,
  currentCourierId,
  currentCourierName,
  onSuccess,
  icons,
}: {
  draftId: string;
  couriers: { id: string; name: string }[];
  currentCourierId?: string | null;
  currentCourierName?: string | null;
  onSuccess?: () => void;
  icons?: GlobalIconsConfig | null;
}) {
  const bound = setDraftAutoCourier.bind(null);
  const [state, formAction, pending] = useActionState(bound, { ok: false });
  const [selectedCourierId, setSelectedCourierId] = useState(currentCourierId || "");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { if (state.ok) onSuccess?.(); }, [state.ok, onSuccess]);

  return (
    <form ref={formRef} action={formAction} className="p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2rem] border border-indigo-200/50 space-y-3" dir="rtl">
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="courierId" value={selectedCourierId} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-indigo-950 dark:text-indigo-100 flex items-center gap-2">
          <DynamicIcon icon={icons?.ui_package} fallback="📦" width={14} height={14} /> التحويل التلقائي
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setSelectedCourierId(""); setTimeout(() => formRef.current?.requestSubmit(), 0); }} className={`px-4 py-2 rounded-xl text-[10px] font-black ${selectedCourierId === "" ? "bg-indigo-600 text-white" : "bg-white text-indigo-800 border"}`}>بدون تحويل</button>
        {couriers.map(c => (
          <button key={c.id} type="button" onClick={() => { setSelectedCourierId(c.id); setTimeout(() => formRef.current?.requestSubmit(), 0); }} className={`px-4 py-2 rounded-xl text-[10px] font-black ${selectedCourierId === c.id ? "bg-indigo-600 text-white" : "bg-white text-indigo-800 border"}`}>{c.name}</button>
        ))}
      </div>
    </form>
  );
}

/** زر رفض الطلب */
function RejectButton({ orderId, icons }: { orderId: string, icons?: GlobalIconsConfig | null }) {
  const bound = rejectPendingOrder.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as RejectOrderState);
  return (
    <form action={formAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-rose-100 bg-white dark:bg-slate-900 text-rose-600 hover:bg-rose-600 hover:text-white transition-all duration-200 disabled:opacity-40 shadow-sm"
      >
        <DynamicIcon icon={icons?.ui_close || icons?.ui_trash} fallback="✖" width={14} height={14} />
        <span className="text-[10px] font-black">{pending ? "جاري الرفض..." : "رفض الطلب"}</span>
      </button>
    </form>
  );
}

/** زر حذف الطلب نهائياً (رفض الطلب) */
function DeleteFullOrderButton({ id, isDraft, onSuccess, icons }: { id: string, isDraft: boolean, onSuccess?: () => void, icons?: GlobalIconsConfig | null }) {
  const bound = deleteOrderPermanently.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as any);

  useEffect(() => { if (state.ok && onSuccess) onSuccess(); }, [state.ok, onSuccess]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("هل أنت متأكد من رفض الطلب؟")) {
          e.preventDefault();
        }
      }}
      className="inline-block"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="isDraft" value={String(isDraft)} />
      <button
        type="submit"
        disabled={pending}
        title="رفض الطلب"
        className="flex items-center justify-center h-10 w-10 rounded-xl border-2 border-rose-600 bg-white dark:bg-slate-900 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95 shrink-0"
      >
        <DynamicIcon icon={icons?.ui_trash} fallback="🗑️" width={16} height={16} />
      </button>
    </form>
  );
}

/** زر إرجاع الطلب المكتمل التجهيز إلى قيد التجهيز */
function RevertPreparedOrderButton({ id, onSuccess }: { id: string; onSuccess?: () => void }) {
  const bound = revertPreparedOrderToPreparing.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as any);

  useEffect(() => {
    if (state.ok) {
      if (onSuccess) onSuccess();
      else window.location.reload();
    } else if (state.error) {
      alert(state.error);
    }
  }, [state.ok, state.error, onSuccess]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("هل أنت متأكد من إرجاع هذا الطلب إلى قيد التجهيز؟")) {
          e.preventDefault();
        }
      }}
      className="inline-block"
    >
      <input type="hidden" name="orderId" value={id} />
      <button
        type="submit"
        disabled={pending}
        title="إرجاع الطلب إلى قيد التجهيز"
        className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-900/30 dark:bg-amber-950/10 text-amber-700 dark:text-amber-400 text-xs font-black shadow-sm active:scale-95 transition-all shrink-0 cursor-pointer"
      >
        <span>🔄 إرجاع للتجهيز</span>
      </button>
    </form>
  );
}

/** مشغل ملاحظة صوتية مصغر دائري */
function MiniVoicePlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch((e) => console.error("Error playing audio:", e));
      setPlaying(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`h-9 w-9 rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 ${
        playing
          ? "bg-rose-500 text-white animate-pulse"
          : "bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-200/50"
      }`}
      title={playing ? "إيقاف الملاحظة الصوتية" : "تشغيل الملاحظة الصوتية"}
    >
      <span className="text-xs">{playing ? "⏸" : "🎤"}</span>
    </button>
  );
}

/** لوحة إسناد الطلب للمندوب */
export function PendingAssignPanel({
  orderId,
  couriers,
  routeMode = "single",
  customerPhone,
  customerAlternatePhone,
  customerLandmark = "",
  defaultCustomerLocationUrl,
  secondCustomerLandmark = "",
  defaultSecondCustomerLocationUrl = "",
  customerDoorPhotoUrl = "",
  secondCustomerDoorPhotoUrl = "",
  icons,
  isDraft = false,
  onSuccess,
}: {
  orderId: string;
  couriers: { id: string; name: string }[];
  routeMode?: "single" | "double";
  customerPhone: string;
  customerAlternatePhone: string;
  customerLandmark?: string;
  defaultCustomerLocationUrl: string;
  secondCustomerLandmark?: string;
  defaultSecondCustomerLocationUrl?: string;
  customerDoorPhotoUrl?: string;
  secondCustomerDoorPhotoUrl?: string;
  icons?: GlobalIconsConfig | null;
  isDraft?: boolean;
  onSuccess?: () => void;
}) {
  const bound = assignPendingOrderToCourier.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as AssignOrderState);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [prepareByAdmin, setPrepareByAdmin] = useState(true);

  const [doorPhotoPreview, setDoorPhotoPreview] = useState<string | null>(customerDoorPhotoUrl ? resolvePublicAssetSrc(customerDoorPhotoUrl) : null);
  const [secondDoorPhotoPreview, setSecondDoorPhotoPreview] = useState<string | null>(secondCustomerDoorPhotoUrl ? resolvePublicAssetSrc(secondCustomerDoorPhotoUrl) : null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const secondCameraInputRef = useRef<HTMLInputElement>(null);
  const secondGalleryInputRef = useRef<HTMLInputElement>(null);

  const handleDoorPhotoChange = (e: React.ChangeEvent<HTMLInputElement>, isCamera: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      setDoorPhotoPreview(URL.createObjectURL(file));
      if (isCamera) {
        if (galleryInputRef.current) galleryInputRef.current.value = "";
      } else {
        if (cameraInputRef.current) cameraInputRef.current.value = "";
      }
    }
  };

  const handleSecondDoorPhotoChange = (e: React.ChangeEvent<HTMLInputElement>, isCamera: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      setSecondDoorPhotoPreview(URL.createObjectURL(file));
      if (isCamera) {
        if (secondGalleryInputRef.current) secondGalleryInputRef.current.value = "";
      } else {
        if (secondCameraInputRef.current) secondCameraInputRef.current.value = "";
      }
    }
  };

  if (couriers.length === 0) return <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs font-bold text-center flex items-center justify-center gap-2"><DynamicIcon icon={icons?.ui_warning} fallback="⚠️" width={14} height={14} /> لا يوجد مناديب متاحين حالياً.</div>;

  const isDouble = routeMode === "double";

  return (
    <form action={formAction} className="p-5 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-emerald-400 dark:border-emerald-500 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto" dir="rtl">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="isDraft" value={isDraft ? "true" : "false"} />

      <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/30 pb-3">
        <p className="text-sm font-black text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
          <DynamicIcon icon={icons?.ui_package} fallback="📦" width={18} height={18} /> إسناد للمندوب
        </p>
        <div className="flex flex-col items-end">
           <span className="text-[10px] font-black text-slate-400">هاتف المرسل</span>
           <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-400">{customerPhone}</span>
        </div>
      </div>

      {isDraft && (
        <div className="p-4 rounded-3xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-col text-right">
            <span className="text-xs font-black text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5 font-sans">
              🏛️ تجهيز كل شيء من قبل الإدارة
            </span>
            <span className="text-[9px] font-bold text-indigo-700/70 dark:text-indigo-400/70 leading-relaxed font-sans">
              سيتم تحويل هذا الطلب وتجهيز كافة منتجاته فوراً من قبل الإدارة
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              name="prepareByAdmin"
              checked={prepareByAdmin}
              onChange={(e) => setPrepareByAdmin(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-slate-200 dark:bg-slate-800 peer-checked:bg-indigo-600 transition-colors" />
            <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-all peer-checked:left-6" />
          </label>
        </div>
      )}

      <div className="space-y-4">
        {/* اختر المندوب */}
        <div className="space-y-1.5 bg-emerald-50/20 dark:bg-emerald-950/10 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
           <label className="text-[10px] font-black text-emerald-900 dark:text-emerald-300 pr-1 block mb-1">اختر المندوب لتوصيل هذا الطلب *</label>
           <OrderStatusRadioGroup
             name="courierId"
             defaultValue=""
             required
             options={couriers.map((c) => ({ value: c.id, label: c.name }))}
           />
        </div>
        {isDouble ? (
          <div className="space-y-3">
            {/* الوجهة الأولى */}
            <div className="p-3.5 bg-emerald-50/10 dark:bg-emerald-950/5 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 space-y-3">
              <h4 className="text-[10px] font-black text-emerald-700 border-b pb-1">الوجهة الأولى (البائع / المرسل)</h4>
              
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 block pr-1">رابط لوكيشن قوقل ماب</label>
                <textarea
                  name="customerLocationUrl"
                  defaultValue={defaultCustomerLocationUrl}
                  placeholder="الصق رابط لوكيشن البائع هنا..."
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 p-2 text-[10px] font-mono outline-none focus:ring-1 focus:ring-emerald-400 transition-all resize-none text-right [direction:ltr]"
                />
              </div>

              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 block pr-1">أقرب نقطة دالة</label>
                  <input
                    type="text"
                    name="customerLandmark"
                    defaultValue={customerLandmark}
                    placeholder="قرب المسجد، المحل الرئيسي..."
                    className="w-full h-8 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 px-2.5 text-[9px] font-black outline-none focus:border-emerald-400 transition-all text-right"
                  />
                </div>
                
                <div className="space-y-1 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                  <label className="text-[8px] font-black text-slate-400 block pr-1 mb-1">صورة باب البائع</label>
                  <input type="hidden" name="customerDoorPhotoUrl" value={customerDoorPhotoUrl} />
                  <div className="flex items-center gap-3">
                    {doorPhotoPreview ? (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-emerald-400 shadow-sm shrink-0">
                        <img
                          src={doorPhotoPreview}
                          alt="باب البائع"
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => window.open(doorPhotoPreview, "_blank")}
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-slate-900/30 text-[10px] text-slate-400 shrink-0">
                        🚪
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center gap-1 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-emerald-700 dark:text-emerald-400 px-2 py-1.5 rounded-lg text-[8px] font-black border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95"
                      >
                        📷 الكاميرا
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="flex items-center gap-1 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 px-2 py-1.5 rounded-lg text-[8px] font-black border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95"
                      >
                        🖼️ المعرض
                      </button>
                      <input
                        type="file"
                        name="doorPhoto"
                        accept="image/*"
                        capture="environment"
                        ref={cameraInputRef}
                        onChange={(e) => handleDoorPhotoChange(e, true)}
                        className="sr-only"
                      />
                      <input
                        type="file"
                        name="doorPhoto"
                        accept="image/*"
                        ref={galleryInputRef}
                        onChange={(e) => handleDoorPhotoChange(e, false)}
                        className="sr-only"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* الوجهة الثانية */}
            <div className="p-3.5 bg-rose-50/10 dark:bg-rose-950/5 rounded-2xl border border-rose-100 dark:border-rose-900/20 space-y-3">
              <h4 className="text-[10px] font-black text-rose-700 border-b pb-1">الوجهة الثانية (المشتري / المستلم)</h4>
              
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-[8px] font-black text-slate-400 block pr-1">رابط لوكيشن قوقل ماب</label>
                  <textarea
                    name="secondCustomerLocationUrl"
                    defaultValue={defaultSecondCustomerLocationUrl}
                    placeholder="الصق رابط لوكيشن المشتري هنا..."
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 p-2 text-[10px] font-mono outline-none focus:ring-1 focus:ring-emerald-400 transition-all resize-none text-right [direction:ltr]"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={pending}
                  title="تأكيد الإسناد والإرسال للمندوب"
                  className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-1 shadow-md transition-all active:scale-95 disabled:opacity-40 shrink-0 font-black text-[10px]"
                >
                  {pending ? "..." : <><DynamicIcon icon={icons?.ui_success} fallback="✅" width={10} height={10} /> إسناد</>}
                </button>
              </div>

              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 block pr-1">أقرب نقطة دالة</label>
                  <input
                    type="text"
                    name="secondCustomerLandmark"
                    defaultValue={secondCustomerLandmark}
                    placeholder="مثال: قرب المدرسة"
                    className="w-full h-8 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 px-2.5 text-[9px] font-black outline-none focus:border-emerald-400 transition-all text-right"
                  />
                </div>
                
                <div className="space-y-1 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                  <label className="text-[8px] font-black text-slate-400 block pr-1 mb-1">صورة باب المشتري</label>
                  <input type="hidden" name="secondCustomerDoorPhotoUrl" value={secondCustomerDoorPhotoUrl} />
                  <div className="flex items-center gap-3">
                    {secondDoorPhotoPreview ? (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-emerald-400 shadow-sm shrink-0">
                        <img
                          src={secondDoorPhotoPreview}
                          alt="باب المشتري"
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => window.open(secondDoorPhotoPreview, "_blank")}
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-slate-900/30 text-[10px] text-slate-400 shrink-0">
                        🚪
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => secondCameraInputRef.current?.click()}
                        className="flex items-center gap-1 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-emerald-700 dark:text-emerald-400 px-2 py-1.5 rounded-lg text-[8px] font-black border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95"
                      >
                        📷 الكاميرا
                      </button>
                      <button
                        type="button"
                        onClick={() => secondGalleryInputRef.current?.click()}
                        className="flex items-center gap-1 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 px-2 py-1.5 rounded-lg text-[8px] font-black border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95"
                      >
                        🖼️ المعرض
                      </button>
                      <input
                        type="file"
                        name="secondDoorPhoto"
                        accept="image/*"
                        capture="environment"
                        ref={secondCameraInputRef}
                        onChange={(e) => handleSecondDoorPhotoChange(e, true)}
                        className="sr-only"
                      />
                      <input
                        type="file"
                        name="secondDoorPhoto"
                        accept="image/*"
                        ref={secondGalleryInputRef}
                        onChange={(e) => handleSecondDoorPhotoChange(e, false)}
                        className="sr-only"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 pr-1">رابط الموقع (Google Maps)</label>
                <textarea
                  name="customerLocationUrl"
                  defaultValue={defaultCustomerLocationUrl}
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900 p-2.5 text-[10px] font-bold font-mono outline-none focus:ring-1 focus:ring-emerald-400 transition-all resize-none text-right [direction:ltr]"
                  placeholder="https://maps.google.com/..."
                />
              </div>
              
              <button
                type="submit"
                disabled={pending}
                title="تأكيد الإسناد والإرسال للمندوب"
                className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-100 dark:shadow-none transition-all active:scale-95 disabled:opacity-40 shrink-0 font-black text-xs"
              >
                {pending ? "..." : <><DynamicIcon icon={icons?.ui_success} fallback="✅" width={14} height={14} /> إسناد</>}
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 pr-1">أقرب نقطة دالة</label>
                <input
                  type="text"
                  name="customerLandmark"
                  defaultValue={customerLandmark}
                  placeholder="مثال: قرب المسجد"
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900 p-2 text-[10px] font-bold outline-none focus:border-emerald-400 text-right"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 pr-1">هاتف بديل للزبون</label>
                <input
                  type="text"
                  name="customerAlternatePhone"
                  defaultValue={customerAlternatePhone}
                  placeholder="رقم هاتف بديل (إن وجد)"
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900 p-2 text-[10px] font-bold outline-none focus:border-emerald-400 text-right"
                />
              </div>
            </div>

            {/* عرض وتغيير صورة الباب */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 pr-1 block">صورة باب الزبون</span>
              <input type="hidden" name="customerDoorPhotoUrl" value={customerDoorPhotoUrl} />
              
              <div className="flex flex-col items-center justify-center gap-3">
                {doorPhotoPreview ? (
                  <div className="relative w-full max-w-[200px] h-32 rounded-xl overflow-hidden border-2 border-emerald-400 shadow-md group">
                    <img
                      src={doorPhotoPreview}
                      alt="صورة باب الزبون"
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                      onClick={() => window.open(doorPhotoPreview, "_blank")}
                    />
                  </div>
                ) : (
                  <div className="w-full max-w-[200px] h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center bg-white dark:bg-slate-900/30 text-slate-400 dark:text-slate-600 gap-1.5 p-3">
                    <span className="text-[18px]">🚪</span>
                    <span className="text-[9px] font-bold text-center">لا توجد صورة لباب الزبون حالياً</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-xl text-[10px] font-black border border-emerald-200 dark:border-emerald-900/30 shadow-sm active:scale-95 transition-all"
                  >
                    📷 فتح الكاميرا
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-[10px] font-black border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all"
                  >
                    🖼️ المعرض
                  </button>
                  <input
                    type="file"
                    name="doorPhoto"
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRef}
                    onChange={(e) => handleDoorPhotoChange(e, true)}
                    className="sr-only"
                  />
                  <input
                    type="file"
                    name="doorPhoto"
                    accept="image/*"
                    ref={galleryInputRef}
                    onChange={(e) => handleDoorPhotoChange(e, false)}
                    className="sr-only"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline mt-1"
        >
           {showAdvanced ? "إخفاء الخيارات المتقدمة" : "إظهار خيارات إضافية (تجاوز الإسناد...)"}
        </button>

        {showAdvanced && (
          <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-200 border-t border-slate-100 dark:border-slate-800">
             <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                   <input type="checkbox" name="directReceipt" className="peer sr-only" />
                   <div className="h-5 w-9 rounded-full bg-slate-200 dark:bg-slate-800 peer-checked:bg-emerald-500 transition-colors" />
                   <div className="absolute left-1 top-1 h-3 w-3 rounded-full bg-white transition-all peer-checked:left-5" />
                </div>
                <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 group-hover:text-emerald-600 transition-colors">تم الاستلام من المحل مباشرة (تجاوز الإسناد)</span>
             </label>
          </div>
        )}
      </div>

      {state.error && <p className="p-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-bold border border-rose-200">{state.error}</p>}
    </form>
  );
}

/** نموذج حفظ اللوكيشن السريع مباشرة من بطاقة الطلب */
function QuickLocationSaveForm({
  orderId,
  routeMode,
  defaultCustomerLocationUrl,
  defaultSecondCustomerLocationUrl = "",
  defaultCustomerLandmark = "",
  defaultSecondCustomerLandmark = "",
  defaultCustomerDoorPhotoUrl = "",
  defaultSecondCustomerDoorPhotoUrl = "",
  icons,
}: {
  orderId: string;
  routeMode: "single" | "double";
  defaultCustomerLocationUrl: string;
  defaultSecondCustomerLocationUrl?: string;
  defaultCustomerLandmark?: string;
  defaultSecondCustomerLandmark?: string;
  defaultCustomerDoorPhotoUrl?: string;
  defaultSecondCustomerDoorPhotoUrl?: string;
  icons?: GlobalIconsConfig | null;
}) {
  const bound = saveOrderLocationOnly.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as { ok?: boolean; error?: string });

  const [customerLocationUrl, setCustomerLocationUrl] = useState(defaultCustomerLocationUrl || "");
  const [secondCustomerLocationUrl, setSecondCustomerLocationUrl] = useState(defaultSecondCustomerLocationUrl || "");
  const [customerLandmark, setCustomerLandmark] = useState(defaultCustomerLandmark || "");
  const [secondCustomerLandmark, setSecondCustomerLandmark] = useState(defaultSecondCustomerLandmark || "");
  const [customerDoorPhotoUrl, setCustomerDoorPhotoUrl] = useState(defaultCustomerDoorPhotoUrl || "");
  const [secondCustomerDoorPhotoUrl, setSecondCustomerDoorPhotoUrl] = useState(defaultSecondCustomerDoorPhotoUrl || "");

  useEffect(() => {
    setCustomerLocationUrl(defaultCustomerLocationUrl || "");
    setSecondCustomerLocationUrl(defaultSecondCustomerLocationUrl || "");
    setCustomerLandmark(defaultCustomerLandmark || "");
    setSecondCustomerLandmark(defaultSecondCustomerLandmark || "");
    setCustomerDoorPhotoUrl(defaultCustomerDoorPhotoUrl || "");
    setSecondCustomerDoorPhotoUrl(defaultSecondCustomerDoorPhotoUrl || "");
  }, [
    defaultCustomerLocationUrl,
    defaultSecondCustomerLocationUrl,
    defaultCustomerLandmark,
    defaultSecondCustomerLandmark,
    defaultCustomerDoorPhotoUrl,
    defaultSecondCustomerDoorPhotoUrl,
  ]);

  const isDouble = routeMode === "double";

  const renderSection = (
    title: string,
    prefix: string,
    locVal: string,
    setLoc: (v: string) => void,
    landVal: string,
    setLand: (v: string) => void,
    doorVal: string,
    setDoor: (v: string) => void,
    bgClass: string,
    borderClass: string,
    textClass: string
  ) => (
    <div className={`p-3 rounded-2xl border ${bgClass} ${borderClass} space-y-2.5 text-right`}>
      <h4 className={`text-[10px] font-black ${textClass} border-b pb-1 mb-1.5`}>{title}</h4>
      <div className="space-y-1">
        <label className="text-[8px] font-black text-slate-400 block pr-1">رابط لوكيشن قوقل ماب</label>
        <input
          type="text"
          name={`${prefix}LocationUrl`}
          value={locVal}
          onChange={(e) => setLoc(e.target.value)}
          placeholder="https://maps.google.com/..."
          className="w-full h-8 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 px-2.5 text-[9px] font-medium outline-none focus:border-emerald-400 font-mono transition-all text-right [direction:ltr]"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[8px] font-black text-slate-400 block pr-1">أقرب نقطة دالة</label>
          <input
            type="text"
            name={`${prefix}Landmark`}
            value={landVal}
            onChange={(e) => setLand(e.target.value)}
            placeholder="مثال: قرب المدرسة"
            className="w-full h-8 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 px-2.5 text-[9px] font-black outline-none focus:border-emerald-400 transition-all text-right"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[8px] font-black text-slate-400 block pr-1">رابط صورة الباب</label>
          <input
            type="text"
            name={`${prefix}DoorPhotoUrl`}
            value={doorVal}
            onChange={(e) => setDoor(e.target.value)}
            placeholder="https://image-link..."
            className="w-full h-8 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 px-2.5 text-[9px] font-medium outline-none focus:border-emerald-400 font-mono transition-all text-right [direction:ltr]"
          />
        </div>
      </div>
    </div>
  );

  return (
    <form action={formAction} className="w-full space-y-3 pt-2">
      <input type="hidden" name="orderId" value={orderId} />
      
      {isDouble ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {renderSection(
            "الوجهة الأولى (البائع / المرسل)",
            "customer",
            customerLocationUrl,
            setCustomerLocationUrl,
            customerLandmark,
            setCustomerLandmark,
            customerDoorPhotoUrl,
            setCustomerDoorPhotoUrl,
            "bg-emerald-50/10",
            "border-emerald-200/40",
            "text-emerald-700"
          )}
          {renderSection(
            "الوجهة الثانية (المشتري / المستلم)",
            "secondCustomer",
            secondCustomerLocationUrl,
            setSecondCustomerLocationUrl,
            secondCustomerLandmark,
            setSecondCustomerLandmark,
            secondCustomerDoorPhotoUrl,
            setSecondCustomerDoorPhotoUrl,
            "bg-rose-50/10",
            "border-rose-200/40",
            "text-rose-700"
          )}
        </div>
      ) : (
        renderSection(
          "الموقع الجغرافي ومعلومات الزبون",
          "customer",
          customerLocationUrl,
          setCustomerLocationUrl,
          customerLandmark,
          setCustomerLandmark,
          customerDoorPhotoUrl,
          setCustomerDoorPhotoUrl,
          "bg-slate-50/20",
          "border-slate-100",
          "text-sky-800"
        )
      )}

      <div className="flex items-center justify-between gap-4 mt-2 relative">
        {state.error ? (
          <span className="text-[9px] font-bold text-rose-600 text-right flex-1">{state.error}</span>
        ) : (
          <span className="text-[8px] font-bold text-slate-400 text-right flex-1">
            * يمكنك نسخ ولصق الروابط وصورة الباب مباشرة هنا.
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-10 px-5 shrink-0 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-black shadow-md shadow-emerald-200/40 dark:shadow-none transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {pending ? "جاري الحفظ..." : <><DynamicIcon icon={icons?.ui_success} fallback="✅" width={12} height={12} /> حفظ التعديلات السريعة</>}
        </button>
      </div>
    </form>
  );
}


/** المكون الرئيسي لإدارة الطلبات المعلقة */
export default function PendingOrdersClient({
  orders,
  couriers,
  shops = [],
  preparers = [],
  isDraftMode,
  icons: initialIcons = null,
  initialAssignOrderId = null,
  initialPricingId = null,
  storeProducts = [],
  fishPricesRaw = "",
}: {
  orders: PendingOrderRow[];
  couriers: { id: string; name: string }[];
  shops?: { id: string; name: string }[];
  preparers?: { id: string; name: string }[];
  isDraftMode?: boolean;
  icons?: GlobalIconsConfig | null;
  initialAssignOrderId?: string | null;
  initialPricingId?: string | null;
  storeProducts?: any[];
  fishPricesRaw?: string;
}) {
  const router = useRouter();
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(initialIcons);
  const [activeAssignOrderId, setActiveAssignOrderId] = useState<string | null>(initialAssignOrderId);
  const [activePricingOrderId, setActivePricingOrderId] = useState<string | null>(initialPricingId);
  const [activeAssignPreparerOrderId, setActiveAssignPreparerOrderId] = useState<string | null>(null);

  const [showFishPricesModal, setShowFishPricesModal] = useState(false);
  const [fishPricesText, setFishPricesText] = useState(fishPricesRaw || "");
  const [isSavingFishPrices, setIsSavingFishPrices] = useState(false);
  const [fishPricesSaveError, setFishPricesSaveError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkCourierId, setBulkCourierId] = useState("");
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [bulkActionError, setBulkActionError] = useState("");

  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [showAutoCourierIds, setShowAutoCourierIds] = useState<Set<string>>(new Set());

  const toggleAutoCourier = (id: string) => {
    const next = new Set(showAutoCourierIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setShowAutoCourierIds(next);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedOrderIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedOrderIds(next);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedOrderId(id);
      setTimeout(() => {
        setCopiedOrderId(null);
      }, 2000);
    }).catch((err) => {
      console.error("Failed to copy: ", err);
    });
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [orders]);

  useEffect(() => {
    if (activeAssignOrderId && !orders.some(o => o.id === activeAssignOrderId)) {
      setActiveAssignOrderId(null);
    }
    if (activeAssignPreparerOrderId && !orders.some(o => o.id === activeAssignPreparerOrderId)) {
      setActiveAssignPreparerOrderId(null);
    }
    if (activePricingOrderId && !orders.some(o => o.id === activePricingOrderId)) {
      setActivePricingOrderId(null);
    }
  }, [orders, activeAssignOrderId, activeAssignPreparerOrderId, activePricingOrderId]);

  const handleBulkDelete = async () => {
    setIsBulkLoading(true);
    setBulkActionError("");
    try {
      const res = await bulkDeleteOrdersPermanently(Array.from(selectedIds), !!isDraftMode);
      if (res.error) {
        setBulkActionError(res.error);
      } else {
        setSelectedIds(new Set());
        setShowBulkDeleteConfirm(false);
        window.location.reload();
      }
    } catch (err: any) {
      setBulkActionError(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkCourierId) return;
    setIsBulkLoading(true);
    setBulkActionError("");
    try {
      const res = await bulkAssignOrdersToCourier(Array.from(selectedIds), bulkCourierId);
      if (res.error) {
        setBulkActionError(res.error);
      } else {
        setSelectedIds(new Set());
        setBulkCourierId("");
        setShowBulkAssignModal(false);
        window.location.reload();
      }
    } catch (err: any) {
      setBulkActionError(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsBulkLoading(false);
    }
  };

  useEffect(() => {
    if (!icons) {
      getGlobalIcons().then(setIcons);
    }
  }, [icons]);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
         <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <DynamicIcon icon={icons?.ui_package} fallback="📦" width={40} height={40} className="text-slate-300" />
         </div>
         <h3 className="text-lg font-black text-slate-900 dark:text-white">لا توجد طلبات معلقة</h3>
         <p className="text-sm font-bold text-slate-500 mt-1">جميع الطلبات تم تجهيزها أو إسنادها بنجاح.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-40 px-3 sm:px-0">
      {/* Selection Control Bar */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-white/50 dark:bg-slate-900/50 rounded-[1.5rem] border border-slate-100 dark:border-white/5 shadow-sm gap-3" dir="rtl">
         <div className="flex items-center gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
               <input
                 type="checkbox"
                 checked={orders.length > 0 && selectedIds.size === orders.length}
                 onChange={(e) => {
                   if (e.target.checked) {
                     setSelectedIds(new Set(orders.map(o => o.id)));
                   } else {
                     setSelectedIds(new Set());
                   }
                 }}
                 className="h-5 w-5 shrink-0 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer transition-all dark:bg-slate-900 dark:border-white/10"
               />
               <span className="text-xs font-black text-slate-700 dark:text-slate-300">تحديد الكل في هذه الصفحة</span>
            </label>
         </div>
         <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFishPricesModal(true)}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-650 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-black shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              🐟 أسعار السمك اليومية
            </button>
            {selectedIds.size > 0 && (
               <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                  تم تحديد {selectedIds.size} طلبات من أصل {orders.length}
               </span>
            )}
         </div>
      </div>

      {orders.map((order) => {
        const hasLocation = order.hasCustomerLocation;

        if (!isDraftMode) {
          return (
            <div
              key={order.id}
              className={`relative overflow-hidden rounded-[2.5rem] border-2 transition-all shadow-xl bg-white dark:bg-slate-950 ${
                !hasLocation
                  ? "border-amber-400 dark:border-amber-500/50 shadow-amber-100/30 dark:shadow-none bg-gradient-to-br from-amber-50/10 via-white to-white dark:from-amber-950/5 dark:to-slate-955"
                  : "border-slate-100 dark:border-slate-800 shadow-slate-200/30"
              }`}
            >
              {/* شريط تنبيه في حال عدم وجود لوكيشن */}
              {!hasLocation && (
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600/80 dark:to-amber-700/80 px-6 py-2.5 text-center flex items-center justify-center gap-2 text-white text-xs font-black shadow-inner">
                  <span>⚠️ لا يوجد موقع جغرافي للزبون - يرجى طلب اللوكيشن منه!</span>
                </div>
              )}

              {/* Header */}
              <div className="p-5 pb-3 sm:pb-5 relative flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 border-b sm:border-b-0 border-slate-105 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-900/10">
                <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                  {/* Bulk selection Checkbox & shrunken order number stacked */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0 bg-slate-100/50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200/50 dark:border-white/5 min-w-[52px] justify-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      className="h-5 w-5 shrink-0 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer transition-all dark:bg-slate-900 dark:border-white/10"
                    />
                    <Link
                      href={`${SECRET_ADMIN_PATH}/orders/${order.id}`}
                      className="text-xs font-black text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:underline tabular-nums"
                      title="فتح تفاصيل الطلب بالكامل"
                    >
                      #{order.orderNumber}
                    </Link>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2.5">
                      <Link
                        href={`${SECRET_ADMIN_PATH}/orders/${order.id}`}
                        className="hover:text-emerald-600 transition-colors"
                        title="فتح تفاصيل الطلب بالكامل"
                      >
                        <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight hover:underline flex items-center gap-1.5">
                          {order.shopName}
                          <span className="text-xs font-bold text-slate-400">↗</span>
                        </h3>
                      </Link>
                      {order.submissionLabel === "مكتمل التجهيز" && (
                        <RevertPreparedOrderButton id={order.id} />
                      )}
                    </div>
                    {/* وقت الطلب للهاتف (الموبايل) */}
                    <div className="flex flex-col gap-0.5 sm:hidden text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-1">📅 إنشاء: {order.createdAtLabel}</span>
                      <span className="flex items-center gap-1 text-indigo-650 dark:text-indigo-400 font-black">⏰ طلب: {order.customerOrderTime || "فوري"}</span>
                    </div>
                  </div>

                  {/* أزرار التواصل كأيقونات فقط للشاشات الكبيرة (الابتوب) بجانب اسم المحل */}
                  <div className="hidden sm:flex items-center gap-2 mr-2">
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors"
                      title="اتصال هاتفي"
                    >
                      <DynamicIcon icon={icons?.ui_call} fallback="📞" width={14} height={14} />
                    </a>
                    <a
                      href={`https://wa.me/${order.customerPhone.startsWith('0') ? '964' + order.customerPhone.slice(1) : order.customerPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 w-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center transition-colors"
                      title="مراسلة واتساب"
                    >
                      <DynamicIcon icon={icons?.ui_whatsapp} fallback="💬" width={14} height={14} />
                    </a>
                    {!hasLocation && order.requestLocationWaUrl && (
                      <a
                        href={order.requestLocationWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 w-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm flex items-center justify-center transition-colors"
                        title="طلب لوكيشن"
                      >
                        <DynamicIcon icon={icons?.ui_location} fallback="📍" width={14} height={14} />
                      </a>
                    )}
                    {hasLocation && order.notifyCustomerWaUrl && (
                      <a
                        href={order.notifyCustomerWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 w-9 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-sm flex items-center justify-center transition-colors"
                        title="تبليغ زبون"
                      >
                        <DynamicIcon icon={icons?.ui_notification} fallback="🔔" width={14} height={14} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="w-full sm:w-auto flex flex-wrap sm:flex-nowrap justify-between sm:justify-start items-center gap-3">
                  <button
                    onClick={() => setActiveAssignOrderId(order.id)}
                    className="flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-[10px] font-black shadow-sm active:scale-95 transition-all shrink-0"
                  >
                    <DynamicIcon icon={icons?.ui_package} fallback="📦" width={12} height={12} />
                    إسناد للمندوب
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* بادج وقت الطلب للابتوب (الحاسوب) */}
                    <span className="hidden sm:flex items-center gap-1.5 text-xs md:text-sm font-black bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400 px-3.5 py-2 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm" title="وقت إنشاء الطلب">
                      📅 إنشاء: {order.createdAtLabel}
                    </span>
                    <span className="hidden sm:flex items-center gap-1.5 text-xs md:text-sm font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 px-3.5 py-2 rounded-xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm" title="وقت الطلب المطلوب من الزبون">
                      ⏰ وقت الطلب: {order.customerOrderTime || "فوري"}
                    </span>

                    {order.routeMode === 'double' ? (
                      <>
                        <span className="flex items-center gap-1.5 text-sm font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400 px-3.5 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                          <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded leading-none">من</span>
                          {order.regionName}
                        </span>
                        <span className="flex items-center gap-1.5 text-sm font-black bg-rose-50 text-rose-700 dark:bg-rose-950/10 dark:text-rose-400 px-3.5 py-2 rounded-xl border border-rose-100 dark:border-rose-900/30 shadow-sm">
                          <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded leading-none">إلى</span>
                          {order.secondCustomerRegionName || "غير معروف"}
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm md:text-base font-black bg-sky-50 text-sky-700 dark:bg-sky-950/10 dark:text-sky-400 px-4 py-2 rounded-xl border border-sky-100 dark:border-sky-900/30 shadow-sm">
                        <DynamicIcon icon={icons?.ui_location} fallback="📍" width={14} height={14} /> {order.regionName}
                      </span>
                    )}
                    {order.orderType && order.orderType !== "—" && (
                      <span className="flex items-center gap-1.5 text-sm md:text-base font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/10 dark:text-indigo-400 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
                        🏷️ {order.orderType}
                      </span>
                    )}
                    {order.orderSubtotal ? (
                      <span className="inline-flex items-center gap-1.5 text-sm md:text-base font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                        {hasLocation && (
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" title="الموقع الجغرافي متوفر" />
                        )}
                        {order.orderSubtotal}
                      </span>
                    ) : order.totalAmount ? (
                      <span className="inline-flex items-center gap-1.5 text-sm md:text-base font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                        {hasLocation && (
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" title="الموقع الجغرافي متوفر" />
                        )}
                        {order.totalAmount}
                      </span>
                    ) : (
                      hasLocation && (
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0 self-center" title="الموقع الجغرافي متوفر" />
                      )
                    )}
                  </div>

                  {/* أزرار الحذف والتسجيل الصوتي للشاشات الكبيرة (الابتوب) كجزء من التدفق المرن لمنع التداخل */}
                  <div className="hidden sm:flex items-center gap-2 mr-2 shrink-0">
                    {order.voiceNoteUrl && (
                      <MiniVoicePlayer src={order.voiceNoteUrl} />
                    )}
                    <DeleteFullOrderButton id={order.id} isDraft={false} icons={icons} />
                  </div>
                </div>

                {/* أزرار الحذف والتسجيل الصوتي للموبايل فقط (تموضع مطلق) */}
                <div className="absolute left-5 top-5 flex items-center gap-2 z-10 sm:hidden">
                  {order.voiceNoteUrl && (
                    <MiniVoicePlayer src={order.voiceNoteUrl} />
                  )}
                  <DeleteFullOrderButton id={order.id} isDraft={false} icons={icons} />
                </div>
              </div>

              {/* Body (يظهر في الموبايل فقط ويختفي في الابتوب) */}
              <div className="p-5 flex items-center justify-between gap-4 sm:hidden">
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black bg-white dark:bg-slate-900 shadow-sm flex items-center gap-1.5 hover:bg-slate-50 transition-colors"
                  >
                    <DynamicIcon icon={icons?.ui_call} fallback="📞" width={12} height={12} />
                    اتصال هاتفي
                  </a>
                  <a
                    href={`https://wa.me/${order.customerPhone.startsWith('0') ? '964' + order.customerPhone.slice(1) : order.customerPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm flex items-center gap-1.5 transition-colors"
                  >
                    <DynamicIcon icon={icons?.ui_whatsapp} fallback="💬" width={12} height={12} />
                    مراسلة واتساب
                  </a>
                  {!hasLocation && order.requestLocationWaUrl && (
                    <a
                      href={order.requestLocationWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-sm flex items-center gap-1.5 transition-colors"
                    >
                      <DynamicIcon icon={icons?.ui_location} fallback="📍" width={12} height={12} />
                      طلب لوكيشن
                    </a>
                  )}
                  {hasLocation && order.notifyCustomerWaUrl && (
                    <a
                      href={order.notifyCustomerWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-sm flex items-center gap-1.5 transition-colors"
                    >
                      <DynamicIcon icon={icons?.ui_notification} fallback="🔔" width={12} height={12} />
                      تبليغ زبون
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        }

        const isStoreOrder =
          order.orderType?.toLowerCase().includes("متجر") ||
          order.orderType?.toLowerCase().includes("store") ||
          order.submissionLabel === "طلب متجر";
        const displayOrderType = isStoreOrder ? "متجر" : "تجهيز";

        return (
          <div
            key={order.id}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("button, a, input, select")) {
                return;
              }
              if (isDraftMode) {
                router.push(`${SECRET_ADMIN_PATH}/orders/${order.id}/price`);
              } else {
                router.push(`${SECRET_ADMIN_PATH}/orders/${order.id}`);
              }
            }}
            className={`relative overflow-hidden rounded-[2.5rem] border-2 transition-all cursor-pointer ${orderStatusPendingCardBorderBg} hover:border-sky-500 shadow-xl bg-white dark:bg-slate-950 p-6 space-y-4 text-right`}
            dir="rtl"
          >
            {/* Top row: Checkbox, Order number, Badges & Reject Button */}
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                {/* Selection Checkbox */}
                <div className="flex items-center justify-center h-8 w-8 bg-slate-100 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-white/5 shrink-0">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(order.id)}
                    onChange={() => toggleSelect(order.id)}
                    className="h-5 w-5 shrink-0 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer transition-all dark:bg-slate-900 dark:border-white/10"
                  />
                </div>

                <span className="text-xs font-black text-slate-500 dark:text-slate-400 tabular-nums shrink-0">#{order.orderNumber}</span>

                {/* Order Type */}
                <span className="flex items-center gap-1 text-[10px] sm:text-xs font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/10 dark:text-indigo-400 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/30 shrink-0">
                  🏷️ {displayOrderType}
                </span>

                {/* Region */}
                <span className="flex items-center gap-1 text-[10px] sm:text-xs font-black bg-sky-50 text-sky-700 dark:bg-sky-950/10 dark:text-sky-400 px-2 py-1 rounded-lg border border-sky-100 dark:border-sky-900/30 shrink-0">
                  <DynamicIcon icon={icons?.ui_location} fallback="📍" width={10} height={10} />
                  {order.regionName}
                </span>

                {/* Products count */}
                <span className="flex items-center gap-1 text-[10px] sm:text-xs font-black bg-amber-50 text-amber-700 dark:bg-amber-950/10 dark:text-amber-400 px-2 py-1 rounded-lg border border-amber-100 dark:border-amber-900/30 shrink-0">
                  📦 {order.preparerShoppingJson?.products?.length || 0} منتجات
                </span>

                {/* Creation Time */}
                <span className="flex items-center gap-1 text-[10px] sm:text-xs font-black bg-slate-50 text-slate-500 dark:bg-slate-900/30 dark:text-slate-400 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-white/5 shrink-0" title="وقت إنشاء الطلب">
                  📅 إنشاء: {order.createdAtLabel}
                </span>

                {/* Customer Order Time */}
                <span className="flex items-center gap-1 text-[10px] sm:text-xs font-black bg-rose-50 text-rose-700 dark:bg-rose-950/10 dark:text-rose-400 px-2 py-1 rounded-lg border border-rose-100 dark:border-rose-900/30 shrink-0" title="وقت الطلب المطلوب من الزبون">
                  ⏰ وقت الطلب: {order.customerOrderTime || "فوري"}
                </span>
              </div>

              {/* Reject Order Button (Trash) */}
              <div className="shrink-0">
                <DeleteFullOrderButton id={order.id} isDraft={!!isDraftMode} icons={icons} />
              </div>
            </div>

            {/* Current Assignee(s) Status if any */}
            {order.submittedByName && (
              <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <span>👤 المجهز الحالي:</span>
                <span className="text-slate-800 dark:text-slate-200">{order.submittedByName}</span>
              </p>
            )}

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between gap-1 pt-3 border-t border-slate-100 dark:border-white/5 w-full flex-nowrap">
              {/* Phone Button */}
              <a
                href={`tel:${order.customerPhone}`}
                className="h-8 sm:h-9 px-1.5 sm:px-3 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs font-black bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center gap-1 hover:bg-slate-50 transition-colors flex-1 sm:flex-initial"
              >
                <DynamicIcon icon={icons?.ui_call} fallback="📞" width={10} height={10} />
                <span>اتصال</span>
              </a>

              {/* WhatsApp Button */}
              <a
                href={`https://wa.me/${order.customerPhone.startsWith('0') ? '964' + order.customerPhone.slice(1) : order.customerPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 sm:h-9 px-1.5 sm:px-3 rounded-lg sm:rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] sm:text-xs font-black shadow-sm flex items-center justify-center gap-1 transition-colors flex-1 sm:flex-initial"
              >
                <DynamicIcon icon={icons?.ui_whatsapp} fallback="💬" width={10} height={10} />
                <span>مراسلة</span>
              </a>

              {/* Assign to Preparers Button */}
              <button
                type="button"
                onClick={() => setActiveAssignPreparerOrderId(order.id)}
                className="h-8 sm:h-9 px-1.5 sm:px-3 rounded-lg sm:rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[10px] sm:text-xs font-black shadow-sm flex items-center justify-center gap-1 transition-colors flex-1 sm:flex-initial"
              >
                <DynamicIcon icon={icons?.ui_user} fallback="👤" width={10} height={10} />
                <span className="hidden sm:inline">إسناد لمجهزين</span>
                <span className="inline sm:hidden">إسناد مجهزين</span>
              </button>

              {/* Assign to Couriers Button */}
              <button
                type="button"
                onClick={() => setActiveAssignOrderId(order.id)}
                className="h-8 sm:h-9 px-1.5 sm:px-3 rounded-lg sm:rounded-xl bg-violet-600 hover:bg-violet-750 text-white text-[10px] sm:text-xs font-black shadow-sm flex items-center justify-center gap-1 transition-colors flex-1 sm:flex-initial"
              >
                <DynamicIcon icon={icons?.ui_package} fallback="📦" width={10} height={10} />
                <span className="hidden sm:inline">إسناد لمندوبين</span>
                <span className="inline sm:hidden">إسناد مناديب</span>
              </button>
            </div>
          </div>
        );
      })}

      {/* Floating Modal for Assign */}
      {/* Floating Modal for Assign Preparer */}
      {activeAssignPreparerOrderId && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="absolute inset-0" onClick={() => setActiveAssignPreparerOrderId(null)} />
           <div className="relative w-full max-w-lg animate-in zoom-in-95 duration-200">
             {(() => {
                const o = orders.find(x => x.id === activeAssignPreparerOrderId);
                if (!o) return null;
                const draftData = o.preparerShoppingJson || {};
                const currentPreparerIds = Array.isArray(draftData.assignedPreparerIds) ? draftData.assignedPreparerIds : [];
                return (
                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl border-2 border-sky-500 text-right">
                    <AssignToPreparerPanel
                      orderId={o.id}
                      preparers={preparers}
                      isDraft={true}
                      initialPreparerIds={currentPreparerIds}
                      onSuccess={() => {
                        setActiveAssignPreparerOrderId(null);
                        window.location.reload();
                      }}
                      icons={icons || undefined}
                      hideContainer={true}
                    />
                  </div>
                );
             })()}
           </div>
        </div>
      )}

      {activeAssignOrderId && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="absolute inset-0" onClick={() => setActiveAssignOrderId(null)} />
           <div className="relative w-full max-w-lg animate-in zoom-in-95 duration-200">
             {(() => {
                const o = orders.find(x => x.id === activeAssignOrderId);
                if (!o) return null;
                return (
                  <PendingAssignPanel
                    orderId={o.id}
                    couriers={couriers}
                    routeMode={o.routeMode}
                    customerPhone={o.customerPhone}
                    customerAlternatePhone={o.customerAlternatePhone}
                    customerLandmark={o.customerLandmark}
                    defaultCustomerLocationUrl={o.customerLocationUrl}
                    secondCustomerLandmark={o.secondCustomerLandmark}
                    defaultSecondCustomerLocationUrl={o.secondCustomerLocationUrl}
                    customerDoorPhotoUrl={o.customerDoorPhotoUrl}
                    secondCustomerDoorPhotoUrl={o.secondCustomerDoorPhotoUrl}
                    icons={icons}
                    isDraft={o.submissionLabel === "مسودة مشتركة" || isDraftMode}
                    onSuccess={() => {
                      setActiveAssignOrderId(null);
                      window.location.reload();
                    }}
                  />
                );
             })()}
           </div>
        </div>
      )}

      {/* Floating Modal for Pricing (Mobile Friendly) */}
      {activePricingOrderId && (
        <div className="fixed inset-0 z-[1100] bg-slate-50 dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300">
           <div className="h-14 shrink-0 bg-white dark:bg-slate-900 border-b flex items-center justify-between px-4">
              <span className="text-sm font-black">تسعير الطلب #{orders.find(x => x.id === activePricingOrderId)?.orderNumber}</span>
              <button onClick={() => setActivePricingOrderId(null)} className="h-9 px-4 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black">إغلاق</button>
           </div>
           <div className="flex-1 overflow-hidden">
             {(() => {
                const o = orders.find(x => x.id === activePricingOrderId);
                if (!o) return null;
                return (
                  <OrderPricingPanel
                    orderId={o.id}
                    initialData={o.preparerShoppingJson || {}}
                    preparers={preparers}
                    couriers={couriers}
                    isDraft={isDraftMode}
                    icons={icons}
                    hideContainer={true}
                    storeProducts={storeProducts}
                    fishPricesRaw={fishPricesText}
                    onSuccess={() => {
                       window.location.reload();
                    }}
                  />
                );
             })()}
           </div>
        </div>
      )}

      {/* Floating Bottom Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[95%] max-w-xl bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-xl border-2 border-emerald-500/50 shadow-[0_20px_50px_rgba(0,0,0,0.3)] px-6 py-4 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom duration-300" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-mono text-sm font-black">
              {selectedIds.size}
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-white">طلبات محددة</p>
              <p className="text-[10px] font-bold text-slate-400">اختر إجراء لتطبيقه دفعة واحدة</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!isDraftMode && (
              <button
                onClick={() => setShowBulkAssignModal(true)}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[11px] font-black text-white active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-900/20"
              >
                <DynamicIcon icon={icons?.ui_package} fallback="📦" width={12} height={12} />
                إسناد جماعي
              </button>
            )}

            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-[11px] font-black text-white active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-rose-900/20"
            >
              <DynamicIcon icon={icons?.ui_trash} fallback="🗑️" width={12} height={12} />
              حذف جماعي
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="h-10 px-3 rounded-xl bg-slate-800 text-[11px] font-bold text-slate-400 hover:text-white transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setShowBulkDeleteConfirm(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 text-right border border-rose-100 dark:border-rose-900/50 shadow-2xl animate-in zoom-in-95 duration-200" dir="rtl">
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <div className="h-10 w-10 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-lg">⚠️</div>
              <h3 className="text-base font-black">تأكيد الحذف الجماعي</h3>
            </div>
            
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف <span className="text-rose-600 font-black">{selectedIds.size}</span> طلبات معلقة نهائياً؟
              <br />
              هذا الإجراء سيقوم أيضاً بحذف كافة مسودات التجهيز المرتبطة بها ولا يمكن التراجع عنه.
            </p>

            {bulkActionError && (
              <p className="p-3 mb-4 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-bold border border-rose-200">{bulkActionError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleBulkDelete}
                disabled={isBulkLoading}
                className="flex-1 h-12 bg-rose-600 text-white rounded-2xl text-xs font-black shadow-lg hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-40"
              >
                {isBulkLoading ? "جاري الحذف..." : "نعم، حذف نهائي"}
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-5 h-12 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl text-xs font-black hover:bg-slate-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setShowBulkAssignModal(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 text-right border border-emerald-100 dark:border-emerald-900/50 shadow-2xl animate-in zoom-in-95 duration-200" dir="rtl">
            <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/30 pb-3 mb-4">
              <p className="text-sm font-black text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                <DynamicIcon icon={icons?.ui_package} fallback="📦" width={18} height={18} /> إسناد جماعي لـ {selectedIds.size} طلبات
              </p>
              <button onClick={() => setShowBulkAssignModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-[10px] font-black text-slate-400">اختر المندوب لإسناد كافة الطلبات المحددة له *</p>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 custom-scrollbar">
                {couriers.map((c) => {
                  const active = bulkCourierId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setBulkCourierId(c.id)}
                      className={`group relative flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all duration-200 ${
                        active
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-md scale-[1.02]"
                          : "border-slate-100 dark:border-white/5 bg-white dark:bg-slate-800/40 hover:border-slate-200"
                      }`}
                    >
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${active ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-slate-50"}`}>
                        {active && "✓"}
                      </div>
                      <span className={`truncate text-xs font-black ${active ? "text-emerald-900 dark:text-emerald-100" : "text-slate-600 dark:text-slate-400"}`}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {bulkActionError && (
              <p className="p-3 mb-4 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-bold border border-rose-200">{bulkActionError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleBulkAssign}
                disabled={isBulkLoading || !bulkCourierId}
                className="flex-1 h-12 bg-emerald-600 text-white rounded-2xl text-xs font-black shadow-lg hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40"
              >
                {isBulkLoading ? "جاري الإسناد والتوصيل..." : "تأكيد الإسناد الجماعي"}
              </button>
              <button
                onClick={() => setShowBulkAssignModal(false)}
                className="px-5 h-12 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl text-xs font-black hover:bg-slate-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showFishPricesModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="absolute inset-0" onClick={() => setShowFishPricesModal(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-sky-600 to-indigo-600 p-4 text-white flex items-center justify-between gap-3">
              <div className="text-right">
                <h3 className="text-sm font-black flex items-center gap-1.5">🐟 أسعار السمك اليومية</h3>
                <p className="text-[9px] opacity-80">أدخل اسم السمكة متبوعاً بسعر الشراء وسعر البيع اليومي.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowFishPricesModal(false)} 
                className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 transition flex items-center justify-center shrink-0"
              >✕</button>
            </div>
            
            <div className="p-6 text-right space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 mb-1.5 block">قائمة أسعار السمك</label>
                <textarea
                  value={fishPricesText}
                  onChange={(e) => setFishPricesText(e.target.value)}
                  rows={8}
                  className="w-full bg-slate-50 dark:bg-black/20 rounded-2xl p-4 text-xs font-mono font-bold border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 ring-indigo-500"
                  placeholder="مثال:&#10;سلمون 6 6.5&#10;حمام3 10 11&#10;زبيدي 12 14"
                />
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 p-3 rounded-xl space-y-1">
                <p className="text-[10px] font-black text-amber-700 dark:text-amber-400">💡 تعليمات الإدخال:</p>
                <ul className="text-[9px] text-amber-600/90 dark:text-amber-400/90 list-disc pr-4 space-y-0.5 font-bold">
                  <li>كل نوع سمكة في سطر منفصل.</li>
                  <li>اكتب اسم السمكة ثم مسافة ثم سعر الشراء ثم مسافة ثم سعر البيع (بالألف، مثال: 6 تعني 6 آلاف).</li>
                  <li>إذا كانت البيعة لأكثر من كيلو (سعر ثابت)، اكتب الرقم متصلاً بالاسم، مثل: <span className="font-mono">حمام3 10 11</span></li>
                </ul>
              </div>

              {fishPricesSaveError && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/25 p-2.5 rounded-xl text-center">{fishPricesSaveError}</p>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSavingFishPrices}
                  onClick={async () => {
                    setIsSavingFishPrices(true);
                    setFishPricesSaveError(null);
                    try {
                      const { saveFishPrices } = await import("./pricing-actions");
                      const res = await saveFishPrices(fishPricesText);
                      if (res.error) {
                        setFishPricesSaveError(res.error);
                      } else if (res.ok) {
                        setShowFishPricesModal(false);
                        router.refresh();
                      }
                    } catch (err: any) {
                      setFishPricesSaveError(err.message || "حدث خطأ غير متوقع");
                    } finally {
                      setIsSavingFishPrices(false);
                    }
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-755 disabled:opacity-80 text-white py-3 rounded-2xl text-xs font-black shadow-md transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {isSavingFishPrices ? (
                    <>
                      <span className="h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>💾 حفظ الأسعار</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFishPricesModal(false)}
                  className="px-5 h-12 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl text-xs font-black hover:bg-slate-200"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

