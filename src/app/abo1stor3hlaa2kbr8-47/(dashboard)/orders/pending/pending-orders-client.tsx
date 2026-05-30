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

  if (preparers.length === 0) return <p className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black border border-rose-100 text-center flex items-center justify-center gap-2">⚠️ لا يوجد مجهزون متاحون.</p>;

  return (
    <form action={formAction} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl text-right animate-in zoom-in-95" dir="rtl">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="isDraft" value={String(!!isDraft)} />
      {selectedPreparers.map(id => <input key={id} type="hidden" name="preparerIds" value={id} />)}

      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <p className="text-xs font-black text-slate-900 flex items-center gap-2">
          <DynamicIcon icon={icons?.preparer_delegate} fallback="🛒" width={16} height={16} className="text-indigo-600" /> إسناد للمجهزين
        </p>
        <span className="text-[10px] font-black bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100 text-indigo-600">
          تم اختيار {selectedPreparers.length}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 py-2">
        {preparers.map((p) => {
          const isSelected = selectedPreparers.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePreparer(p.id)}
              className={`flex items-center justify-center gap-2 p-3.5 rounded-2xl border-2 transition-all duration-200 text-[11px] font-black ${isSelected ? "border-indigo-600 bg-indigo-600 text-white shadow-lg scale-[1.02]" : "border-slate-100 bg-slate-50 text-slate-500 hover:border-indigo-200 hover:bg-white shadow-sm"}`}
            >
              {isSelected && <DynamicIcon icon={icons?.ui_success} fallback="✓" width={12} height={12} />}
              {p.name}
            </button>
          );
        })}
      </div>

      {state.error && <p className="text-xs text-rose-600 font-bold p-3 bg-rose-50 rounded-2xl border border-rose-100">{state.error}</p>}

      <button type="submit" disabled={pending} className="w-full rounded-2xl bg-slate-900 py-4 text-xs font-black text-white shadow-xl active:scale-95 disabled:opacity-50 transition-all hover:bg-black flex items-center justify-center gap-2">
        {pending ? "جارٍ الحفظ..." : (
          <>
            <DynamicIcon icon={icons?.ui_success} fallback="✅" width={14} height={14} />
            {selectedPreparers.length === 0 ? "إخلاء الطلب (بدون مجهز)" : "تحديث قائمة المجهزين"}
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
      <form action={formAction} className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 bg-rose-50 p-1.5 px-3 rounded-2xl border border-rose-200 shadow-sm">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="isDraft" value={String(isDraft)} />
        <span className="text-[10px] font-black text-rose-700">حذف نهائي؟</span>
        <button type="submit" disabled={pending} className="bg-rose-600 text-white px-4 py-1.5 rounded-xl text-[10px] font-black shadow-sm active:scale-90 transition-transform">نعم</button>
        <button type="button" onClick={() => setConfirm(false)} className="bg-white text-slate-700 px-4 py-1.5 rounded-xl text-[10px] font-black border border-slate-200 transition-colors hover:bg-slate-50">لا</button>
      </form>
    );
  }
  return (
    <button type="button" onClick={() => setConfirm(true)} className="flex items-center gap-2 text-rose-600 hover:bg-rose-600 hover:text-white px-4 py-2 rounded-2xl border-2 border-rose-100 transition-all text-[11px] font-black bg-rose-50/30 active:scale-95">
      <DynamicIcon icon={icons?.ui_delete} fallback="🗑️" width={14} height={14} /> مسح الطلب
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
  const buyInputRef = useRef<HTMLInputElement>(null);
  const sellInputRef = useRef<HTMLInputElement>(null);

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
    if (editingIndex !== null) {
      setTimeout(() => buyInputRef.current?.focus(), 100);
    }
  }, [editingIndex]);

  useEffect(() => {
    if (state.ok && onSuccess) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <div className={`space-y-5 ${ad.section} bg-slate-50/60 border-slate-300 shadow-xl`} dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
              <DynamicIcon icon={icons?.admin_pricing} fallback="💰" width={20} height={20} />
            </div>
            <div>
              <p className={ad.h2}>{isDraft ? "تجهيز السلة الذكي" : "تعديل التسعير"}</p>
              {isSaving && <span className="text-[10px] font-black text-indigo-600 animate-pulse flex items-center gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span> جارٍ المزامنة...
              </span>}
            </div>
          </div>
          <DeleteFullOrderButton id={orderId} isDraft={Boolean(isDraft)} onSuccess={onSuccess} icons={icons} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowReassign(!showReassign)} className={ad.navButton}>
            <DynamicIcon icon={icons?.ui_plus} fallback={isDraft ? "➕" : "🔄"} width={12} height={12} className="ml-1" />
            {isDraft ? "إضافة مجهز" : "إعادة تعيين"}
          </button>
          <button type="button" onClick={() => setShowBulkAdd(!showBulkAdd)} className={`${ad.btnPrimary} !px-3 !py-1.5 !rounded-2xl !shadow-md`}>
            <DynamicIcon icon={icons?.ui_plus} fallback="➕" width={12} height={12} /> قائمة منتجات
          </button>
          <button type="button" onClick={() => { setDeleteMode(!deleteMode); setEditingIndex(null); }} className={`${deleteMode ? ad.btnDanger : ad.btnSecondary} !px-3 !py-1.5 !rounded-2xl !shadow-md`}>
            <DynamicIcon icon={icons?.ui_delete} fallback="🗑️" width={12} height={12} />
            {deleteMode ? "إنهاء الحذف" : "حذف أسطر"}
          </button>
        </div>
      </div>

      {showReassign && <div className="animate-in slide-in-from-top-2"><AssignToPreparerPanel orderId={orderId} preparers={preparers} isDraft={isDraft} initialPreparerIds={initialPreparerIds} onSuccess={() => { setShowReassign(false); onSuccess?.(); }} /></div>}

      {showBulkAdd && (
        <div className={`${ad.card} p-4 border-2 border-indigo-200 animate-in zoom-in-95 shadow-xl mb-4 bg-white`}>
          <div className="flex items-center justify-between mb-4">
            <p className={ad.h3}>إضافة قائمة منتجات سريعة</p>
            <button type="button" onClick={() => setShowBulkAdd(false)} className="text-slate-400 hover:text-rose-600 transition-colors">✕</button>
          </div>
          <textarea
            className={`${ad.input} w-full min-h-[120px] font-bold`}
            placeholder="اكتب كل منتج في سطر جديد...&#10;طماطم 2 كيلو&#10;خبز 3 كيس"
            onBlur={(e) => {
              const lines = e.target.value.split("\n").map(l => l.trim()).filter(l => l.length > 1);
              if (lines.length) {
                setProducts([...products, ...lines.map(line => ({ line, buyAlf: "0", sellAlf: "0", pricedBy: null, assignedPreparerId: null, assignedPreparerName: null }))]);
                setShowBulkAdd(false);
              }
              e.target.value = "";
            }}
          />
          <p className={ad.muted + " mt-2 italic"}>* سيتم إضافة المنتجات تلقائياً عند النقر خارج المربع.</p>
        </div>
      )}

      {products.length > 0 && (
        <div className="mb-4 rounded-3xl bg-indigo-50/50 border border-indigo-100 p-4 shadow-inner">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={ad.h3 + " !text-indigo-900"}>إسناد جماعي ({selectedProductIndexes.length})</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={clearSelection} className={ad.navButton}>إلغاء التحديد</button>
              <button type="button" onClick={toggleSelectAllProducts} className={ad.navButton}>
                {selectedProductIndexes.length === products.length ? "إلغاء الكل" : "تحديد الكل"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={productAssigneeId} onChange={(e) => setProductAssigneeId(e.target.value)} className={`${ad.select} flex-1 min-w-[14rem]`}>
              <option value="">اختر المجهز للتعيين...</option>
              {preparers.map((prep) => (
                <option key={prep.id} value={prep.id}>{prep.name}</option>
              ))}
            </select>
            <button type="button" onClick={assignSelectedProductsToPreparer} disabled={!productAssigneeId || selectedProductIndexes.length === 0} className={ad.btnPrimary}>
              تأكيد التعيين
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
        {products.map((p, i) => {
          const isEditing = editingIndex === i;
          const buyVal = parseFloat(normalizeNumerals((p?.buyAlf ?? "0").toString())) || 0;
          const priced = buyVal > 0;
          const isSelected = selectedProductIndexes.includes(i);
          return (
            <div key={i} className={`transition-all duration-200 ${isSelected ? "ring-2 ring-indigo-500 ring-offset-2 rounded-2xl" : ""}`}>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={isSelected} onChange={() => toggleProductSelection(i)} className="h-5 w-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                <div
                  className={`flex-1 flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${deleteMode ? "border-rose-300 bg-rose-50" : priced ? "border-slate-800 bg-slate-900 text-white shadow-lg" : isEditing ? "border-indigo-500 bg-white ring-4 ring-indigo-50" : "border-slate-200 bg-white hover:border-indigo-400"}`}
                  onClick={() => !deleteMode && setEditingIndex(isEditing ? null : i)}
                >
                  <div className="flex flex-1 items-center gap-3">
                    {p?.productId && productPhotoById[p.productId] && (
                      <div className="h-12 w-12 rounded-xl border border-slate-200 overflow-hidden bg-white shrink-0 shadow-sm">
                        <img src={productPhotoById[p.productId]} className="h-full w-full object-cover" alt="" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-black truncate ${priced ? "text-white" : "text-slate-900"}`}>{p?.line}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {(findPreparerName(p?.assignedPreparerId) || p?.assignedPreparerName) ? (
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${priced ? "bg-white/10 text-indigo-200" : "bg-slate-100 text-slate-500"}`}>
                            👤 {findPreparerName(p?.assignedPreparerId) || p?.assignedPreparerName}
                          </span>
                        ) : p?.supplierId ? (
                          <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">🛒 {p?.supplierName || "مورد"}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">بدون تخصيص</span>
                        )}
                        {priced && <span className="text-xs font-black tabular-nums text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg">S: {p?.sellAlf}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {deleteMode ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setProducts(products.filter((_, idx) => idx !== i)); }} className="h-9 w-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center hover:bg-rose-200 transition-colors">
                        <DynamicIcon icon={icons?.ui_delete} fallback="✕" width={16} height={16} />
                      </button>
                    ) : isEditing ? (
                      <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center animate-pulse shadow-lg shadow-indigo-200">
                        <DynamicIcon icon={icons?.ui_settings} fallback="⚙️" width={18} height={18} />
                      </div>
                    ) : priced ? (
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <DynamicIcon icon={icons?.ui_success} fallback="✓" width={18} height={18} />
                      </div>
                    ) : (
                      <div className="h-9 w-9 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center border border-slate-100 group-hover:text-indigo-400 group-hover:border-indigo-100 transition-all">
                        <DynamicIcon icon={icons?.ui_settings} fallback="⚙️" width={18} height={18} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isEditing && !deleteMode && (
                <div className="mt-3 bg-white p-5 rounded-3xl border-2 border-indigo-500 shadow-2xl animate-in slide-in-from-top-4 z-10 relative">
                  <div className="space-y-4">
                    <input type="text" value={p?.line} onChange={(e) => updateProduct(i, "line", e.target.value)} className="w-full text-lg font-black text-slate-900 border-b-2 border-slate-100 pb-2 outline-none focus:border-indigo-500 transition-colors" placeholder="اسم المنتج..." />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className={ad.label}>كلفة الشراء</label>
                        <input
                          ref={buyInputRef}
                          type="text"
                          inputMode="decimal"
                          value={p?.buyAlf ?? ""}
                          onChange={(e) => updateProduct(i, "buyAlf", e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), sellInputRef.current?.focus())}
                          className={`${ad.input} w-full font-mono text-center text-lg`}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={ad.label + " !text-emerald-600"}>سعر البيع</label>
                        <input
                          ref={sellInputRef}
                          type="text"
                          inputMode="decimal"
                          value={p?.sellAlf ?? ""}
                          onChange={(e) => updateProduct(i, "sellAlf", e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setEditingIndex(null))}
                          className={`${ad.input} w-full font-mono text-center text-lg !border-emerald-200 !bg-emerald-50 focus:!border-emerald-500 focus:!ring-emerald-500/10`}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className={ad.label}>تخصيص المجهز</label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={() => updateProduct(i, "assignedPreparerId", "")}
                          className={`py-2.5 rounded-xl text-[10px] font-black border transition-all ${!p?.assignedPreparerId ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                        >
                          بدون مجهز
                        </button>
                        {preparers.map((prep) => (
                          <button
                            key={prep.id}
                            type="button"
                            onClick={() => updateProduct(i, "assignedPreparerId", prep.id)}
                            className={`py-2.5 rounded-xl text-[10px] font-black border transition-all truncate ${p?.assignedPreparerId === prep.id ? "bg-indigo-600 text-white border-indigo-700 shadow-lg" : "bg-indigo-50/50 text-indigo-900 border-indigo-100 hover:bg-indigo-100"}`}
                          >
                            {prep.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer group hover:bg-white transition-colors">
                      <input type="checkbox" checked={Boolean(p?.pricedBy === "الإدارة")} onChange={(e) => updateProduct(i, "pricedBy", e.target.checked)} className="h-5 w-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-xs font-black text-slate-700">تم التجهيز بواسطة الإدارة مباشرة</span>
                    </label>

                    <button type="button" onClick={() => setEditingIndex(null)} className={`${ad.btnDark} w-full py-4 !rounded-2xl shadow-2xl`}>
                       تأكيد وحفظ السطر (Enter)
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-inner">
        <div className="col-span-3 pb-3 border-b border-slate-100">
          <select value={placesCount} onChange={(e) => setPlacesCount(Number(e.target.value))} className={`${ad.select} w-full !bg-white border-slate-200`}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} أماكن شراء / محلات</option>)}
          </select>
        </div>
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
          <p className={ad.label + " !mb-0 text-center"}>المنتجات</p>
          <p className="text-sm font-black tabular-nums text-slate-900">{totals.subtotal.toLocaleString()}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
          <p className={ad.label + " !mb-0 text-center"}>التوصيل</p>
          <p className="text-sm font-black tabular-nums text-slate-900">{deliveryAlfVal > 0 ? deliveryAlfVal.toLocaleString() : "—"}</p>
        </div>
        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 text-center flex flex-col justify-center">
          <p className="text-[9px] font-black opacity-80 uppercase tracking-widest mb-0.5">الإجمالي</p>
          <p className="text-lg font-black tabular-nums leading-none">{totals.total.toLocaleString()}</p>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="productsJson" value={JSON.stringify(products)} />
        <input type="hidden" name="placesCount" value={placesCount} />
        {isDraft && <input type="hidden" name="autoCourierId" value={String(initialData?.autoCourierId ?? "")} />}
        {isDraft && <input type="hidden" name="shopId" value={selectedShopId} />}
        {isDraft && <input type="hidden" name="isDraft" value="true" />}

        <label className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 cursor-pointer transition-colors hover:bg-emerald-100/50">
          <input type="checkbox" id="skip-w" name="skipWallet" className="h-6 w-6 rounded-lg border-emerald-300 text-emerald-600 focus:ring-emerald-500" />
          <div>
            <p className="text-xs font-black text-emerald-900">تجهيز إداري كامل</p>
            <p className="text-[10px] font-bold text-emerald-600 opacity-80">سيتم تخطي خصم المبلغ من محفظة المجهز</p>
          </div>
        </label>

        {state.error && <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3 animate-shake">
          <span className="text-xl">⚠️</span>
          <p className="text-xs font-black text-rose-600">{state.error}</p>
        </div>}

        {isDraft ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button type="submit" name="submitType" value="admin_approve" disabled={pending || !selectedShopId} className={`${ad.btnSecondary} !py-4 shadow-xl border-slate-300 hover:bg-slate-100`}>
              {pending ? "جارٍ الحفظ..." : (
                <>
                  <DynamicIcon icon={icons?.ui_success} fallback="✅" width={18} height={18} /> اعتماد المسودة كطلب
                </>
              )}
            </button>
            <button type="submit" name="submitType" value="final_send" disabled={pending || !canSubmitFinal} className={`${ad.btnPrimary} !py-4 shadow-2xl`}>
              {pending ? "جارٍ الإرسال..." : (
                <>
                  <DynamicIcon icon={icons?.ui_rocket} fallback="🚀" width={18} height={18} /> إرسال الطلب النهائي
                </>
              )}
            </button>
          </div>
        ) : (
          <button type="submit" disabled={pending} className={`${ad.btnPrimary} w-full !py-5 shadow-2xl !text-base`}>
            {pending ? "جارٍ معالجة البيانات..." : (
              <>
                <DynamicIcon icon={icons?.ui_success} fallback="✅" width={20} height={20} />
                اعتماد التسعير والرفع للمندوب
                <DynamicIcon icon={icons?.ui_rocket} fallback="🚀" width={20} height={20} />
              </>
            )}
          </button>
        )}
      </form>

      {previewImageUrl && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-md animate-in fade-in duration-300" onClick={() => (setPreviewImageUrl(null), setPreviewZoom(1))}>
          <div className="relative max-h-full max-w-full" onClick={e => e.stopPropagation()}>
             <button onClick={() => (setPreviewImageUrl(null), setPreviewZoom(1))} className="absolute -top-12 right-0 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-rose-600 transition-colors">✕</button>
             <img src={previewImageUrl} alt="" className="max-h-[85vh] rounded-3xl border-4 border-white/20 shadow-2xl transition-transform duration-200" style={{ transform: `scale(${previewZoom})` }} />
             <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20">
                <button onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.2))} className="text-white font-black text-xl hover:text-indigo-400 transition-colors">−</button>
                <span className="text-white font-black text-xs min-w-[3rem] text-center">{Math.round(previewZoom * 100)}%</span>
                <button onClick={() => setPreviewZoom(z => Math.min(3, z + 0.2))} className="text-white font-black text-xl hover:text-indigo-400 transition-colors">+</button>
             </div>
          </div>
        </div>
      )}
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
}) {
  const bound = assignPendingOrderToCourier.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as AssignOrderState);

  useEffect(() => {
    if (state.ok && onSuccess) {
      onSuccess();
    }
  }, [state.ok, onSuccess]);

  if (couriers.length === 0) return <p className="p-4 bg-amber-50 text-amber-900 rounded-2xl text-[11px] font-bold border border-amber-100 text-center flex items-center justify-center gap-2">⚠️ لا يوجد مناديب متوفرون حالياً.</p>;

  const inputClass = "w-full rounded-2xl border border-slate-200 p-3 text-[11px] font-bold outline-none text-right bg-white focus:ring-2 focus:ring-sky-300 transition-all placeholder:text-slate-300";
  const labelClass = "text-[10px] font-black text-slate-400 mb-1.5 block pr-1 uppercase tracking-wider";

  return (
    <form action={formAction} encType="multipart/form-data" className={`space-y-5 ${ad.section} bg-slate-50 shadow-2xl animate-in slide-in-from-bottom-4 border-slate-300`} dir="rtl">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-sky-600 flex items-center justify-center text-white shadow-lg shadow-sky-100">
            <DynamicIcon icon={icons?.ui_package} fallback="📦" width={20} height={20} />
          </div>
          <p className={ad.h2}>إسناد المندوب</p>
        </div>
        <div className="text-left">
          <p className={ad.label}>الزبون</p>
          <p className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-xl border border-indigo-100">{customerPhone}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
            <OrderStatusRadioGroup name="courierId" defaultValue="" required legend="اختر المندوب المناسب" options={couriers.map((c) => ({ value: c.id, label: c.name }))} />
          </div>

          <label className="flex items-center gap-4 bg-slate-900 p-5 rounded-3xl border border-black shadow-xl cursor-pointer group hover:scale-[1.01] active:scale-95 transition-all">
            <input type="checkbox" id="direct-receipt" name="directReceipt" className="h-6 w-6 rounded-xl border-slate-700 bg-slate-800 text-sky-500 focus:ring-0" />
            <div className="flex-1">
              <p className="text-sm font-black text-white group-hover:text-sky-300 transition-colors flex items-center gap-2">
                تفعيل الاستلام المباشر <DynamicIcon icon={icons?.ui_flash} fallback="⚡" width={14} height={14} />
              </p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">يتخطى مرحلة موافقة المندوب (إرسال فوري)</p>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
               <label className={ad.label}>رقم بديل</label>
               <input type="text" name="customerAlternatePhone" defaultValue={customerAlternatePhone} className={ad.input + " w-full font-mono"} placeholder="07XXXXXXXX" />
            </div>
            <div className="space-y-1.5">
               <label className={ad.label}>نقطة دالة</label>
               <input type="text" name="customerLandmark" defaultValue={defaultCustomerLandmark} className={ad.input + " w-full"} placeholder="قرب معلَم معروف" />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className={ad.label}>موقع الزبون (GPS)</label>
            <textarea name="customerLocationUrl" rows={3} defaultValue={defaultCustomerLocationUrl} className={`${ad.input} w-full font-mono text-[11px] text-left leading-relaxed`} dir="ltr" placeholder="https://maps.app.goo.gl/..." />
          </div>

          <div className="space-y-1.5">
            <label className={ad.label}>صورة الباب / الواجهة</label>
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border-2 border-dashed border-slate-200 bg-white p-2 transition-all hover:border-sky-500 group">
              {defaultCustomerDoorPhotoUrl ? (
                <img src={resolvePublicAssetSrc(defaultCustomerDoorPhotoUrl)!} alt="Door" className="h-full w-full object-cover rounded-2xl" />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-sky-50 transition-colors">
                    <DynamicIcon icon={icons?.ui_image} fallback="🖼️" width={24} height={24} className="group-hover:text-sky-500" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest">اضغط لرفع صورة</p>
                </div>
              )}
              <input type="file" name="doorPhoto" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" title="تغيير الصورة" />
            </div>
          </div>
        </div>
      </div>

      {state.error && <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3 animate-shake">
        <span className="text-xl">⚠️</span>
        <p className="text-xs font-black text-rose-600">{state.error}</p>
      </div>}

      <div className="pt-2">
        <button type="submit" disabled={pending} className={`${ad.btnDark} w-full !py-5 !text-base shadow-2xl`}>
          {pending ? "جاري معالجة الطلب..." : (
            <>
              <DynamicIcon icon={icons?.ui_rocket} fallback="🚀" width={20} height={20} />
              اعتماد الإسناد للمندوب
            </>
          )}
        </button>
      </div>
      <div className="pt-2">
        <button type="submit" disabled={pending} className="w-full rounded-2xl bg-gradient-to-r from-slate-800 to-black py-4 text-xs font-black text-white shadow-2xl active:scale-[0.98] transition-all border-b-4 border-slate-950 flex items-center justify-center gap-2">
          {pending ? "جاري معالجة الطلب..." : (
            <>
              <DynamicIcon icon={icons?.ui_rocket} fallback="🚀" width={16} height={16} />
              اعتماد الإسناد للمندوب
            </>
          )}
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
    <form ref={formRef} action={formAction} className={`${ad.card} p-5 space-y-5 bg-indigo-50/50 border-indigo-200 shadow-xl animate-in zoom-in-95`} dir="rtl">
      <input type="hidden" name="draftId" value={draftId} />
      <input type="hidden" name="courierId" value={selectedCourierId} />

      <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
        <p className={ad.h3 + " !text-indigo-900 flex items-center gap-2"}>
           🔄 التحويل التلقائي عند الإرسال
        </p>
        {currentCourierName && (
          <span className="rounded-xl bg-indigo-600 text-white px-3 py-1.5 text-[10px] font-black shadow-lg">
            الحالي: {currentCourierName}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setSelectedCourierId("");
            setTimeout(() => formRef.current?.requestSubmit(), 0);
          }}
          className={`p-4 rounded-2xl text-[11px] font-black border transition-all ${
            selectedCourierId === ""
              ? "bg-slate-900 text-white border-slate-950 shadow-xl scale-[1.02]"
              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 shadow-md"
          } disabled:opacity-50`}
        >
          تعطيل التحويل
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
            className={`p-4 rounded-2xl text-[11px] font-black border transition-all truncate ${
              selectedCourierId === c.id
                ? "bg-indigo-600 text-white border-indigo-700 shadow-xl scale-[1.02]"
                : "bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-50 shadow-md"
            } disabled:opacity-50`}
          >
            {c.name}
          </button>
        ))}
      </div>
      {state.error ? <p className="text-xs font-black text-rose-600 bg-rose-50 p-3 rounded-2xl border border-rose-100">{state.error}</p> : null}
    </form>
  );
}

function RejectButton({ orderId, icons }: { orderId: string, icons: GlobalIconsConfig | null }) {
  const bound = rejectPendingOrder.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as RejectOrderState);
  return (
    <form action={formAction} onSubmit={(e) => { if(!confirm("هل أنت متأكد من رفض هذا الطلب؟")) e.preventDefault(); }}>
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" disabled={pending} title="رفض الطلب" className="h-9 w-9 flex items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50 shadow-sm active:scale-90">
        <DynamicIcon icon={icons?.ui_close} fallback="✕" width={14} height={14} />
      </button>
    </form>
  );
}

function RejectDraftButton({ draftId, icons }: { draftId: string, icons: GlobalIconsConfig | null }) {
  const bound = rejectPreparerDraft.bind(null);
  const [state, formAction, pending] = useActionState(bound, {} as RejectOrderState);
  return (
    <form action={formAction} onSubmit={(e) => { if(!confirm("هل أنت متأكد من رفض هذه المسودة؟")) e.preventDefault(); }}>
      <input type="hidden" name="draftId" value={draftId} />
      <button type="submit" disabled={pending} className="h-7 px-3 flex items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50 text-[10px] font-black shadow-sm gap-1 active:scale-95">
        <DynamicIcon icon={icons?.ui_delete} fallback="✕" width={12} height={12} /> رفض المسودة
      </button>
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
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 border border-sky-200 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer text-slate-700"><input type="checkbox" onChange={toggleAll} className="h-4 w-4 rounded" /> تحديد الكل</label>
          {selected.size > 0 && <span className="text-[10px] font-black bg-sky-100 text-sky-900 px-3 py-1 rounded-full border border-sky-200">تم اختيار {selected.size} طلب</span>}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-2 z-[100] p-4 bg-slate-900/90 text-white rounded-3xl animate-in slide-in-from-top-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-slate-700 mx-2 backdrop-blur-xl ring-4 ring-indigo-500/20">
          <form action={bulkAction} className="flex flex-wrap items-center gap-4">
            {Array.from(selected).map(id => <input key={id} type="hidden" name="orderIds" value={id} />)}

            <div className="flex-1 min-w-[160px]">
              <label className="text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-widest block pr-1">تغيير الحالة</label>
              <select
                name="targetStatus"
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="w-full rounded-2xl bg-slate-800 border border-slate-700 p-3 text-xs font-black outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="pending">⏳ قيد الانتظار</option>
                <option value="assigned">📦 مسند للمندوب</option>
                <option value="delivering">🚚 قيد التوصيل</option>
                <option value="delivered">✅ تم التسليم</option>
              </select>
            </div>

            {(targetStatus === "assigned" || targetStatus === "delivering" || targetStatus === "delivered") && (
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-widest block pr-1">المندوب</label>
                <select
                  name="courierId"
                  value={courierId}
                  onChange={(e) => setCourierId(e.target.value)}
                  className="w-full rounded-2xl bg-slate-800 border border-slate-700 p-3 text-xs font-black outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <option value="">-- اختر مندوباً --</option>
                  {couriers.map((courier) => (
                    <option key={courier.id} value={courier.id}>{courier.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-end self-end">
              <button type="submit" disabled={bulkPending || ((targetStatus === "assigned" || targetStatus === "delivering" || targetStatus === "delivered") && !courierId)} className={`${ad.btnPrimary} !bg-indigo-500 hover:!bg-indigo-400 !py-3.5 shadow-indigo-500/20`}>
                <DynamicIcon icon={icons?.ui_success} fallback="✓" width={16} height={16} />
                تحديث {selected.size} طلب
              </button>
            </div>
          </form>
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
            <div key={o.id} className="space-y-2 animate-in fade-in slide-in-from-right-4">
              <div
                className={`group relative overflow-hidden rounded-3xl border transition-all duration-300 hover:shadow-2xl cursor-pointer ${open ? "border-indigo-400 bg-indigo-50/30 ring-4 ring-indigo-100 shadow-indigo-100" : "border-slate-200 bg-white shadow-sm hover:border-indigo-300"}`}
                onClick={() => setPricingOpenId(o.id)}
              >
                <div className={`h-1.5 w-full transition-colors ${open ? "bg-indigo-600" : "bg-slate-100 group-hover:bg-indigo-200"}`} />
                <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-50 pb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-900 text-white px-2 py-0.5 rounded-lg font-black text-[10px] tabular-nums shadow-sm">
                        مسودة
                      </span>
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-black text-[10px] tabular-nums border border-indigo-100">
                        #{o.orderNumber > 0 ? o.orderNumber : "—"}
                      </span>
                      <p className="font-black text-slate-900 leading-snug line-clamp-1">
                        {o.orderType || o.shopName || "تجهيز"}
                        {o.vehiclePreference === "bike" && <span className="mr-2 text-indigo-600" title="طلب دراجة">🏍️</span>}
                        {o.vehiclePreference === "car" && <span className="mr-2 text-indigo-600" title="طلب سيارة">🚗</span>}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-500">{o.regionName}</span>
                      <span className="text-indigo-600 text-[10px] font-black">{o.shopCustomerLabel || o.shopName || "—"}</span>
                    </div>
                    <p className="mt-3 text-[10px] font-black text-slate-700 bg-white inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      المجهز: <span className="text-slate-900">{o.submittedByName || "—"}</span>
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-lg bg-slate-100 px-2 py-1 font-black text-slate-700 text-[10px] border border-slate-200 tabular-nums">
                         {customerPhone}
                      </span>
                      {waLink ? (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-7 items-center justify-center rounded-lg bg-emerald-600 px-3 text-[10px] font-black text-white shadow-sm hover:bg-emerald-700 transition-all active:scale-95"
                        >
                          <DynamicIcon icon={icons?.ui_whatsapp} fallback="WA" width={10} height={10} className="ml-1" /> واتساب
                        </a>
                      ) : null}
                      {telLink ? (
                        <a
                          href={telLink}
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-7 items-center justify-center rounded-lg bg-indigo-600 px-3 text-[10px] font-black text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95"
                        >
                          <DynamicIcon icon={icons?.ui_call} fallback="📞" width={10} height={10} className="ml-1" /> اتصال
                        </a>
                      ) : null}
                      <div className="mr-auto" onClick={e => e.stopPropagation()}>
                        <RejectDraftButton draftId={o.id} icons={icons} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setDraftPreparerOpenId(draftPreparerOpen ? null : o.id)}
                    className="flex-1 rounded-2xl bg-indigo-50 border-2 border-indigo-100 py-3 text-[11px] font-black text-indigo-900 shadow-sm hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                  >
                    <DynamicIcon icon={icons?.preparer_delegate} fallback="🛒" width={14} height={14} /> المجهزين
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftCourierOpenId(draftCourierOpen ? null : o.id)}
                    className="flex-1 rounded-2xl bg-emerald-50 border-2 border-emerald-100 py-3 text-[11px] font-black text-emerald-900 shadow-sm hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                  >
                    <DynamicIcon icon={icons?.ui_package} fallback="📦" width={14} height={14} /> إسناد مندوب
                  </button>
                </div>
                </div>

                {currentAutoCourierName && (
                  <div className="m-4 mt-0 rounded-2xl bg-slate-900 p-4 shadow-xl border-b-4 border-black animate-in fade-in zoom-in duration-300">
                    <p className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-tighter">
                       🔄 التحويل التلقائي مفعل إلى
                    </p>
                    <p className="text-lg font-black text-white mt-1 flex items-center justify-center gap-2">
                       🚀 {currentAutoCourierName}
                    </p>
                  </div>
                )}
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
            className={`group relative overflow-hidden rounded-3xl border transition-all duration-300 animate-in fade-in slide-in-from-left-4 ${pricingOpen ? "border-indigo-400 ring-4 ring-indigo-50 shadow-2xl" : assignOpen ? "border-emerald-400 bg-emerald-50/20 shadow-lg" : "border-slate-200 bg-white shadow-sm hover:shadow-md"}`}
          >
            <div className={`h-1 w-full transition-colors ${pricingOpen ? "bg-indigo-600" : assignOpen ? "bg-emerald-600" : "bg-slate-50"}`} />
            <div
              className={`flex flex-col sm:flex-row gap-4 p-4 cursor-pointer ${pricingOpen ? "bg-indigo-50/10" : ""}`}
              onClick={() => router.push(`${SECRET_ADMIN_PATH}/orders/${o.id}`)}
            >
              <div className="flex sm:flex-col gap-2 border-slate-100 sm:border-e sm:pe-3" onClick={e => e.stopPropagation()}>
                <label className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white cursor-pointer shadow-sm hover:border-indigo-400 transition-all">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOne(o.id)} className="h-5 w-5 rounded border-slate-300 text-indigo-600" />
                </label>
                <button
                  type="button"
                  onClick={() => { setPricingOpenId(pricingOpen ? null : o.id); setAssignOpenId(null); setPrepOpenId(null); }}
                  className={`h-10 w-10 flex items-center justify-center rounded-xl border shadow-sm transition-all ${pricingOpen ? "bg-slate-900 text-white border-slate-950 ring-4 ring-indigo-100" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
                >
                  <DynamicIcon icon={icons?.admin_pricing} fallback="💰" width={18} height={18} />
                </button>
                <button
                  type="button"
                  onClick={() => { setAssignOpenId(assignOpen ? null : o.id); setPricingOpenId(null); setPrepOpenId(null); }}
                  className={`h-10 w-10 flex items-center justify-center rounded-xl border shadow-sm transition-all ${assignOpen ? "bg-emerald-600 text-white border-emerald-700 ring-4 ring-emerald-100" : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"}`}
                >
                  <CheckIcon icons={icons} />
                </button>
              </div>

              <div className="flex-1 text-right space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="bg-slate-900 text-white px-2 py-0.5 rounded-lg font-black text-[10px] tabular-nums shadow-sm">{`#${o.orderNumber}`}</span>
                  {o.submissionLabel === "طلب متجر" && (
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg font-black text-[9px] border border-amber-200 flex items-center gap-1 shadow-sm">
                      <DynamicIcon icon={icons?.store_cart} fallback="🛒" width={10} height={10} /> متجر
                    </span>
                  )}
                  <p className="font-black text-slate-900 leading-snug text-sm sm:text-base">
                    {o.shopCustomerLabel || o.shopName?.trim() || "—"}
                    {o.vehiclePreference === "bike" && <span className="mr-2 text-indigo-600" title="طلب دراجة">🏍️</span>}
                    {o.vehiclePreference === "car" && <span className="mr-2 text-indigo-600" title="طلب سيارة">🚗</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-500">{o.regionName}</span>
                  <span className="text-indigo-600 text-[10px] font-black bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-50">{o.orderType}</span>
                  {o.totalAmount != null && <span className="text-emerald-700 font-black tabular-nums text-[11px]">{o.totalAmount}</span>}
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{o.customerOrderTime}</p>

                {(o.voiceNoteUrl || o.adminVoiceNoteUrl) && (
                  <div className="pt-2 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                    {o.voiceNoteUrl && (
                      <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 shadow-inner">
                        <p className="text-[9px] font-black text-slate-500 mb-1.5 flex items-center gap-1">
                          <DynamicIcon icon={icons?.ui_audio} fallback="🎤" width={10} height={10} /> بصمة الزبون
                        </p>
                        <VoiceNoteAudio src={resolvePublicAssetSrc(o.voiceNoteUrl) || ""} />
                      </div>
                    )}
                    {o.adminVoiceNoteUrl && (
                      <div className="bg-indigo-50/50 p-2.5 rounded-2xl border border-indigo-100 shadow-inner">
                        <p className="text-[9px] font-black text-indigo-600 mb-1.5 flex items-center gap-1">
                          <DynamicIcon icon={icons?.ui_audio} fallback="🎧" width={10} height={10} /> ملاحظة الإدارة
                        </p>
                        <VoiceNoteAudio src={resolvePublicAssetSrc(o.adminVoiceNoteUrl) || ""} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-start mr-auto sm:mr-0" onClick={(e) => e.stopPropagation()}>
                <RejectButton orderId={o.id} icons={icons} />
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
                  onSuccess={() => { setAssignOpenId(null); router.refresh(); }}
                />
              </div>
            )}
          </div>
        );
      })}

      {isDraftMode && pricingModalOrder ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300"
          onClick={() => setPricingOpenId(null)}
        >
          <div
            className="w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between rounded-full bg-white/90 p-2 pl-4 shadow-2xl border border-white/50 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-lg">
                   <DynamicIcon icon={icons?.admin_pricing} fallback="💰" width={20} height={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900">نافذة المعالجة الذكية</h3>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{pricingModalOrder.orderType || "تجهيز طلب"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPricingOpenId(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-90 font-black"
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            <div className="animate-in slide-in-from-bottom-8 duration-500">
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
        </div>
      ) : null}
    </div>
  );
}