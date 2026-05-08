"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useMemo, useRef } from "react";
import {
  assignPendingOrderToCourier,
  assignOrderToPreparer,
  setDraftAutoCourier,
  reassignOrderToPreparer,
  deleteOrderPermanently,
  rejectPendingOrder,
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
    <form action={formAction} className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4 shadow-inner text-right" dir="rtl">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="isDraft" value={String(!!isDraft)} />
      {selectedPreparers.map(id => <input key={id} type="hidden" name="preparerIds" value={id} />)}
      <p className="text-sm font-black text-sky-900 border-b border-sky-100 pb-2 flex items-center gap-2">
        <DynamicIcon icon={icons?.ui_shop} fallback="🛒" width={16} height={16} /> إسناد الطلب للمجهزين
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
        {preparers.map((p) => (
          <label key={p.id} className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all cursor-pointer ${selectedPreparers.includes(p.id) ? "border-sky-600 bg-sky-100 shadow-sm" : "border-white bg-white/50 hover:border-sky-200"}`}>
            <input type="checkbox" checked={selectedPreparers.includes(p.id)} onChange={() => togglePreparer(p.id)} className="h-5 w-5 rounded border-sky-300 text-sky-600 focus:ring-sky-500" />
            <span className={`text-xs font-black ${selectedPreparers.includes(p.id) ? "text-sky-900" : "text-slate-600"}`}>{p.name}</span>
          </label>
        ))}
      </div>
      {state.error && <p className="text-xs text-rose-600 font-bold p-2 bg-rose-50 rounded-lg border border-rose-200">{state.error}</p>}
      <button type="submit" disabled={pending || selectedPreparers.length === 0} className="w-full rounded-xl bg-sky-600 py-3.5 text-sm font-black text-white shadow-lg active:scale-95 disabled:opacity-50 transition-all hover:bg-sky-700 flex items-center justify-center gap-2">
        {pending ? "جارٍ الإسناد..." : (
          <>
            <DynamicIcon icon={icons?.ui_success} fallback="✅" width={14} height={14} />
            {initialPreparerIds.length > 0 ? "تحديث المجهزين" : `إسناد إلى ${selectedPreparers.length} مجهز`}
          </>
        )}
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
      <form action={formAction} className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 bg-rose-50 p-1 px-2 rounded-xl border border-rose-200 shadow-sm">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="isDraft" value={String(isDraft)} />
        <span className="text-[10px] font-black text-rose-700">حذف نهائي؟</span>
        <button type="submit" disabled={pending} className="bg-rose-600 text-white px-3 py-1 rounded-lg text-[10px] font-black shadow-sm active:scale-90">نعم</button>
        <button type="button" onClick={() => setConfirm(false)} className="bg-white text-slate-700 px-3 py-1 rounded-lg text-[10px] font-black border border-slate-200">لا</button>
      </form>
    );
  }
  return (
    <button type="button" onClick={() => setConfirm(true)} className="flex items-center gap-1 text-rose-600 hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-xl border-2 border-rose-600 transition-all text-[11px] font-black bg-white shadow-sm active:scale-95">
      <DynamicIcon icon={icons?.ui_delete} fallback="🗑️" width={12} height={12} /> مسح الطلب
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
    if (rawDeliveryPriceDinar != null) return rawDeliveryPriceDinar / 1000;
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
        const res = await fetch(`/api/store/products?ids=${encodeURIComponent(productIds.join(","))}`);
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
    <div className="space-y-4 rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-5 shadow-xl text-right" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-black text-amber-900 flex items-center gap-2 ml-2">
            <span className="text-xl">
              <DynamicIcon icon={icons?.admin_pricing} fallback="💰" />
            </span> {isDraft ? "تجهيز وتسعير المسودة" : "تعديل تسعير الطلب"}
            {isSaving && <span className="text-[9px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded animate-pulse">جاري الحفظ التلقائي...</span>}
          </p>
          <DeleteFullOrderButton id={orderId} isDraft={Boolean(isDraft)} onSuccess={onSuccess} icons={icons} />
        </div>
        <div className="flex gap-2">
        <button type="button" onClick={() => setShowReassign(!showReassign)} className="rounded-xl bg-slate-800 text-white px-3 py-1.5 text-[10px] font-black shadow-sm transition hover:bg-black flex items-center gap-1">
          <DynamicIcon icon={icons?.ui_plus} fallback={isDraft ? "➕" : "🔄"} width={10} height={10} />
          {isDraft ? "إضافة مجهز" : "تغيير المجهز"}
        </button>
        <button type="button" onClick={() => setShowBulkAdd(!showBulkAdd)} className="rounded-xl bg-violet-600 text-white px-3 py-1.5 text-[10px] font-black shadow-sm transition active:scale-95 flex items-center gap-1">
          <DynamicIcon icon={icons?.ui_plus} fallback="➕" width={10} height={10} /> قائمة كاملة
        </button>
        <button type="button" onClick={() => { setDeleteMode(!deleteMode); setEditingIndex(null); }} className={`rounded-xl px-3 py-1.5 text-[10px] font-black shadow-sm transition flex items-center gap-1 ${deleteMode ? "bg-rose-600 text-white" : "bg-white border border-rose-300 text-rose-700"}`}>
          <DynamicIcon icon={icons?.ui_delete} fallback="🗑️" width={10} height={10} />
          {deleteMode ? "إلغاء الحذف" : "مسح أسطر"}
        </button>
      </div>
      </div>

      {showReassign && <div className="animate-in slide-in-from-top-2"><AssignToPreparerPanel orderId={orderId} preparers={preparers} isDraft={isDraft} initialPreparerIds={initialPreparerIds} onSuccess={() => { setShowReassign(false); onSuccess?.(); }} /></div>}

      {showBulkAdd && (
        <div className="bg-white p-3 rounded-xl border-2 border-violet-200 animate-in zoom-in-95 shadow-inner">
          <p className="text-[10px] font-bold text-violet-900 mb-2">أدخل المنتجات الجديدة (سطر لكل منتج):</p>
          <textarea className="w-full rounded-lg border border-slate-200 p-2 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-violet-300 font-bold" placeholder="لحم شرح 1ك&#10;خيار 2 كيلو" onBlur={(e) => {
              const lines = e.target.value.split("\n").map(l => l.trim()).filter(l => l.length > 1);
              if (lines.length) { setProducts([...products, ...lines.map(line => ({ line, buyAlf: "0", sellAlf: "0", pricedBy: null, assignedPreparerId: null, assignedPreparerName: null }))]); setShowBulkAdd(false); }
              e.target.value = "";
            }} />
        </div>
      )}

      {products.length > 0 && (
        <div className="mb-3 rounded-2xl bg-slate-50 border border-slate-200 p-3 animate-in fade-in duration-200">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-slate-900">اختر اسم المجهز لتعيين المنتجات المحددة</p>
              <p className="text-[10px] text-slate-500">
                {selectedProductIndexes.length > 0
                  ? `تم اختيار ${selectedProductIndexes.length} منتج${selectedProductIndexes.length === 1 ? "" : "ات"}.`
                  : "اضغط على مربعات الاختيار الموجودة بجانب المنتجات لتفعيل التعيين."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={clearSelection} className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-200">
                مسح التحديد
              </button>
              <button type="button" onClick={toggleSelectAllProducts} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-50">
                {selectedProductIndexes.length === products.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={productAssigneeId} onChange={(e) => setProductAssigneeId(e.target.value)} className="min-w-[14rem] rounded-xl border border-slate-200 bg-white p-2 text-xs font-black outline-none">
              <option value="">اختر المجهز</option>
              {preparers.map((prep) => (
                <option key={prep.id} value={prep.id}>{prep.name}</option>
              ))}
            </select>
            <button type="button" onClick={assignSelectedProductsToPreparer} disabled={!productAssigneeId || selectedProductIndexes.length === 0} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm disabled:opacity-40">
              ✅ إسناد المنتجات المحددة
            </button>
          </div>
        </div>
      )}





      <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-1">
        {products.map((p, i) => {
          const isEditing = editingIndex === i;
          const priced = parseFloat(normalizeNumerals((p?.buyAlf ?? "0").toString())) > 0;
          const isSelected = selectedProductIndexes.includes(i);
          return (
            <div key={i} className={isSelected ? "ring-2 ring-sky-400 rounded-2xl" : ""}>
              <div className="flex gap-3">
                <label className="flex items-center">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleProductSelection(i)} className="h-4 w-4 rounded border-slate-300" />
                </label>
                <div
                  className={`flex-1 flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${deleteMode ? "border-rose-300 bg-rose-50" : priced ? "border-emerald-800 bg-emerald-900 text-white" : "border-slate-200 bg-white hover:border-amber-400 shadow-sm"}`}
                  onClick={() => {
                    if (!deleteMode) {
                      setEditingIndex(isEditing ? null : i);
                    }
                  }}
                >
                  <div className="flex flex-1 items-center gap-3">
                    {p?.productId && productPhotoById[p.productId] ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImageUrl(productPhotoById[p.productId]);
                          setPreviewZoom(1);
                        }}
                        className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shrink-0"
                        title="عرض الصورة بحجم أكبر"
                      >
                        <img
                          src={productPhotoById[p.productId]}
                          alt={p?.line || "صورة المنتج"}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : null}
                    <div className="flex-1">
                      <p className="text-xs font-black">{p?.line} {p?.pricedBy && ` (بواسطة: ${p.pricedBy})`}</p>
                    {findPreparerName(p?.assignedPreparerId) || p?.assignedPreparerName ? (
                      <p className="text-[10px] text-slate-500">مخصص لـ {findPreparerName(p?.assignedPreparerId) || p?.assignedPreparerName}</p>
                    ) : p?.supplierId ? (
                      <p className="text-[10px] text-orange-600 font-bold">المورد: {p?.supplierName || "مورد خارجي"}</p>
                    ) : (
                      <p className="text-[10px] text-slate-400">بدون تخصيص</p>
                    )}
                    {priced && <p className="text-[10px] text-emerald-300 font-mono">شراء: {p?.buyAlf} | بيع: {p?.sellAlf}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (deleteMode) {
                          setProducts(products.filter((_, idx) => idx !== i));
                        } else {
                          setEditingIndex(isEditing ? null : i);
                        }
                      }}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg px-2 text-sm transition-all"
                    >
                      {deleteMode ? <DynamicIcon icon={icons?.ui_close} fallback="❌" width={14} height={14} /> : priced ? <DynamicIcon icon={icons?.ui_success} fallback="✅" width={14} height={14} /> : <DynamicIcon icon={icons?.ui_settings} fallback="⚙️" width={14} height={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {isEditing && !deleteMode && (
                <div className="mt-2 bg-white p-4 rounded-xl border-2 border-amber-400 grid grid-cols-2 gap-3 shadow-inner animate-in slide-in-from-top-2">
                  <input type="text" value={p?.line} onChange={(e) => updateProduct(i, "line", e.target.value)} className="col-span-2 border-b-2 border-slate-100 p-1 text-sm font-black outline-none" />
                  <label className="flex flex-col"><span className="text-[10px] font-bold text-slate-400">شراء</span><input type="text" inputMode="decimal" value={p?.buyAlf ?? ""} onChange={(e) => updateProduct(i, "buyAlf", e.target.value)} className="rounded-lg border border-slate-200 p-2 text-sm font-black font-mono bg-slate-50 outline-none focus:ring-2 focus:ring-amber-200" autoFocus /></label>
                  <label className="flex flex-col"><span className="text-[10px] font-bold text-emerald-700">بيع</span><input type="text" inputMode="decimal" value={p?.sellAlf ?? ""} onChange={(e) => updateProduct(i, "sellAlf", e.target.value)} className="rounded-lg border-2 border-emerald-300 p-2 text-sm font-black font-mono bg-emerald-50 outline-none focus:ring-2 focus:ring-emerald-400" /></label>
                  <label className="col-span-2 flex flex-col gap-1"><span className="text-[10px] font-bold text-slate-400">تخصيص المجهز</span><select value={p?.assignedPreparerId ?? ""} onChange={(e) => updateProduct(i, "assignedPreparerId", e.target.value)} className="rounded-lg border border-slate-200 p-2 text-sm outline-none bg-slate-50">
                    <option value="">بدون تخصيص</option>
                    {preparers.map((prep) => (
                      <option key={prep.id} value={prep.id}>{prep.name}</option>
                    ))}
                  </select></label>
                  <label className="col-span-2 flex items-center gap-2 py-1"><input type="checkbox" checked={Boolean(p?.pricedBy === "الإدارة")} onChange={(e) => updateProduct(i, "pricedBy", e.target.checked)} className="h-4 w-4 rounded border-amber-400" /><span className="text-[10px] font-black text-amber-900">تم تجهيز هذا المنتج من قبلي (أنا)</span></label>
                  <button type="button" onClick={() => setEditingIndex(null)} className="col-span-2 bg-slate-800 text-white rounded-lg py-2 text-xs font-black active:scale-95 transition-transform shadow-md">حفظ السطر</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-amber-200 text-center shadow-inner">
        <div className="col-span-3 pb-2"><select value={placesCount} onChange={(e) => setPlacesCount(Number(e.target.value))} className="w-full rounded-lg border border-amber-200 p-2 text-xs font-black outline-none bg-amber-50/50">{[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} محلات</option>)}</select></div>
        <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100"><p className="text-[8px] font-bold text-emerald-600">المنتجات</p><p className="text-xs font-black font-mono">{totals.subtotal} </p></div>
        <div className="p-2 bg-sky-50 rounded-lg border border-sky-100"><p className="text-[8px] font-bold text-sky-600">توصيل</p><p className="text-xs font-black font-mono">{deliveryAlfVal > 0 ? deliveryAlfVal : "—"} </p></div>
        <div className="p-2 bg-violet-600 text-white rounded-lg shadow-md border border-violet-700"><p className="text-[8px] font-bold">المجموع</p><p className="text-sm font-black font-mono">{totals.total} </p></div>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="productsJson" value={JSON.stringify(products)} />
        <input type="hidden" name="placesCount" value={placesCount} />
        {isDraft && <input type="hidden" name="autoCourierId" value={String(initialData?.autoCourierId ?? "")} />}
        {isDraft && <input type="hidden" name="shopId" value={selectedShopId} />}
        {isDraft && <input type="hidden" name="isDraft" value="true" />}
        <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-amber-200 shadow-sm"><input type="checkbox" id="skip-w" name="skipWallet" className="h-4 w-4 rounded border-emerald-400" /><label htmlFor="skip-w" className="text-[10px] font-black text-emerald-950 cursor-pointer">تجهيز إداري كامل (تخطي حساب المجهز)</label></div>
        {state.error && <p className="text-xs text-rose-600 font-bold p-2 bg-rose-50 border border-rose-200 rounded-lg animate-shake">⚠️ {state.error}</p>}

        {isDraft ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="submit" name="submitType" value="admin_approve" disabled={pending || !selectedShopId} className="w-full rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-900 py-4 text-[11px] font-black text-white shadow-xl active:scale-[0.98] transition-all border-b-4 border-emerald-950 flex items-center justify-center gap-2">
              {pending ? "جارٍ الحفظ..." : (
                <>
                  <DynamicIcon icon={icons?.ui_success} fallback="✅" width={14} height={14} /> اعتماد المسودة لطلب إداري
                </>
              )}
            </button>
            <button type="submit" name="submitType" value="final_send" disabled={pending || !canSubmitFinal} className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-violet-800 py-4 text-[11px] font-black text-white shadow-xl active:scale-[0.98] transition-all border-b-4 border-violet-950 flex items-center justify-center gap-2">
              {pending ? "جارٍ الإرسال..." : (
                <>
                  <DynamicIcon icon={icons?.ui_rocket} fallback="🚀" width={14} height={14} /> إرسال الطلب النهائي للنظام
                </>
              )}
            </button>
          </div>
        ) : (
          <button type="submit" disabled={pending} className="w-full rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-900 py-4 text-sm font-black text-white shadow-xl active:scale-[0.98] transition-all border-b-4 border-emerald-950 flex items-center justify-center gap-2">
            {pending ? "جارٍ معالجة البيانات..." : (
              <>
                <DynamicIcon icon={icons?.ui_success} fallback="✅" width={16} height={16} /> اعتماد التسعير والرفع للمندوب <DynamicIcon icon={icons?.ui_rocket} fallback="🚀" width={16} height={16} />
              </>
            )}
          </button>
        )}
      </form>

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
  icons
}: {
  orderId: string;
  couriers: { id: string; name: string }[];
  customerPhone: string;
  customerAlternatePhone: string;
  defaultCustomerLocationUrl: string;
  defaultCustomerLandmark: string;
  defaultCustomerDoorPhotoUrl: string;
  icons: GlobalIconsConfig | null;
}) {
  const bound = assignPendingOrderToCourier.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as AssignOrderState);
  if (couriers.length === 0) return <p className="p-3 bg-amber-50 text-amber-900 rounded-lg text-sm font-bold border border-amber-200 text-center flex items-center justify-center gap-2"><DynamicIcon icon={icons?.ui_warning} fallback="⚠️" width={16} height={16} /> لا يوجد مندوبون مسجلون.</p>;
  const inputClass = "w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono outline-none text-left bg-white focus:ring-2 focus:ring-emerald-300";
  const labelClass = "text-[11px] font-bold text-slate-500 mb-1 block pr-1";

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-inner text-right" dir="rtl">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
        <p className="text-sm font-black text-emerald-900 flex items-center gap-2">
          <DynamicIcon icon={icons?.ui_package} fallback="📦" width={16} height={16} /> إسناد فوري للمندوب
        </p>
        <span className="text-[10px] font-bold text-slate-500">الزبون: {customerPhone}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* العمود الأول: المندوب والخيارات */}
        <div className="space-y-3">
          <OrderStatusRadioGroup name="courierId" defaultValue="" required legend="اختر المندوب المتوفر" options={couriers.map((c) => ({ value: c.id, label: c.name }))} />

          <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-emerald-200 shadow-sm">
            <input type="checkbox" id="direct-receipt" name="directReceipt" className="h-4 w-4 rounded border-emerald-400" />
            <label htmlFor="direct-receipt" className="text-[11px] font-black text-emerald-950 cursor-pointer select-none flex items-center gap-1">
              استلام مباشر للمندوب (تخطي الموافقة) <DynamicIcon icon={icons?.ui_flash} fallback="⚡" width={12} height={12} />
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

        {/* العمود الثاني: اللوكيشن والصورة */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className={labelClass}>رابط اللوكيشن الرسمي (GPS)</label>
            <textarea name="customerLocationUrl" rows={3} defaultValue={defaultCustomerLocationUrl} className={inputClass} dir="ltr" placeholder="https://maps.app.goo.gl/..." />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>صورة باب الزبون</label>
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-emerald-300 bg-white p-3">
              {defaultCustomerDoorPhotoUrl ? (
                <div className="relative group aspect-video w-full overflow-hidden rounded-lg border border-emerald-100">
                  <img src={resolvePublicAssetSrc(defaultCustomerDoorPhotoUrl)!} alt="صورة الباب" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white font-bold">تغيير الصورة بالأسفل</p>
                  </div>
                </div>
              ) : (
                <div className="aspect-video w-full flex items-center justify-center bg-slate-50 rounded-lg text-[10px] text-slate-400 font-bold border border-slate-100">
                  لا توجد صورة حالياً
                </div>
              )}
              <input type="file" name="doorPhoto" accept="image/*" className="text-[10px] file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" />
            </div>
          </div>
        </div>
      </div>

      {state.error && <p className="text-xs text-rose-600 font-bold p-2 bg-rose-50 rounded-lg border border-rose-200">⚠️ {state.error}</p>}

      <div className="pt-2">
        <button type="submit" disabled={pending} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 py-4 text-sm font-black text-white shadow-xl active:scale-[0.98] transition-all border-b-4 border-emerald-950">
          {pending ? "جارٍ معالجة البيانات..." : "✅ موافقة وإرسال للمندوب 🚀"}
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
}: {
  draftId: string;
  couriers: { id: string; name: string }[];
  currentCourierId?: string | null;
  currentCourierName?: string | null;
  onSuccess?: () => void;
}) {
  const bound = setDraftAutoCourier.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as AssignOrderState);
  const [selectedCourierId, setSelectedCourierId] = useState(currentCourierId || "");
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state.ok) onSuccess?.();
  }, [state.ok, onSuccess]);

  return (
    <form ref={formRef} action={formAction} className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 space-y-2" dir="rtl">
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="courierId" value={selectedCourierId} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-indigo-900">اختيار المندوب للتحويل التلقائي عند الإرسال</p>
        {currentCourierName ? (
          <span className="rounded-md bg-indigo-100 px-2 py-1 text-[10px] font-black text-indigo-800">
            الحالي: {currentCourierName}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setSelectedCourierId("");
            setTimeout(() => formRef.current?.requestSubmit(), 0);
          }}
          className={`rounded-xl px-3 py-2 text-xs font-black border transition ${
            selectedCourierId === ""
              ? "bg-indigo-600 text-white border-indigo-700"
              : "bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-50"
          } disabled:opacity-50`}
        >
          بدون تحويل تلقائي
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
            className={`rounded-xl px-3 py-2 text-xs font-black border transition ${
              selectedCourierId === c.id
                ? "bg-indigo-600 text-white border-indigo-700"
                : "bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-50"
            } disabled:opacity-50`}
          >
            {c.name}
          </button>
        ))}
      </div>
      {state.error ? <p className="text-[11px] font-bold text-rose-600">{state.error}</p> : null}
    </form>
  );
}

function RejectButton({ orderId }: { orderId: string }) {
  const bound = rejectPendingOrder.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as RejectOrderState);
  return (
    <form action={formAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" disabled={pending} className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50">رفض</button>
    </form>
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
  const toggleAll = () => setSelected(prev => (selected.size > 0 && orders.every(selected.has.bind(selected))) ? new Set() : new Set(orders.map(o => o.id)));

  useEffect(() => { if (bulkState.ok) setSelected(new Set()); }, [bulkState.ok]);
  useEffect(() => {
    if (targetStatus !== "assigned" && targetStatus !== "delivering" && targetStatus !== "delivered") {
      setCourierId("");
    }
  }, [targetStatus]);

  return (
    <div className="space-y-2 text-right" dir="rtl">
      {orders.length > 0 && !isDraftMode && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 border border-sky-200 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer text-slate-700"><input type="checkbox" onChange={toggleAll} className="h-4 w-4 rounded" /> تحديد الكل</label>
          {selected.size > 0 && <span className="text-[10px] font-black bg-sky-100 text-sky-900 px-3 py-1 rounded-full border border-sky-200">تم اختيار {selected.size} طلب</span>}
        </div>
      )}

      {selected.size > 0 && (
        <div className="p-3 bg-white/70 border border-sky-200 rounded-2xl animate-in slide-in-from-top-2 shadow-sm">
          <form action={bulkAction} className="flex flex-wrap items-end gap-2">
            {Array.from(selected).map(id => <input key={id} type="hidden" name="orderIds" value={id} />)}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 pr-1">الإجراء</span>
              <select
                name="targetStatus"
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="rounded-xl border border-sky-200 p-2 text-xs font-black outline-none"
              >
                <option value="pending">قيد الانتظار</option>
                <option value="assigned">مسند</option>
                <option value="delivering">قيد التوصيل</option>
                <option value="delivered">مسلم</option>
              </select>
            </div>
            {(targetStatus === "assigned" || targetStatus === "delivering" || targetStatus === "delivered") && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 pr-1">اختر المندوب</span>
                <select
                  name="courierId"
                  value={courierId}
                  onChange={(e) => setCourierId(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2 text-xs font-black outline-none"
                >
                  <option value="">-- اختر مندوباً --</option>
                  {couriers.map((courier) => (
                    <option key={courier.id} value={courier.id}>{courier.name}</option>
                  ))}
                </select>
              </div>
            )}
            {(targetStatus === "assigned" || targetStatus === "delivering" || targetStatus === "delivered") && (
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-sky-200">
                <input type="checkbox" id="bulk-direct-admin" name="directReceipt" className="h-4 w-4 rounded border-sky-400" />
                <label htmlFor="bulk-direct-admin" className="text-[10px] font-black text-sky-950 cursor-pointer select-none">استلام مباشر للمندوب ⚡</label>
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
            <div key={o.id} className="space-y-2">
              <div
                className={`kse-glass-dark rounded-2xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer transition hover:border-violet-300 ${open ? "ring-2 ring-violet-300" : ""}`}
                onClick={() => setPricingOpenId(o.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-violet-100 text-violet-900 px-2 py-0.5 rounded-md font-black text-xs tabular-nums">
                        مسودة
                      </span>
                      <span className="bg-sky-100 text-sky-900 px-2 py-0.5 rounded-md font-black text-xs tabular-nums">
                        #{o.orderNumber > 0 ? o.orderNumber : "—"}
                      </span>
                      <p className="font-black text-slate-900 leading-snug line-clamp-1">
                        {o.orderType || o.shopName || "تجهيز"}
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-slate-600">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">{o.regionName}</span>
                      <span className="text-emerald-700">{o.shopCustomerLabel || o.shopName || "—"}</span>
                    </div>
                    <p className="mt-2 text-[10px] font-black text-slate-500 line-clamp-1">
                      المجهز: {o.submittedByName || "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-black text-emerald-800 border border-emerald-200">
                        رقم الزبون: {customerPhone}
                      </span>
                      {waLink ? (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-md bg-green-600 px-2.5 py-1 font-black text-white hover:bg-green-700"
                        >
                          واتساب
                        </a>
                      ) : null}
                      {telLink ? (
                        <a
                          href={telLink}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-md bg-sky-600 px-2.5 py-1 font-black text-white hover:bg-sky-700"
                        >
                          اتصال
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setDraftPreparerOpenId(draftPreparerOpen ? null : o.id)}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-sky-700"
                  >
                    تخصيص المجهزين
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftCourierOpenId(draftCourierOpen ? null : o.id)}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-indigo-700"
                  >
                    اختيار مندوب التحويل
                  </button>
                  {currentAutoCourierName ? (
                    <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700 border border-indigo-200">
                      التحويل التلقائي: {currentAutoCourierName}
                    </span>
                  ) : null}
                </div>
              </div>

              {draftPreparerOpen ? (
                <div className="px-2" onClick={(e) => e.stopPropagation()}>
                  <AssignToPreparerPanel
                    orderId={o.id}
                    preparers={preparers}
                    isDraft
                    initialPreparerIds={o.assignedPreparerIds}
                    onSuccess={() => {
                      setDraftPreparerOpenId(null);
                      router.refresh();
                    }}
                    icons={icons || undefined}
                  />
                </div>
              ) : null}

              {draftCourierOpen ? (
                <div className="px-2" onClick={(e) => e.stopPropagation()}>
                  <DraftAutoCourierPanel
                    draftId={o.id}
                    couriers={couriers}
                    currentCourierId={currentAutoCourierId}
                    currentCourierName={currentAutoCourierName}
                    onSuccess={() => {
                      setDraftCourierOpenId(null);
                      router.refresh();
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        }

        const pricingOpen = pricingOpenId === o.id;
        const assignOpen = assignOpenId === o.id;
        return (
          <div
            key={o.id}
            className={`overflow-hidden rounded-xl border transition-all duration-200 ${pricingOpen ? "ring-2 ring-amber-400 shadow-lg" : assignOpen ? "border-emerald-400 bg-emerald-50/20 shadow-md" : orderStatusPendingCardBorderBg()}`}
          >
            <div
              className={`flex flex-col sm:flex-row gap-3 p-3 cursor-pointer ${pricingOpen ? "bg-amber-50/20" : ""}`}
              onClick={() => router.push(`/admin/orders/${o.id}`)}
            >
              <div className="flex sm:flex-col gap-2 border-sky-100 sm:border-e sm:pe-2" onClick={e => e.stopPropagation()}>
                <label className="h-10 w-10 flex items-center justify-center rounded-xl border border-sky-200 bg-white/80 cursor-pointer shadow-sm">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} className="h-5 w-5 rounded border-sky-300" />
                </label>
                <button
                  type="button"
                  onClick={() => { setPricingOpenId(pricingOpen ? null : o.id); setAssignOpenId(null); setPrepOpenId(null); }}
                  className={`h-10 w-10 flex items-center justify-center rounded-xl border shadow-sm transition-all ${pricingOpen ? "bg-amber-600 text-white border-amber-700 ring-2 ring-amber-200" : "bg-white text-amber-600 border-amber-200 hover:bg-amber-50"}`}
                >
                  <DynamicIcon icon={icons?.admin_pricing} fallback="💰" width={18} height={18} />
                </button>
                <button
                  type="button"
                  onClick={() => { setAssignOpenId(assignOpen ? null : o.id); setPricingOpenId(null); setPrepOpenId(null); }}
                  className={`h-10 w-10 flex items-center justify-center rounded-xl border shadow-sm transition-all ${assignOpen ? "bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-200" : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"}`}
                >
                  <CheckIcon icons={icons} />
                </button>
              </div>

              <div className="flex-1 text-right space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-sky-100 text-sky-900 px-2 py-0.5 rounded-md font-black text-xs tabular-nums">{`#${o.orderNumber}`}</span>
                  {o.submissionLabel === "طلب متجر" && (
                    <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-black text-[10px] border border-amber-200 shadow-sm animate-pulse flex items-center gap-1">
                      <DynamicIcon icon={icons?.store_cart} fallback="🛒" width={12} height={12} /> طلب متجر
                    </span>
                  )}
                  <p className="font-black text-slate-900 leading-snug">{o.shopCustomerLabel || o.shopName?.trim() || "—"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-slate-600">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">{o.regionName}</span>
                  <span className="text-emerald-700">{o.orderType}</span>
                  {o.totalAmount != null && <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 tabular-nums">{o.totalAmount}</span>}
                </div>
                <p className="text-[10px] text-slate-400 font-medium">{o.customerOrderTime}</p>

                {(o.voiceNoteUrl || o.adminVoiceNoteUrl) && (
                  <div className="pt-2 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                    {o.voiceNoteUrl && (
                      <div className="bg-sky-50 p-2 rounded-lg border border-sky-100">
                        <p className="text-[9px] font-bold text-sky-700 mb-1 flex items-center gap-1">
                          <DynamicIcon icon={icons?.ui_audio} fallback="🎤" width={10} height={10} /> بصمة الزبون:
                        </p>
                        <VoiceNoteAudio src={resolvePublicAssetSrc(o.voiceNoteUrl) || ""} />
                      </div>
                    )}
                    {o.adminVoiceNoteUrl && (
                      <div className="bg-amber-50 p-2 rounded-lg border border-amber-100">
                        <p className="text-[9px] font-bold text-amber-700 mb-1 flex items-center gap-1">
                          <DynamicIcon icon={icons?.ui_audio} fallback="🎧" width={10} height={10} /> ملاحظة الإدارة الصوتية:
                        </p>
                        <VoiceNoteAudio src={resolvePublicAssetSrc(o.adminVoiceNoteUrl) || ""} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="hidden sm:flex items-start" onClick={(e) => e.stopPropagation()}>
                <RejectButton orderId={o.id} />
              </div>
            </div>

            {pricingOpen && (
              <div className="p-4 border-t-2 border-amber-300 bg-amber-50/40" onClick={e => e.stopPropagation()}>
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
                />
              </div>
            )}

            {assignOpen && (
              <div className="p-4 border-t-2 border-emerald-300 bg-emerald-50/40 shadow-inner" onClick={e => e.stopPropagation()}>
                <PendingAssignPanel
                  orderId={o.id}
                  couriers={couriers}
                  customerPhone={o.customerPhone}
                  customerAlternatePhone={o.customerAlternatePhone}
                  defaultCustomerLocationUrl={o.customerLocationUrl}
                  defaultCustomerLandmark={o.customerLandmark}
                  defaultCustomerDoorPhotoUrl={o.customerDoorPhotoUrl}
                  icons={icons}
                />
              </div>
            )}
          </div>
        );
      })}

      {isDraftMode && pricingModalOrder ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overflow-y-auto"
          onClick={() => setPricingOpenId(null)}
        >
          <div
            className="w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm border border-slate-200">
              <h3 className="text-sm font-black text-slate-900">نافذة التسعير — {pricingModalOrder.orderType || "مسودة"}</h3>
              <button
                type="button"
                onClick={() => setPricingOpenId(null)}
                className="relative z-[410] flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-sm hover:bg-red-700 transition"
                aria-label="إغلاق نافذة التسعير"
              >
                ✕
              </button>
            </div>

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
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}