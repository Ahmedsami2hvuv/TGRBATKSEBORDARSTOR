"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useMemo, useRef } from "react";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

import {
  assignPendingOrderToCourier,
  assignOrderToPreparer,
  setDraftAutoCourier,
  reassignOrderToPreparer,
  deleteOrderPermanently,
  rejectPendingOrder,
  rejectPreparerDraft,
  type AssignOrderState,
  type RejectOrderState,
} from "../actions";
import {
  bulkUpdateOrdersStatus,
  type BulkOrdersState,
} from "../bulk-actions";
import { updateOrderPricingByAdmin, savePricingProgress } from "./pricing-actions";
import { orderStatusPendingCardBorderBg } from "@/lib/order-status-style";
import { OrderStatusRadioGroup } from "@/components/order-status-radio-group";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import { calculateAutoSellPrice } from "@/lib/auto-pricing";
import { normalizeNumerals } from "@/lib/money-alf";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { VoiceNoteAudio } from "@/components/voice-note-audio";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export type PendingOrderRow = {
  id: string;
  orderNumber: number;
  routeMode: "single" | "double";
  shopName: string;
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
  deliveryPrice: string | null;
  rawDeliveryPriceDinar: number | null;
  submittedByName: string | null;
  submissionLabel: string | null;
  customerLocationUrl: string;
  customerLandmark: string;
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
  icons
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
  const bound = assignOrderToPreparer.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as AssignOrderState);

  useEffect(() => {
    if (state.ok && onSuccess) onSuccess();
  }, [state.ok, onSuccess]);

  const togglePreparer = (id: string) => {
    setSelectedPreparers(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  if (preparers.length === 0) return <p className="p-3 bg-amber-50 text-amber-900 rounded-lg text-xs font-bold border border-amber-200 text-center flex items-center justify-center gap-2"><DynamicIcon icon={icons?.ui_warning} fallback="⚠️" width={14} height={14} /> لا يوجد مجهزون متاحون حالياً.</p>;

  return (
    <form action={formAction} className={hideContainer ? "relative text-right" : "relative overflow-hidden rounded-[2rem] border border-sky-200/50 dark:border-sky-900/30 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 shadow-xl ring-1 ring-white/20 dark:ring-white/10 text-right animate-in zoom-in-95 duration-300"} dir="rtl">
      {!hideContainer && (
        <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-sky-400/10 blur-2xl" />
      )}

      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="isDraft" value={String(!!isDraft)} />
      {selectedPreparers.map(id => <input key={id} type="hidden" name="preparerIds" value={id} />)}

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-black text-sky-900 dark:text-sky-100 flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-200">
            <DynamicIcon icon={icons?.ui_shop} fallback="🛒" width={14} height={14} />
          </div>
          إسناد الطلب للمجهزين
        </p>
        <span className="text-[9px] font-bold bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800">
          {selectedPreparers.length} مختار
        </span>
      </div>

      <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 py-1">
        {preparers.map((p) => (
          <label
            key={p.id}
            className={`group relative flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer duration-300 ${
              selectedPreparers.includes(p.id)
              ? "border-sky-500 bg-sky-500 text-white shadow-lg shadow-sky-100 dark:shadow-sky-900/20 ring-2 ring-white/50"
              : "border-white dark:border-slate-800 bg-white/40 dark:bg-slate-800/40 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-white dark:hover:bg-slate-800"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedPreparers.includes(p.id)}
              onChange={() => togglePreparer(p.id)}
              className="sr-only"
            />
            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${selectedPreparers.includes(p.id) ? "border-white bg-white" : "border-sky-200 dark:border-slate-600 bg-white/50 dark:bg-slate-900/50"}`}>
              {selectedPreparers.includes(p.id) && <div className="h-1.5 w-1.5 rounded-full bg-sky-600" />}
            </div>
            <span className={`text-[10px] font-black truncate ${selectedPreparers.includes(p.id) ? "text-white" : "text-slate-600 dark:text-slate-300"}`}>{p.name}</span>
          </label>
        ))}
      </div>

      {state.error && <p className="mt-3 text-[10px] text-rose-600 font-bold p-2 bg-rose-50/80 dark:bg-rose-900/20 rounded-xl border border-rose-200/50 dark:border-rose-800/50 backdrop-blur-md animate-shake">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 py-3 text-xs font-black text-white shadow-lg shadow-sky-200 active:scale-95 transition-all"
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
        <span className="relative flex items-center justify-center gap-2">
          {pending ? "جارٍ الحفظ..." : (
            <>
              <DynamicIcon icon={icons?.ui_success} fallback="✅" width={14} height={14} />
              {selectedPreparers.length === 0 ? "إلغاء الإسناد" : (initialPreparerIds.length > 0 ? "تحديث المجهزين" : "إسناد المجهزين")}
            </>
          )}
        </span>
      </button>
    </form>
  );
}

/** زر حذف الطلب بالكامل مع طلب تأكيد */
function DeleteFullOrderButton({ id, isDraft, onSuccess, icons }: { id: string, isDraft: boolean, onSuccess?: () => void, icons: GlobalIconsConfig | null }) {
  const bound = deleteOrderPermanently.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as any);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (state.ok && onSuccess) onSuccess(); }, [state.ok, onSuccess]);
  if (confirm) {
    return (
      <form action={formAction} className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 bg-rose-50 dark:bg-rose-900/30 p-1 px-2 rounded-xl border border-rose-200 dark:border-rose-800 shadow-lg shadow-rose-200/20 animate-shake">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="isDraft" value={String(isDraft)} />
        <span className="text-[10px] font-black text-rose-700 dark:text-rose-300 px-1">حذف نهائي؟</span>
        <button type="submit" disabled={pending} className="bg-rose-600 text-white px-3 py-1 rounded-lg text-[10px] font-black shadow-sm active:scale-90">نعم</button>
        <button type="button" onClick={() => setConfirm(false)} className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg text-[10px] font-black border border-slate-200 dark:border-slate-700">لا</button>
      </form>
    );
  }
  return (
    <button type="button" onClick={() => setConfirm(true)} className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-xl border-2 border-rose-600 dark:border-rose-900/50 transition-all text-[11px] font-black bg-white dark:bg-slate-900 shadow-sm active:scale-95 group">
      <DynamicIcon icon={icons?.ui_delete} fallback="🗑️" width={12} height={12} className="group-hover:animate-bounce" /> مسح الطلب
    </button>
  );
}

/** لوحة تسعير إدارية ذكية تدعم الإضافة الجماعية والتسعير التلقائي والحفظ التلقائي */
export function AdminPricingPanel({
  orderId,
  initialData,
  orderSummary,
  isDraft,
  initialPreparerIds = [],
  shops = [],
  preparers = [],
  rawDeliveryPriceDinar = null,
  icons = null,
  onSuccess,
  extraActions,
  hideContainer = false,
}: {
  orderId: string;
  initialData: any;
  orderSummary?: string;
  isDraft?: boolean;
  initialPreparerIds?: string[];
  shops?: { id: string; name: string }[];
  preparers?: { id: string; name: string }[];
  rawDeliveryPriceDinar?: number | null;
  onSuccess?: () => void;
  icons?: GlobalIconsConfig | null;
  extraActions?: React.ReactNode;
  hideContainer?: boolean;
}) {
  const findPreparerName = (id: string | null | undefined) => {
    return preparers.find((p) => p.id === id)?.name ?? null;
  };

  const [products, setProducts] = useState<any[]>(() => {
    const list = Array.isArray(initialData?.products)
      ? initialData.products.map((item: any) => ({
          ...item,
          assignedPreparerId: typeof item.assignedPreparerId === "string" && item.assignedPreparerId.trim() ? item.assignedPreparerId.trim() : null,
          assignedPreparerName: typeof item.assignedPreparerName === "string" ? item.assignedPreparerName : null,
          // التأكد من جلب المورد المرتبط بالمنتج إذا كان من المتجر
          supplierId: item.supplierId || null,
        }))
      : [];
    if (list.length > 0) return list;
    return (orderSummary || "")
      .split("\n")
      .filter((l) => l.trim().length > 2)
      .map((l) => ({
        line: l.trim(),
        buyAlf: "0",
        sellAlf: "0",
        pricedBy: null,
        assignedPreparerId: null,
        assignedPreparerName: null,
      }));
  });

  const [placesCount, setPlacesCount] = useState(initialData?.placesCount || 1);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [selectedProductIndexes, setSelectedProductIndexes] = useState<number[]>([]);
  const [productAssigneeId, setProductAssigneeId] = useState("");
  const [showReassign, setShowReassign] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [productPhotoById, setProductPhotoById] = useState<Record<string, string>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);

  const bound = updateOrderPricingByAdmin.bind(null, orderId);
  const [state, formAction, pending] = useActionState(bound, {} as any);

  // حساب سعر التوصيل  من السعر الخام بالدينار، أو من initialData إذا توفر
  const deliveryAlfVal = useMemo(() => {
    if (rawDeliveryPriceDinar != null) return rawDeliveryPriceDinar;
    return Number(initialData?.deliveryAlf || 0);
  }, [rawDeliveryPriceDinar, initialData?.deliveryAlf]);

  // منطق الحفظ التلقائي
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (products.length > 0) {
        setIsSaving(true);
        await savePricingProgress(orderId, !!isDraft, products, placesCount);
        setIsSaving(false);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [products, placesCount, orderId, isDraft]);

  useEffect(() => {
    const productIds = Array.from(
      new Set(
        products
          .map((p) => (typeof p?.productId === "string" ? p.productId.trim() : ""))
          .filter((id) => id.length > 0),
      ),
    );
    if (productIds.length === 0) {
      setProductPhotoById({});
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api${SECRET_ADMIN_PATH}/store/products?ids=${encodeURIComponent(productIds.join(","))}`);
        if (!res.ok) return;
        const rows = await res.json();
        if (!Array.isArray(rows) || cancelled) return;
        const next: Record<string, string> = {};
        for (const row of rows) {
          const id = typeof row?.id === "string" ? row.id : "";
          const firstPhoto = Array.isArray(row?.photoUrls) && row.photoUrls.length > 0 ? String(row.photoUrls[0]) : "";
          if (id && firstPhoto) next[id] = firstPhoto;
        }
        setProductPhotoById(next);
      } catch {
        if (!cancelled) setProductPhotoById({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [products]);

  const toggleProductSelection = (index: number) => {
    setSelectedProductIndexes((prev) => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  };

  const toggleSelectAllProducts = () => {
    if (selectedProductIndexes.length === products.length) {
      setSelectedProductIndexes([]);
    } else {
      setSelectedProductIndexes(products.map((_, idx) => idx));
    }
  };

  const clearSelection = () => {
    setSelectedProductIndexes([]);
    setProductAssigneeId("");
  };

  const assignSelectedProductsToPreparer = async () => {
    if (!productAssigneeId || selectedProductIndexes.length === 0) return;
    const preparerName = findPreparerName(productAssigneeId);
    const next = products.map((item, idx) => selectedProductIndexes.includes(idx) ? {
      ...item,
      assignedPreparerId: productAssigneeId,
      assignedPreparerName: preparerName,
    } : item);
    setProducts(next);
    setSelectedProductIndexes([]);
    setProductAssigneeId("");
    setIsSaving(true);
    await savePricingProgress(orderId, !!isDraft, next, placesCount);
    setIsSaving(false);
  };

  const updateProduct = (index: number, field: string, value: any) => {
    const next = [...products];
    const item = { ...next[index], [field]: value };

    if (field === "buyAlf" || field === "sellAlf") {
      const safeVal = (value ?? "").toString();
      const cleanVal = safeVal.replace(/[^\d.٠-٩]/g, '');
      item[field] = cleanVal;
      if (field === "buyAlf") {
        const engNum = parseFloat(normalizeNumerals(cleanVal)) || 0;
        item.sellAlf = calculateAutoSellPrice(item.line, engNum).toString();
      }
    } else if (field === "pricedBy") {
      item.pricedBy = value === true ? "الإدارة" : null;
    } else if (field === "assignedPreparerId") {
      item.assignedPreparerId = value || null;
      item.assignedPreparerName = value ? findPreparerName(value) : null;
    } else {
      item[field] = value;
    }
    next[index] = item;
    setProducts(next);
  };

  const handleBulkAdd = (text: string) => {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 1);
    const newProds = lines.map(line => ({ line, buyAlf: "0", sellAlf: "0", pricedBy: null, assignedPreparerId: null, assignedPreparerName: null }));
    setProducts([...products, ...newProds]);
    setShowBulkAdd(false);
  };

  const totals = useMemo(() => {
    const sumSell = products.reduce((acc, p) => {
      const val = (p?.sellAlf ?? "0").toString();
      return acc + (parseFloat(normalizeNumerals(val)) || 0);
    }, 0);
    const extra = calculateExtraAlfFromPlacesCount(placesCount);
    return { subtotal: sumSell + extra, total: sumSell + extra + deliveryAlfVal };
  }, [products, placesCount, deliveryAlfVal]);

  const allProductsPriced = useMemo(() => {
    return products.length > 0 && products.every(p => {
      const buy = parseFloat(normalizeNumerals((p?.buyAlf ?? "0").toString())) || 0;
      const sell = parseFloat(normalizeNumerals((p?.sellAlf ?? "0").toString())) || 0;
      return buy > 0 && sell > 0;
    });
  }, [products]);

  const canSubmitFinal = allProductsPriced && placesCount > 0;

  useEffect(() => {
    if (state.ok && onSuccess) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <div className={hideContainer ? "relative text-right" : "relative overflow-hidden rounded-[2.5rem] border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] ring-1 ring-white/20 dark:ring-white/10 text-right transition-colors"} dir="rtl">
      {!hideContainer && (
        <>
          {/* Background Decor */}
          <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-amber-200/30 dark:bg-amber-900/10 blur-[60px]" />
          <div className="absolute -right-20 -bottom-20 h-40 w-40 rounded-full bg-violet-200/30 dark:bg-violet-900/10 blur-[60px]" />
        </>
      )}

      <div className={hideContainer ? "" : "relative p-3 sm:p-5"}>
        {/* Floating Header - Now Sticky and Opaque */}
        <div className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-2.5 rounded-2xl border border-white/60 dark:border-slate-700/50 shadow-xl shadow-slate-200/40 dark:shadow-none mb-4 -mx-1">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-200 dark:shadow-none shrink-0">
              <DynamicIcon icon={icons?.admin_pricing} fallback="💰" width={22} height={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-800 dark:text-slate-100 leading-tight truncate">
                {isDraft ? "تسعير المسودة" : "تعديل التسعير"}
              </p>
              {isSaving && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="h-1 w-1 rounded-full bg-sky-500 animate-pulse" />
                  <span className="text-[8px] font-bold text-sky-600 dark:text-sky-400">جاري الحفظ...</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!hideContainer && extraActions}
            <button type="button" onClick={() => setShowReassign(!showReassign)} className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm hover:scale-105 active:scale-95 transition-all border border-slate-200 dark:border-white/10" title="إسناد لمجهز">
              <DynamicIcon icon={icons?.ui_plus} fallback="🏢" width={14} height={14} />
            </button>
            <button type="button" onClick={() => setShowBulkAdd(!showBulkAdd)} className="h-9 w-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md hover:scale-105 active:scale-95 transition-all" title="إضافة منتجات">
              <DynamicIcon icon={icons?.ui_plus} fallback="➕" width={14} height={14} />
            </button>
            {!hideContainer && <DeleteFullOrderButton id={orderId} isDraft={Boolean(isDraft)} onSuccess={onSuccess} icons={icons} />}
          </div>
        </div>

      <div className="space-y-4">
        {showReassign && <div className="animate-in slide-in-from-top-2"><AssignToPreparerPanel orderId={orderId} preparers={preparers} isDraft={isDraft} initialPreparerIds={initialPreparerIds} onSuccess={() => { setShowReassign(false); onSuccess?.(); }} icons={icons || undefined} hideContainer={true} /></div>}

        {showBulkAdd && (
          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border-2 border-violet-200 dark:border-violet-900/50 animate-in zoom-in-95 shadow-inner">
            <p className="text-[10px] font-bold text-violet-900 dark:text-violet-300 mb-2">أدخل المنتجات الجديدة (سطر لكل منتج):</p>
            <textarea className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-700 font-bold text-slate-900 dark:text-slate-100" placeholder="لحم شرح 1ك&#10;خيار 2 كيلو" onBlur={(e) => {
                const lines = e.target.value.split("\n").map(l => l.trim()).filter(l => l.length > 1);
                if (lines.length) { setProducts([...products, ...lines.map(line => ({ line, buyAlf: "0", sellAlf: "0", pricedBy: null, assignedPreparerId: null, assignedPreparerName: null }))]); setShowBulkAdd(false); }
                e.target.value = "";
              }} />
          </div>
        )}

        {products.length > 0 && selectedProductIndexes.length > 0 && (
          <div className="rounded-xl bg-sky-900 dark:bg-sky-950 p-2 shadow-lg animate-in slide-in-from-top-1">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-white">تخصيص {selectedProductIndexes.length} منتج لـ:</p>
                <button type="button" onClick={clearSelection} className="text-[9px] font-bold text-sky-200 hover:text-white">إلغاء</button>
              </div>
              <div className="flex gap-1">
                <select value={productAssigneeId} onChange={(e) => setProductAssigneeId(e.target.value)} className="flex-1 rounded-lg border-none bg-white dark:bg-slate-800 p-1.5 text-[10px] font-black outline-none text-slate-900 dark:text-slate-100">
                  <option value="">اختر المجهز</option>
                  {preparers.map((prep) => (
                    <option key={prep.id} value={prep.id}>{prep.name}</option>
                  ))}
                </select>
                <button type="button" onClick={assignSelectedProductsToPreparer} disabled={!productAssigneeId} className="rounded-lg bg-emerald-500 px-3 text-[10px] font-black text-white shadow-sm disabled:opacity-40">
                  تطبيق
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-1.5 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
          {products.length > 0 && (
            <button type="button" onClick={toggleSelectAllProducts} className="text-[10px] font-bold text-slate-400 dark:text-slate-500 text-right pr-2 pb-1 hover:text-amber-600 transition-colors">
              {selectedProductIndexes.length === products.length ? "إلغاء تحديد الكل" : "تحديد الكل للمهام الجماعية"}
            </button>
          )}
          {products.map((p, i) => {
            const isEditing = editingIndex === i;
            const priced = parseFloat(normalizeNumerals((p?.buyAlf ?? "0").toString())) > 0;
            const isSelected = selectedProductIndexes.includes(i);
            return (
              <div key={i} className={`rounded-xl transition-all ${isSelected ? "ring-2 ring-sky-500 shadow-md" : ""}`}>
                <div className="flex gap-2">
                  <label className="flex items-center pr-1">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleProductSelection(i)} className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sky-600 focus:ring-sky-500" />
                  </label>
                  <div
                    className={`relative flex-1 flex items-center justify-between p-1 rounded-2xl border transition-all duration-300 overflow-hidden ${
                      deleteMode
                      ? "border-rose-400 bg-rose-50/80 dark:bg-rose-900/20"
                      : priced
                      ? "border-emerald-500/30 bg-white dark:bg-slate-800/80 shadow-[0_4px_15px_rgba(16,185,129,0.05)]"
                      : "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-amber-400 shadow-sm"
                    }`}
                    onClick={() => {
                      if (!deleteMode) {
                        setEditingIndex(isEditing ? null : i);
                      }
                    }}
                  >
                    {priced && <div className="absolute inset-y-0 right-0 w-1 bg-emerald-500" />}

                    <div className="flex-1 min-w-0 flex items-center gap-2.5 p-1">
                      <div className="relative">
                        {p?.productId && productPhotoById[p.productId] ? (
                          <div className="h-11 w-11 overflow-hidden rounded-xl border-2 border-white dark:border-slate-700 shadow-md shrink-0">
                            <img src={productPhotoById[p.productId]} alt="" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border-2 border-white dark:border-slate-700 shadow-inner ${priced ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500" : "bg-slate-100 dark:bg-slate-900/50 text-slate-400"}`}>
                            <DynamicIcon icon={icons?.store_cart} fallback="📦" width={18} height={18} />
                          </div>
                        )}
                        {priced && (
                          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800 flex items-center justify-center">
                            <DynamicIcon icon={icons?.ui_success} fallback="✓" width={8} height={8} className="text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black truncate leading-tight ${priced ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}`}>{p?.line}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {priced ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-black border border-amber-100 dark:border-amber-900/50">💰 {p?.buyAlf} → {p?.sellAlf}</span>
                              {(findPreparerName(p?.assignedPreparerId) || p?.assignedPreparerName) && (
                                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                                  <DynamicIcon icon={icons?.ui_user} fallback="👤" width={8} height={8} />
                                  {findPreparerName(p?.assignedPreparerId) || p?.assignedPreparerName}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[9px] font-bold text-rose-400 animate-pulse">لم يتم التسعير بعد</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 px-2">
                      {deleteMode ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setProducts(products.filter((_, idx) => idx !== i)); }} className="h-8 w-8 flex items-center justify-center rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-200">
                          <DynamicIcon icon={icons?.ui_close} fallback="✕" width={12} height={12} />
                        </button>
                      ) : (
                        <div className={`h-8 w-8 flex items-center justify-center rounded-xl transition-all ${isEditing ? "bg-amber-500 text-white shadow-lg shadow-amber-200" : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300"}`}>
                          <DynamicIcon icon={icons?.ui_settings} fallback="⚙️" width={14} height={14} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {isEditing && !deleteMode && (
                  <div className="mt-2 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 p-3 rounded-[1.5rem] border-2 border-amber-400/50 shadow-xl shadow-amber-100/50 dark:shadow-none animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={p?.line}
                          onChange={(e) => updateProduct(i, "line", e.target.value)}
                          className="w-full bg-transparent text-sm font-black text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-1.5 focus:border-amber-500 outline-none transition-colors"
                          placeholder="اسم المنتج"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 mr-1 uppercase tracking-wider">سعر الشراء</label>
                        <div className="relative">
                          <input type="text" inputMode="decimal" value={p?.buyAlf ?? ""} onChange={(e) => updateProduct(i, "buyAlf", e.target.value)} className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 text-sm font-black font-mono shadow-sm focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900/50 outline-none transition-all text-slate-900 dark:text-slate-100" autoFocus placeholder="0" />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-300 dark:text-slate-600">IQD</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 mr-1 uppercase tracking-wider">سعر البيع</label>
                        <div className="relative">
                          <input type="text" inputMode="decimal" value={p?.sellAlf ?? ""} onChange={(e) => updateProduct(i, "sellAlf", e.target.value)} className="w-full rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800 p-2 text-sm font-black font-mono text-emerald-700 dark:text-emerald-300 shadow-sm focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-900/50 outline-none transition-all" placeholder="0" />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-emerald-400 dark:text-emerald-600">IQD</span>
                        </div>
                      </div>

                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 mr-1 uppercase tracking-wider">تخصيص المجهز</label>
                        <select value={p?.assignedPreparerId ?? ""} onChange={(e) => updateProduct(i, "assignedPreparerId", e.target.value)} className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 text-xs font-black outline-none shadow-sm transition-all focus:border-amber-400 dark:focus:border-amber-600 text-slate-900 dark:text-slate-100">
                          <option value="">-- بدون تخصيص (الكل) --</option>
                          {preparers.map((prep) => (
                            <option key={prep.id} value={prep.id}>{prep.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2 flex items-center justify-between py-1 px-1 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id={`priced-by-me-${i}`} checked={Boolean(p?.pricedBy === "الإدارة")} onChange={(e) => updateProduct(i, "pricedBy", e.target.checked)} className="sr-only peer" />
                            <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:right-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:-translate-x-4 peer-checked:after:border-white"></div>
                          </div>
                          <label htmlFor={`priced-by-me-${i}`} className="text-[9px] font-black text-slate-700 dark:text-slate-300">تجهيز شخصي</label>
                        </div>
                        <button type="button" onClick={() => setEditingIndex(null)} className="h-8 px-4 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-black shadow-lg hover:bg-black dark:hover:bg-slate-700 transition-all border border-white/10">
                          تثبيت السعر
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Summary Bar */}
      <div className="sticky bottom-0 z-40 mt-6 -mx-3 -mb-3 sm:-mx-5 sm:-mb-5 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-white/60 dark:border-slate-700/50 rounded-t-[2.5rem] shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="relative group">
              <select value={placesCount} onChange={(e) => setPlacesCount(Number(e.target.value))} className="w-full appearance-none rounded-2xl bg-slate-100 dark:bg-slate-800 p-2 pr-8 text-[11px] font-black text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900/50 transition-all border border-transparent focus:border-amber-400">
                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} محل</option>)}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500">
                <DynamicIcon icon={icons?.ui_shop} fallback="🛒" width={12} height={12} />
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-[7px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-tighter">المنتجات</span>
              <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 font-mono leading-none mt-0.5">{totals.subtotal.toLocaleString()}</span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-900/50">
              <span className="text-[7px] font-black text-sky-500 dark:text-sky-400 uppercase tracking-tighter">التوصيل</span>
              <span className="text-[11px] font-black text-sky-700 dark:text-sky-300 font-mono leading-none mt-0.5">{deliveryAlfVal > 0 ? deliveryAlfVal.toLocaleString() : "—"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-950 text-white shadow-xl shadow-slate-200 dark:shadow-none border border-white/10">
               <div className="flex flex-col">
                 <span className="text-[8px] font-bold text-slate-400">المجموع النهائي</span>
                 <span className="text-lg font-black font-mono leading-none">{totals.total.toLocaleString()} <span className="text-[10px] font-bold text-slate-500">الف</span></span>
               </div>
               <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                 <DynamicIcon icon={icons?.ui_rocket} fallback="🚀" width={20} height={20} />
               </div>
            </div>

            <button
              type="button"
              onClick={() => { setDeleteMode(!deleteMode); setEditingIndex(null); }}
              className={`h-14 w-14 flex items-center justify-center rounded-2xl border-2 transition-all ${deleteMode ? "bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-200 scale-110" : "bg-white dark:bg-slate-800 text-rose-500 border-rose-100 dark:border-slate-700 shadow-sm"}`}
            >
              <DynamicIcon icon={icons?.ui_delete} fallback="🗑️" width={24} height={24} />
            </button>
          </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="productsJson" value={JSON.stringify(products)} />
        <input type="hidden" name="placesCount" value={placesCount} />
        {isDraft && <input type="hidden" name="autoCourierId" value={String(initialData?.autoCourierId ?? "")} />}
        {isDraft && <input type="hidden" name="shopId" value={selectedShopId} />}
        {isDraft && <input type="hidden" name="isDraft" value="true" />}

        <div className="flex items-center gap-2 px-1">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="skipWallet" id="skip-w" className="sr-only peer" />
            <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:right-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:-translate-x-4"></div>
            <span className="mr-2 text-[10px] font-black text-slate-500 dark:text-slate-400">تخطي محفظة المجهز (تجهيز إداري)</span>
          </label>
        </div>

        {state.error && <p className="text-[10px] text-rose-600 font-bold p-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl animate-shake">⚠️ {state.error}</p>}

        {isDraft ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="submit" name="submitType" value="admin_approve" disabled={pending} className="group relative overflow-hidden rounded-2xl bg-emerald-600 py-3 text-[11px] font-black text-white shadow-xl shadow-emerald-200 dark:shadow-none active:scale-95 transition-all">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
              <span className="relative flex items-center justify-center gap-1.5">
                {pending ? "جارٍ..." : <><DynamicIcon icon={icons?.ui_success} fallback="✅" width={14} height={14} /> اعتماد المسودة</>}
              </span>
            </button>
            <button type="submit" name="submitType" value="final_send" disabled={pending || !canSubmitFinal} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 py-3 text-[11px] font-black text-white shadow-xl shadow-indigo-200 dark:shadow-none active:scale-95 transition-all">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
              <span className="relative flex items-center justify-center gap-1.5">
                {pending ? "جارٍ..." : <><DynamicIcon icon={icons?.ui_rocket} fallback="🚀" width={14} height={14} /> إرسال نهائي</>}
              </span>
            </button>
          </div>
        ) : (
          <button type="submit" disabled={pending} className="w-full relative overflow-hidden rounded-2xl bg-slate-900 dark:bg-slate-800 py-4 text-xs font-black text-white shadow-2xl active:scale-[0.98] transition-all border border-white/10">
             <span className="relative flex items-center justify-center gap-2">
               {pending ? "جارٍ الحفظ..." : <><DynamicIcon icon={icons?.ui_success} fallback="✅" width={16} height={16} /> حفظ التعديلات وإرسال للمندوب</>}
             </span>
          </button>
        )}
      </form>
        </div>
      </div>
    </div>

      {previewImageUrl ? (
        <div
          className="fixed inset-0 z-[450] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => {
            setPreviewImageUrl(null);
            setPreviewZoom(1);
          }}
        >
          <div className="relative max-h-[88vh] max-w-[88vw]" onClick={(e) => e.stopPropagation()}>
            <div className="absolute left-2 top-2 z-10 flex items-center gap-2 rounded-xl bg-black/60 p-1.5">
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                className="rounded-md bg-white/90 px-2 py-1 text-xs font-black text-slate-900 hover:bg-white"
                aria-label="تصغير الصورة"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom(1)}
                className="rounded-md bg-white/90 px-2 py-1 text-xs font-black text-slate-900 hover:bg-white"
                aria-label="إرجاع الحجم الطبيعي"
              >
                100%
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                className="rounded-md bg-white/90 px-2 py-1 text-xs font-black text-slate-900 hover:bg-white"
                aria-label="تكبير الصورة"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setPreviewImageUrl(null);
                setPreviewZoom(1);
              }}
              className="absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700"
              aria-label="إغلاق الصورة"
            >
              ✕
            </button>
            <img
              src={previewImageUrl}
              alt="معاينة صورة المنتج"
              className="max-h-[88vh] max-w-[88vw] rounded-2xl border-2 border-white object-contain shadow-2xl transition-transform duration-150"
              style={{ transform: `scale(${previewZoom})` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** مكون إسناد الطلب للمندوب */
export function PendingAssignPanel({
  orderId,
  couriers,
  customerPhone,
  customerAlternatePhone,
  defaultCustomerLocationUrl,
  defaultCustomerLandmark,
  defaultCustomerDoorPhotoUrl,
  icons,
  onSuccess,
}: {
  orderId: string;
  couriers: { id: string; name: string }[];
  customerPhone: string;
  customerAlternatePhone: string;
  defaultCustomerLocationUrl: string;
  defaultCustomerLandmark: string;
  defaultCustomerDoorPhotoUrl: string;
  icons: GlobalIconsConfig | null;
  onSuccess?: () => void;
  hideContainer?: boolean;
}) {
  const bound = assignPendingOrderToCourier.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as AssignOrderState);

  useEffect(() => {
    if (state.ok && onSuccess) {
      onSuccess();
    }
  }, [state.ok, onSuccess]);

  if (couriers.length === 0) return <p className="p-3 bg-amber-50 text-amber-900 rounded-lg text-sm font-bold border border-amber-200 text-center flex items-center justify-center gap-2"><DynamicIcon icon={icons?.ui_warning} fallback="⚠️" width={16} height={16} /> لا يوجد مندوبون مسجلون.</p>;

  const inputClass = "w-full rounded-xl border border-white dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 p-2.5 text-xs font-mono outline-none text-left backdrop-blur-sm focus:ring-2 focus:ring-emerald-400 dark:focus:ring-emerald-900/50 transition-all shadow-sm text-slate-900 dark:text-slate-100";
  const labelClass = "text-[10px] font-black text-emerald-800 dark:text-emerald-400 mb-1 block pr-1 uppercase tracking-wider";

  return (
    <form action={formAction} encType="multipart/form-data" className={hideContainer ? "relative text-right" : "relative overflow-hidden rounded-[2rem] border border-white/60 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl p-5 shadow-2xl ring-1 ring-white/20 dark:ring-white/10 animate-in zoom-in-95 text-right"} dir="rtl">
      {!hideContainer && (
        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-400/10 dark:bg-emerald-900/5 blur-3xl" />
      )}

      <input type="hidden" name="orderId" value={orderId} />

      <div className="flex items-center justify-between border-b border-emerald-100/50 dark:border-emerald-900/30 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none">
            <DynamicIcon icon={icons?.ui_package} fallback="📦" width={20} height={20} />
          </div>
          <div>
            <p className="text-xs font-black text-emerald-950 dark:text-emerald-50">إسناد فوري للمندوب</p>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">الزبون: {customerPhone}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <OrderStatusRadioGroup
            name="courierId"
            defaultValue=""
            required
            legend="اختر المندوب المتوفر"
            options={couriers.map((c) => ({ value: c.id, label: c.name }))}
          />

          <div className="flex items-center gap-3 bg-emerald-50/50 dark:bg-emerald-900/20 p-3 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/50 backdrop-blur-sm">
            <div className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="direct-receipt" name="directReceipt" className="sr-only peer" />
              <div className="w-10 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:right-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:-translate-x-5"></div>
            </div>
            <label htmlFor="direct-receipt" className="text-[10px] font-black text-emerald-950 dark:text-emerald-200 cursor-pointer select-none flex items-center gap-1">
              استلام مباشر (تخطي الموافقة) <DynamicIcon icon={icons?.ui_flash} fallback="⚡" width={12} height={12} className="text-amber-500" />
            </label>
          </div>

          <div className="space-y-1">
             <label className={labelClass}>رقم ثانٍ / بديل</label>
             <input type="text" name="customerAlternatePhone" defaultValue={customerAlternatePhone} className={inputClass} placeholder="07XXXXXXXX" />
          </div>

          <div className="space-y-1">
             <label className={labelClass}>أقرب نقطة دالة</label>
             <input type="text" name="customerLandmark" defaultValue={defaultCustomerLandmark} className={inputClass} style={{ textAlign: 'right' }} placeholder="مثال: قرب صيدلية السلام" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className={labelClass}>رابط اللوكيشن الرسمي (GPS)</label>
            <textarea name="customerLocationUrl" rows={2} defaultValue={defaultCustomerLocationUrl} className={inputClass} dir="ltr" placeholder="https://maps.app.goo.gl/..." />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>صورة باب الزبون</label>
            <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800 bg-white/50 dark:bg-slate-800/50 p-3 transition-all hover:bg-white/80 dark:hover:bg-slate-800/80">
              {defaultCustomerDoorPhotoUrl ? (
                <div className="relative group aspect-video w-full overflow-hidden rounded-xl border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                  <img src={resolvePublicAssetSrc(defaultCustomerDoorPhotoUrl)!} alt="صورة الباب" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-emerald-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                    <p className="text-[10px] text-white font-black px-3 py-1.5 rounded-full bg-white/20 border border-white/40">تغيير الصورة</p>
                  </div>
                </div>
              ) : (
                <div className="aspect-video w-full flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-xl text-[10px] text-slate-400 dark:text-slate-500 font-bold border border-slate-100/50 dark:border-slate-800/50">
                  <DynamicIcon icon={icons?.ui_camera} fallback="📷" width={24} height={24} className="mb-2 opacity-20" />
                  لا توجد صورة حالياً
                </div>
              )}
              <input type="file" name="doorPhoto" accept="image/*" className="text-[10px] file:ml-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer transition-all dark:text-slate-300" />
            </div>
          </div>
        </div>
      </div>

      {state.error && <p className="mt-4 text-[10px] text-rose-600 font-bold p-3 bg-rose-50/80 dark:bg-rose-900/20 rounded-2xl border border-rose-200/50 dark:border-rose-800/50 backdrop-blur-sm animate-shake">⚠️ {state.error}</p>}

      <div className="mt-6">
        <button
          type="submit"
          disabled={pending}
          className="group relative w-full overflow-hidden rounded-[1.5rem] bg-gradient-to-r from-emerald-600 to-teal-700 py-4 text-xs font-black text-white shadow-xl shadow-emerald-200 dark:shadow-none active:scale-95 transition-all"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <span className="relative flex items-center justify-center gap-2">
            {pending ? "جارٍ الإرسال..." : <><DynamicIcon icon={icons?.ui_success} fallback="✅" width={16} height={16} /> موافقة وإرسال للمندوب 🚀</>}
          </span>
        </button>
      </div>
    </form>
  );
}

function DraftAutoCourierPanel({
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
  const [state, formAction, pending] = useActionState(bound, {} as AssignOrderState);
  const [selectedCourierId, setSelectedCourierId] = useState(currentCourierId || "");
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state.ok) onSuccess?.();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className="relative overflow-hidden rounded-[2rem] border border-indigo-200/50 dark:border-indigo-900/30 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 space-y-3 animate-in fade-in zoom-in-95 shadow-xl ring-1 ring-white/20 dark:ring-white/10" dir="rtl">
      <div className="absolute -left-10 -top-10 h-24 w-24 rounded-full bg-indigo-400/10 blur-2xl" />

      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="courierId" value={selectedCourierId} />

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-black text-indigo-950 dark:text-indigo-100 flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
             <DynamicIcon icon={icons?.ui_package} fallback="📦" width={14} height={14} />
          </div>
          التحويل التلقائي للمندوب
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          key="none"
          type="button"
          disabled={pending}
          onClick={() => {
            setSelectedCourierId("");
            setTimeout(() => formRef.current?.requestSubmit(), 0);
          }}
          className={`relative group px-4 py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 ${
            selectedCourierId === ""
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 ring-2 ring-white/50"
              : "bg-white/50 dark:bg-slate-800/50 text-indigo-800 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50 hover:bg-white dark:hover:bg-slate-800"
          }`}
        >
          {selectedCourierId === "" && <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />}
          إلغاء التحويل
        </button>
        {couriers.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={pending}
            onClick={() => {
              setSelectedCourierId(c.id);
              setTimeout(() => formRef.current?.requestSubmit(), 0);
            }}
            className={`relative group px-4 py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 ${
              selectedCourierId === c.id
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 ring-2 ring-white/50"
                : "bg-white/50 dark:bg-slate-800/50 text-indigo-800 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50 hover:bg-white dark:hover:bg-slate-800"
            }`}
          >
            {selectedCourierId === c.id && <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />}
            {c.name}
          </button>
        ))}
      </div>
      <button ref={formRef} type="submit" className="hidden" />
      {state.error ? <p className="text-[10px] font-bold text-rose-600 p-2 bg-rose-50/50 rounded-lg animate-shake">⚠️ {state.error}</p> : null}
    </form>
  );
}

function RejectButton({ orderId, icons }: { orderId: string, icons?: GlobalIconsConfig | null }) {
  const bound = rejectPendingOrder.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as RejectOrderState);
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <form action={formAction} className="flex items-center gap-1 animate-in slide-in-from-left-2 bg-rose-50 dark:bg-rose-900/30 p-1 rounded-xl border border-rose-200 dark:border-rose-800 shadow-lg shadow-rose-200/20 animate-shake">
        <input type="hidden" name="orderId" value={orderId} />
        <span className="text-[10px] font-black text-rose-700 dark:text-rose-300 px-1">تأكيد الرفض؟</span>
        <button type="submit" disabled={pending} className="bg-rose-600 text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-sm active:scale-90">نعم</button>
        <button type="button" onClick={() => setConfirm(false)} className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg text-[10px] font-black border border-slate-200 dark:border-slate-700">لا</button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30 px-3 py-1.5 text-[11px] font-black text-rose-700 dark:text-rose-400 hover:bg-rose-600 dark:hover:bg-rose-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
    >
      <DynamicIcon icon={icons?.ui_close} fallback="✕" width={12} height={12} />
      رفض
    </button>
  );
}

function RejectDraftButton({ draftId, icons }: { draftId: string, icons?: GlobalIconsConfig | null }) {
  const bound = rejectPreparerDraft.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as RejectOrderState);
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <form action={formAction} className="flex items-center gap-1 animate-in slide-in-from-left-2 bg-rose-50 dark:bg-rose-900/30 p-1 rounded-xl border border-rose-200 dark:border-rose-800 shadow-lg shadow-rose-200/20 animate-shake">
        <input type="hidden" name="draftId" value={draftId} />
        <span className="text-[10px] font-black text-rose-700 dark:text-rose-300 px-1">رفض المسودة؟</span>
        <button type="submit" disabled={pending} className="bg-rose-600 text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-sm active:scale-90">نعم</button>
        <button type="button" onClick={() => setConfirm(false)} className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg text-[10px] font-black border border-slate-200 dark:border-slate-700">لا</button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30 px-3 py-1.5 text-[11px] font-black text-rose-700 dark:text-rose-400 hover:bg-rose-600 dark:hover:bg-rose-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
    >
      <DynamicIcon icon={icons?.ui_close} fallback="✕" width={12} height={12} />
      رفض المسودة
    </button>
  );
}

export function PendingOrdersClient({
  orders,
  couriers,
  shops = [],
  preparers = [],
  initialAssignOrderId,
  isDraftMode,
  icons: initialIcons,
}: {
  orders: PendingOrderRow[];
  couriers: { id: string; name: string }[];
  shops?: { id: string; name: string }[];
  preparers?: { id: string; name: string }[];
  initialAssignOrderId?: string | null;
  isDraftMode?: boolean;
  icons?: GlobalIconsConfig | null;
}) {
  const router = useRouter();
  const [assignOpenId, setAssignOpenId] = useState<string | null>(() => (initialAssignOrderId && orders.some((o) => o.id === initialAssignOrderId)) ? initialAssignOrderId : null);
  const [draftPreparerOpenId, setDraftPreparerOpenId] = useState<string | null>(null);
  const [draftCourierOpenId, setDraftCourierOpenId] = useState<string | null>(null);
  const [prepOpenId, setPrepOpenId] = useState<string | null>(null);
  const [pricingOpenId, setPricingOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(initialIcons || null);

  const pricingModalOrder = useMemo(() => {
    if (!pricingOpenId) return null;
    return orders.find((o) => o.id === pricingOpenId) ?? null;
  }, [pricingOpenId, orders]);

  useEffect(() => {
    if (!initialIcons) {
      getGlobalIcons().then(setIcons);
    }
  }, [initialIcons]);

  const [bulkState, bulkAction, bulkPending] = useActionState(bulkUpdateOrdersStatus, {} as BulkOrdersState);
  const [targetStatus, setTargetStatus] = useState<string>("pending");
  const [courierId, setCourierId] = useState<string>("");

  const buildWhatsAppLink = (rawPhone: string) => {
    const digitsOnly = (rawPhone || "").replace(/\D/g, "");
    if (!digitsOnly) return null;
    if (digitsOnly.startsWith("964")) return `https://wa.me/${digitsOnly}`;
    if (digitsOnly.startsWith("0")) return `https://wa.me/964${digitsOnly.slice(1)}`;
    return `https://wa.me/${digitsOnly}`;
  };

  const toggleOne = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected(prev => (prev.size > 0 && orders.every((o) => prev.has(o.id))) ? new Set() : new Set(orders.map((o) => o.id)));

  useEffect(() => { if (bulkState.ok) setSelected(new Set()); }, [bulkState.ok]);
  useEffect(() => {
    if (targetStatus !== "assigned" && targetStatus !== "delivering" && targetStatus !== "delivered") {
      setCourierId("");
    }
  }, [targetStatus]);

  return (
    <div className="space-y-2 text-right" dir="rtl">
      {orders.length > 0 && !isDraftMode && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-sky-200 dark:border-sky-900/50 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer text-slate-700 dark:text-slate-300"><input type="checkbox" onChange={toggleAll} className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" /> تحديد الكل</label>
          {selected.size > 0 && <span className="text-[10px] font-black bg-sky-100 dark:bg-sky-900 text-sky-900 dark:text-sky-100 px-3 py-1 rounded-full border border-sky-200 dark:border-sky-800">تم اختيار {selected.size} طلب</span>}
        </div>
      )}

      {selected.size > 0 && (
        <div className="p-3 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-sky-200 dark:border-sky-800/50 rounded-2xl animate-in slide-in-from-top-2 duration-300 shadow-lg ring-1 ring-white/20 dark:ring-white/10">
          <form action={bulkAction} className="flex flex-wrap items-end gap-2">
            {Array.from(selected).map(id => <input key={id} type="hidden" name="orderIds" value={id} />)}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 pr-1">الإجراء</span>
              <select
                name="targetStatus"
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="rounded-xl border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs font-black outline-none text-slate-900 dark:text-slate-100"
              >
                <option value="pending">قيد الانتظار</option>
                <option value="assigned">مسند</option>
                <option value="delivering">قيد التوصيل</option>
                <option value="delivered">مسلم</option>
              </select>
            </div>
            {(targetStatus === "assigned" || targetStatus === "delivering" || targetStatus === "delivered") && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 pr-1">اختر المندوب</span>
                <select
                  name="courierId"
                  value={courierId}
                  onChange={(e) => setCourierId(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs font-black outline-none text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- اختر مندوباً --</option>
                  {couriers.map((courier) => (
                    <option key={courier.id} value={courier.id}>{courier.name}</option>
                  ))}
                </select>
              </div>
            )}
            {(targetStatus === "assigned" || targetStatus === "delivering" || targetStatus === "delivered") && (
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-sky-200 dark:border-sky-900/50">
                <input type="checkbox" id="bulk-direct-admin" name="directReceipt" className="h-4 w-4 rounded border-sky-400 dark:border-sky-700" />
                <label htmlFor="bulk-direct-admin" className="text-[10px] font-black text-sky-950 dark:text-sky-100 cursor-pointer select-none">استلام مباشر للمندوب ⚡</label>
              </div>
            )}
            <button type="submit" disabled={bulkPending || ((targetStatus === "assigned" || targetStatus === "delivering" || targetStatus === "delivered") && !courierId)} className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-95">
              تطبيق الإجراء
            </button>
          </form>
          {bulkState.error ? <p className="mt-2 text-xs font-bold text-rose-600">⚠️ {bulkState.error}</p> : null}
        </div>
      )}

      {orders.map((o) => {
        // في تبويب "قيد التجهيز" نخلي شكل الإدارة قريب من شكل "تجهيز الطلب" عند المجهز:
        // كارت مرتب + زر كبير يفتح نافذة التسعير (Modal) فقط.
        if (isDraftMode) {
          const open = pricingOpenId === o.id;
          const customerPhone = o.customerPhone?.trim() || "—";
          const waLink = buildWhatsAppLink(customerPhone);
          const telDigits = customerPhone.replace(/\D/g, "");
          const telLink = telDigits ? `tel:${telDigits}` : null;
          const draftPreparerOpen = draftPreparerOpenId === o.id;
          const draftCourierOpen = draftCourierOpenId === o.id;
          const currentAutoCourierId = String(o.preparerShoppingJson?.autoCourierId ?? "").trim() || null;
          const currentAutoCourierName = String(o.preparerShoppingJson?.autoCourierName ?? "").trim() || null;
          return (
            <div key={o.id} className="group relative">
              <div
                className={`relative rounded-[2.5rem] border transition-all duration-500 cursor-pointer ${
                  open
                  ? "border-violet-400 bg-white dark:bg-slate-900 shadow-[0_30px_60px_rgba(139,92,246,0.15)] ring-2 ring-violet-200 dark:ring-violet-900/50"
                  : "border-white/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:border-violet-200 dark:hover:border-violet-800 ring-1 ring-white/20 dark:ring-white/10"
                }`}
                onClick={() => setPricingOpenId(o.id)}
              >
                {/* Visual Flair */}
                <div className="absolute -left-10 -top-10 h-24 w-24 rounded-full bg-violet-400/5 dark:bg-violet-900/5 blur-2xl group-hover:bg-violet-400/10 transition-colors" />

                <div className="relative p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-200 dark:shadow-none">
                           <DynamicIcon icon={icons?.store_cart} fallback="🛒" width={20} height={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded-full border border-violet-100 dark:border-violet-800/50">مسودة</span>
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 tabular-nums">#{o.orderNumber > 0 ? o.orderNumber : "—"}</span>
                          </div>
                          <p className="font-black text-slate-900 dark:text-slate-100 text-base leading-tight mt-0.5">
                            {o.orderType || o.shopName || "تجهيز خارجي"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="h-9 w-9 flex items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                          <DynamicIcon icon={icons?.ui_whatsapp} fallback="WA" width={16} height={16} />
                        </a>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setPricingOpenId(o.id); }} className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-black shadow-lg shadow-slate-200 dark:shadow-none hover:scale-105 active:scale-95 transition-all border border-white/10">
                        تعديل و تسعير
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100/50 dark:border-amber-900/30">
                       <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                         <DynamicIcon icon={icons?.ui_user} fallback="👤" width={10} height={10} /> المجهز الحالي
                       </p>
                       <p className="text-sm font-black text-amber-900 dark:text-amber-100 truncate">{o.submittedByName || "غير محدد"}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-sky-50/50 dark:bg-sky-900/10 border border-sky-100/50 dark:border-sky-900/30">
                       <p className="text-[9px] font-black text-sky-600 dark:text-sky-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                         <DynamicIcon icon={icons?.ui_location} fallback="📍" width={10} height={10} /> المنطقة
                       </p>
                       <p className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">{o.regionName}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                       <div className="h-8 px-3 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-[10px] font-black flex items-center justify-center border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm">
                         {customerPhone}
                       </div>
                       <RejectDraftButton draftId={o.id} icons={icons} />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDraftPreparerOpenId(draftPreparerOpen ? null : o.id); }}
                        className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all ${draftPreparerOpen ? "bg-sky-500 text-white shadow-lg shadow-sky-200 dark:shadow-none" : "bg-white dark:bg-slate-800 text-sky-500 border border-sky-100 dark:border-sky-900/50"}`}
                      >
                        <DynamicIcon icon={icons?.ui_shop} fallback="🏢" width={16} height={16} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDraftCourierOpenId(draftCourierOpen ? null : o.id); }}
                        className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all ${draftCourierOpen ? "bg-indigo-500 text-white shadow-lg shadow-indigo-200 dark:shadow-none" : "bg-white dark:bg-slate-800 text-indigo-500 border border-indigo-100 dark:border-indigo-900/50"}`}
                      >
                        <DynamicIcon icon={icons?.ui_package} fallback="📦" width={16} height={16} />
                      </button>
                    </div>
                  </div>

                  {currentAutoCourierName && (
                    <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 p-[1px] shadow-lg shadow-indigo-100 dark:shadow-none">
                      <div className="bg-white/10 dark:bg-slate-900/40 backdrop-blur-md px-4 py-3 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                               <DynamicIcon icon={icons?.ui_flash} fallback="⚡" width={14} height={14} className="text-white" />
                            </div>
                            <span className="text-[10px] font-black text-white/90">محول تلقائياً إلى:</span>
                         </div>
                         <span className="text-sm font-black text-white drop-shadow-sm">{currentAutoCourierName}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Expansion Panels */}
              <div className="mt-2 space-y-2 px-4">
                {draftPreparerOpen && (
                  <div className="animate-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                    <AssignToPreparerPanel
                      orderId={o.id}
                      preparers={preparers}
                      isDraft
                      initialPreparerIds={o.assignedPreparerIds}
                      onSuccess={() => { setDraftPreparerOpenId(null); router.refresh(); }}
                      icons={icons || undefined}
                    />
                  </div>
                )}

                {draftCourierOpen && (
                  <div className="animate-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                    <DraftAutoCourierPanel
                      draftId={o.id}
                      couriers={couriers}
                      currentCourierId={currentAutoCourierId}
                      currentCourierName={currentAutoCourierName}
                      onSuccess={() => { setDraftCourierOpenId(null); router.refresh(); }}
                      icons={icons}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        }

        const pricingOpen = pricingOpenId === o.id;
        const assignOpen = assignOpenId === o.id;
        return (
          <div
            key={o.id}
            className={`group relative rounded-[2.5rem] border transition-all duration-500 ${
              pricingOpen
              ? "border-amber-400 bg-white dark:bg-slate-900 shadow-[0_30px_60px_rgba(245,158,11,0.15)] ring-2 ring-amber-200 dark:ring-amber-900/50"
              : assignOpen
              ? "border-emerald-400 bg-white dark:bg-slate-900 shadow-[0_30px_60px_rgba(16,185,129,0.15)] ring-2 ring-emerald-200 dark:ring-emerald-900/50"
              : "border-white/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:border-sky-200 dark:hover:border-sky-800 ring-1 ring-white/20 dark:ring-white/10"
            }`}
          >
            {/* Background Decor */}
            <div className={`absolute -left-10 -top-10 h-24 w-24 rounded-full blur-2xl transition-colors ${pricingOpen ? "bg-amber-400/10" : assignOpen ? "bg-emerald-400/10" : "bg-sky-400/5"}`} />

            <div
              className={`relative flex flex-col sm:flex-row gap-4 p-5 cursor-pointer ${pricingOpen || assignOpen ? "" : "hover:bg-white/40 dark:hover:bg-white/5"}`}
              onClick={() => router.push(`${SECRET_ADMIN_PATH}/orders/${o.id}`)}
            >
              <div className="flex sm:flex-col gap-2 border-slate-100 dark:border-slate-800 sm:border-e sm:pe-4" onClick={e => e.stopPropagation()}>
                <label className="h-11 w-11 flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm cursor-pointer transition-all hover:scale-105 active:scale-95">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 bg-white dark:bg-slate-900" />
                </label>
                <button
                  type="button"
                  onClick={() => { setPricingOpenId(pricingOpen ? null : o.id); setAssignOpenId(null); setPrepOpenId(null); }}
                  className={`h-11 w-11 flex items-center justify-center rounded-2xl border shadow-lg transition-all hover:scale-110 active:scale-90 ${pricingOpen ? "bg-amber-500 text-white border-amber-600 shadow-amber-200 dark:shadow-none" : "bg-white dark:bg-slate-800 text-amber-500 border-amber-100 dark:border-amber-900/50"}`}
                >
                  <DynamicIcon icon={icons?.admin_pricing} fallback="💰" width={22} height={22} />
                </button>
                <button
                  type="button"
                  onClick={() => { setAssignOpenId(assignOpen ? null : o.id); setPricingOpenId(null); setPrepOpenId(null); }}
                  className={`h-11 w-11 flex items-center justify-center rounded-2xl border shadow-lg transition-all hover:scale-110 active:scale-90 ${assignOpen ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-200 dark:shadow-none" : "bg-white dark:bg-slate-800 text-emerald-500 border-emerald-100 dark:border-emerald-900/50"}`}
                >
                  <CheckIcon icons={icons} />
                </button>
              </div>

              <div className="flex-1 text-right space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                       <span className="bg-slate-900 dark:bg-slate-800 text-white px-2.5 py-0.5 rounded-full font-black text-[10px] tabular-nums shadow-sm border border-white/10">#{o.orderNumber}</span>
                       {o.submissionLabel === "طلب متجر" && (
                         <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-black text-[9px] border border-amber-200 dark:border-amber-800/50 flex items-center gap-1 shadow-sm">
                           <DynamicIcon icon={icons?.store_cart} fallback="🛒" width={10} height={10} /> متجر
                         </span>
                       )}
                    </div>
                    <p className="font-black text-slate-900 dark:text-slate-100 text-lg leading-tight mt-1">
                      {o.shopCustomerLabel || o.shopName?.trim() || "—"}
                      {o.vehiclePreference === "bike" && <span className="mr-2 text-indigo-500" title="طلب دراجة">🏍️</span>}
                      {o.vehiclePreference === "car" && <span className="mr-2 text-indigo-500" title="طلب سيارة">🚗</span>}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 px-3 py-1 rounded-xl text-[10px] font-black border border-sky-100 dark:border-sky-800/50">{o.regionName}</span>
                  <span className="bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-xl text-[10px] font-black border border-slate-100 dark:border-slate-700/50">{o.orderType}</span>
                  {o.totalAmount != null && <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-xl border border-emerald-100 dark:border-emerald-800/50 font-black text-[10px] tabular-nums">{o.totalAmount}</span>}
                </div>

                {(o.voiceNoteUrl || o.adminVoiceNoteUrl) && (
                  <div className="pt-2 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                    {o.voiceNoteUrl && (
                      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md p-2 rounded-2xl border border-sky-100 dark:border-sky-900/50 shadow-sm">
                        <p className="text-[9px] font-black text-sky-600 dark:text-sky-400 mb-1 flex items-center gap-1">
                          <DynamicIcon icon={icons?.ui_audio} fallback="🎤" width={12} height={12} /> بصمة الزبون
                        </p>
                        <VoiceNoteAudio src={resolvePublicAssetSrc(o.voiceNoteUrl) || ""} />
                      </div>
                    )}
                    {o.adminVoiceNoteUrl && (
                      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md p-2 rounded-2xl border border-amber-100 dark:border-amber-900/50 shadow-sm">
                        <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                          <DynamicIcon icon={icons?.ui_audio} fallback="🎧" width={12} height={12} /> ملاحظة الإدارة
                        </p>
                        <VoiceNoteAudio src={resolvePublicAssetSrc(o.adminVoiceNoteUrl) || ""} />
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 opacity-70">{o.customerOrderTime}</p>
              </div>

              <div className="flex items-start justify-end" onClick={(e) => e.stopPropagation()}>
                <RejectButton orderId={o.id} icons={icons} />
              </div>
            </div>

            {pricingOpen && (
              <div className="relative z-10 p-4 border-t border-amber-100 dark:border-amber-900/50 bg-amber-50/10 dark:bg-amber-900/5 animate-in slide-in-from-top-4 duration-500" onClick={e => e.stopPropagation()}>
                <AdminPricingPanel
                  orderId={o.id}
                  initialData={o.preparerShoppingJson}
                  isDraft={isDraftMode}
                  initialPreparerIds={o.assignedPreparerIds}
                  orderSummary={o.summary}
                  shops={shops}
                  preparers={preparers}
                  rawDeliveryPriceDinar={o.rawDeliveryPriceDinar}
                  onSuccess={() => { setPricingOpenId(null); isDraftMode && router.refresh(); }}
                  icons={icons}
                  extraActions={<RejectButton orderId={o.id} icons={icons} />}
                  hideContainer={true}
                />
              </div>
            )}

            {assignOpen && (
              <div className="relative z-10 p-4 border-t border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/10 dark:bg-emerald-900/5 animate-in slide-in-from-top-4 duration-500" onClick={e => e.stopPropagation()}>
                <PendingAssignPanel
                  orderId={o.id}
                  couriers={couriers}
                  customerPhone={o.customerPhone}
                  customerAlternatePhone={o.customerAlternatePhone}
                  defaultCustomerLocationUrl={o.customerLocationUrl}
                  defaultCustomerLandmark={o.customerLandmark}
                  defaultCustomerDoorPhotoUrl={o.customerDoorPhotoUrl}
                  icons={icons}
                  onSuccess={() => { setAssignOpenId(null); router.refresh(); }}
                  hideContainer={true}
                />
              </div>
            )}
          </div>
        );
      })}

      {isDraftMode && pricingModalOrder ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/80 dark:bg-black/90 p-2 sm:p-6 backdrop-blur-xl"
          onClick={() => setPricingOpenId(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-300 bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl rounded-[3rem] border border-white/40 dark:border-slate-700/50 shadow-[0_30px_70px_rgba(0,0,0,0.3)] overflow-hidden ring-1 ring-white/20 dark:ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shrink-0">
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-none">
                     <DynamicIcon icon={icons?.admin_pricing} fallback="💰" width={26} height={26} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100">نافذة التسعير الإدارية</h3>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">#{pricingModalOrder.orderNumber}</span>
                      {pricingModalOrder.orderType || "مسودة"}
                    </p>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                 <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-100 dark:border-amber-900/50">
                    <DynamicIcon icon={icons?.ui_flash} fallback="⚡" width={20} height={20} />
                 </div>
               </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30 dark:bg-black/10">
              <AdminPricingPanel
                orderId={pricingModalOrder.id}
                initialData={pricingModalOrder.preparerShoppingJson}
                isDraft={true}
                initialPreparerIds={pricingModalOrder.assignedPreparerIds}
                orderSummary={pricingModalOrder.summary}
                shops={shops}
                preparers={preparers}
                rawDeliveryPriceDinar={pricingModalOrder.rawDeliveryPriceDinar}
                onSuccess={() => {
                  setPricingOpenId(null);
                  router.refresh();
                }}
                icons={icons}
                hideContainer={true}
              />
            </div>

            {/* Modal Footer - New Action Bar */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center justify-between gap-3">
               <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPricingOpenId(null)}
                    className="h-12 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <DynamicIcon icon={icons?.ui_close} fallback="✕" width={16} height={16} />
                    إغلاق النافذة
                  </button>
                  <RejectDraftButton draftId={pricingModalOrder.id} icons={icons} />
               </div>

               <div className="flex items-center gap-2">
                  <DeleteFullOrderButton id={pricingModalOrder.id} isDraft={true} onSuccess={() => { setPricingOpenId(null); router.refresh(); }} icons={icons} />
               </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}