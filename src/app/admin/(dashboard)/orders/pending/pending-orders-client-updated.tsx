"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useMemo, useRef } from "react";
import {
  assignPendingOrderToCourier,
  assignOrderToPreparer,
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
  submittedByName: string | null;
  submissionLabel: string | null;
  customerLocationUrl: string;
  customerLandmark: string;
  hasCustomerLocation: boolean;
  hasCourierUploadedLocation: boolean;
  reversePickup?: boolean;
  wardMismatchType?: "excess" | "deficit" | null;
  saderMismatchType?: "excess" | "deficit" | null;
  preparerShoppingJson?: any;
  assignedPreparerIds: string[];
};

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

/** لوحة إسناد الطلب لمجهز (تدعم اختيار متعدد وتأشير مسبق) */
export function AssignToPreparerPanel({
  orderId,
  preparers,
  isDraft,
  initialPreparerIds = [],
  onSuccess
}: {
  orderId: string;
  preparers: { id: string; name: string }[];
  isDraft?: boolean;
  initialPreparerIds?: string[];
  onSuccess?: () => void;
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

  if (preparers.length === 0) return <p className="p-3 bg-amber-50 text-amber-900 rounded-lg text-xs font-bold border border-amber-200 text-center">⚠️ لا يوجد مجهزون متاحون حالياً.</p>;

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4 shadow-inner text-right" dir="rtl">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="isDraft" value={String(!!isDraft)} />
      {selectedPreparers.map(id => <input key={id} type="hidden" name="preparerIds" value={id} />)}
      <p className="text-sm font-black text-sky-900 border-b border-sky-100 pb-2 flex items-center gap-2">🛒 إسناد الطلب للمجهزين</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
        {preparers.map((p) => (
          <label key={p.id} className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all cursor-pointer ${selectedPreparers.includes(p.id) ? "border-sky-600 bg-sky-100 shadow-sm" : "border-white bg-white/50 hover:border-sky-200"}`}>
            <input type="checkbox" checked={selectedPreparers.includes(p.id)} onChange={() => togglePreparer(p.id)} className="h-5 w-5 rounded border-sky-300 text-sky-600 focus:ring-sky-500" />
            <span className={`text-xs font-black ${selectedPreparers.includes(p.id) ? "text-sky-900" : "text-slate-600"}`}>{p.name}</span>
          </label>
        ))}
      </div>
      {state.error && <p className="text-xs text-rose-600 font-bold p-2 bg-rose-50 rounded-lg border border-rose-200">{state.error}</p>}
      <button type="submit" disabled={pending || selectedPreparers.length === 0} className="w-full rounded-xl bg-sky-600 py-3.5 text-sm font-black text-white shadow-lg active:scale-95 disabled:opacity-50 transition-all hover:bg-sky-700">
        {pending ? "جارٍ الإسناد..." : initialPreparerIds.length > 0 ? "✅ تحديث المجهزين" : `✅ إسناد إلى ${selectedPreparers.length} مجهز`}
      </button>
    </form>
  );
}

/** زر حذف الطلب بالكامل مع طلب تأكيد */
function DeleteFullOrderButton({ id, isDraft, onSuccess }: { id: string, isDraft: boolean, onSuccess?: () => void }) {
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
  return <button type="button" onClick={() => setConfirm(true)} className="flex items-center gap-1 text-rose-600 hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-xl border-2 border-rose-600 transition-all text-[11px] font-black bg-white shadow-sm active:scale-95">🗑️ مسح الطلب</button>;
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
  onSuccess
}: {
  orderId: string;
  initialData: any;
  orderSummary?: string;
  isDraft?: boolean;
  initialPreparerIds?: string[];
  shops?: { id: string; name: string }[];
  preparers?: { id: string; name: string }[];
  onSuccess?: () => void;
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

  const bound = updateOrderPricingByAdmin.bind(null, orderId);
  const [state, formAction, pending] = useActionState(bound, {} as any);

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

  const assignSelectedProductsToPreparer = async (preparerId: string) => {
    if (!preparerId || selectedProductIndexes.length === 0) return;
    const preparerName = findPreparerName(preparerId);
    const next = products.map((item, idx) => selectedProductIndexes.includes(idx) ? {
      ...item,
      assignedPreparerId: preparerId,
      assignedPreparerName: preparerName,
    } : item);
    setProducts(next);
    setSelectedProductIndexes([]);
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
    const delivery = Number(initialData?.deliveryAlf || 0);
    return { subtotal: sumSell + extra, total: sumSell + extra + delivery };
  }, [products, placesCount, initialData?.deliveryAlf]);

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
            <span className="text-xl">💰</span> {isDraft ? "تجهيز وتسعير المسودة" : "تعديل تسعير الطلب"}
            {isSaving && <span className="text-[9px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded animate-pulse">جاري الحفظ التلقائي...</span>}
          </p>
          <DeleteFullOrderButton id={orderId} isDraft={Boolean(isDraft)} onSuccess={onSuccess} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowReassign(!showReassign)} className="rounded-xl bg-slate-800 text-white px-3 py-1.5 text-[10px] font-black shadow-sm transition hover:bg-black">{isDraft ? "➕ إضافة مجهز" : "🔄 تغيير المجهز"}</button>
          <button type="button" onClick={() => setShowBulkAdd(!showBulkAdd)} className="rounded-xl bg-violet-600 text-white px-3 py-1.5 text-[10px] font-black shadow-sm transition active:scale-95">➕ قائمة كاملة</button>
          <button type="button" onClick={() => { setDeleteMode(!deleteMode); setEditingIndex(null); }} className={`rounded-xl px-3 py-1.5 text-[10px] font-black shadow-sm transition ${deleteMode ? "bg-rose-600 text-white" : "bg-white border border-rose-300 text-rose-700"}`}>{deleteMode ? "إلغاء الحذف" : "🗑️ مسح أسطر"}</button>
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
                <div className={`flex-1 flex items-center justify-between p-3 rounded-xl border-2 transition-all ${deleteMode ? "border-rose-300 bg-rose-50" : priced ? "border-emerald-800 bg-emerald-900 text-white" : "border-slate-200 bg-white hover:border-amber-400 shadow-sm"}`}>
                  <div className="flex-1">
                    <p className="text-xs font-black">{p?.line} {p?.pricedBy && ` (بواسطة: ${p.pricedBy})`}</p>
                    {findPreparerName(p?.assignedPreparerId) || p?.assignedPreparerName ? (
                      <p className="text-[10px] text-slate-500">مخصص لـ {findPreparerName(p?.assignedPreparerId) || p?.assignedPreparerName}</p>
                    ) : (
                      <p className="text-[10px] text-slate-500">بدون تخصيص</p>
                    )}
                    {priced && <p className="text-[10px] text-emerald-300 font-mono">شراء: {p?.buyAlf} | بيع: {p?.sellAlf}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => deleteMode ? setProducts(products.filter((_, idx) => idx !== i)) : setEditingIndex(isEditing ? null : i)}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg px-2 text-sm transition-all"
                    >
                      {deleteMode ? "❌" : priced ? "✅" : "⚙️"}
                    </button>
                  </div>
                </div>
              </div>

              {isEditing && !deleteMode && (
                <div className="mt-2 bg-white p-4 rounded-xl border-2 border-amber-400 grid grid-cols-2 gap-3 shadow-inner animate-in slide-in-from-top-2">
                  <input type="text" value={p?.line} onChange={(e) => updateProduct(i, "line", e.target.value)} className="col-span-2 border-b-2 border-slate-100 p-1 text-sm font-black outline-none" />
                  <label className="flex flex-col"><span className="text-[10px] font-bold text-slate-400">شراء</span><input type="text" inputMode="decimal" value={p?.buyAlf ?? ""} onChange={(e) => updateProduct(i, "buyAlf", e.target.value)} className="rounded-lg border border-slate-200 p-2 text-sm font-black font-mono bg-slate-50 outline-none focus:ring-2 focus:ring-amber-200" autoFocus /></label>
                  <label className="flex flex-col"><span className="text-[10px] font-bold text-slate-400">بيع</span><input type="text" inputMode="decimal" value={p?.sellAlf ?? ""} onChange={(e) => updateProduct(i, "sellAlf", e.target.value)} className="rounded-lg border border-slate-200 p-2 text-sm font-black font-mono bg-slate-50 outline-none focus:ring-2 focus:ring-amber-200" /></label>
                  <div className="col-span-2 flex items-center gap-2">
                    <input type="checkbox" id={`priced-${i}`} checked={!!p?.pricedBy} onChange={(e) => updateProduct(i, "pricedBy", e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                    <label htmlFor={`priced-${i}`} className="text-[10px] font-bold text-slate-600">سعر من قبل الإدارة</label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedProductIndexes.length > 0 && (
        <div className="mt-4 p-3 bg-white rounded-xl border-2 border-sky-200 shadow-sm animate-in slide-in-from-bottom-2">
          <p className="text-xs font-black text-slate-700 mb-2">اختر مجهزاً للمنتجات المحددة ({selectedProductIndexes.length}):</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {preparers.map((prep) => (
              <button
                key={prep.id}
                type="button"
                onClick={() => assignSelectedProductsToPreparer(prep.id)}
                className="min-h-[44px] rounded-xl border-2 px-3 py-2 text-sm font-black transition-all hover:bg-sky-50"
              >
                {prep.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-600">عدد المحلات</span>
            <input
              type="number"
              min="1"
              value={placesCount}
              onChange={(e) => setPlacesCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="rounded-lg border border-slate-200 px-2 py-2 text-sm font-black outline-none bg-slate-50"
            />
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={toggleSelectAllProducts} className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100">
              {selectedProductIndexes.length === products.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-2 bg-emerald-50 p-3 rounded-xl border-2 border-emerald-200">
        <div className="flex justify-between items-center">
          <span className="text-xs font-black text-emerald-900">المجموع الفرعي:</span>
          <span className="text-xs font-black text-emerald-900">{totals.subtotal.toFixed(2)} </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs font-black text-emerald-900">المجموع الكلي:</span>
          <span className="text-xs font-black text-emerald-900">{totals.total.toFixed(2)} </span>
        </div>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="productsJson" value={JSON.stringify(products)} />
        <input type="hidden" name="placesCount" value={String(placesCount)} />
        <input type="hidden" name="isDraft" value={String(!!isDraft)} />
        <input type="hidden" name="shopId" value={selectedShopId} />

        {state.error && <p className="text-xs text-rose-600 font-bold p-2 bg-rose-50 rounded-lg border border-rose-200">{state.error}</p>}

        <div className="grid gap-2">
          <button
            type="submit"
            name="submitType"
            value="save"
            disabled={pending}
            className="w-full rounded-xl bg-amber-500 py-3.5 text-sm font-black text-white shadow-lg active:scale-95 disabled:opacity-50 transition-all hover:bg-amber-600"
          >
            {pending ? "جارٍ الحفظ..." : "💾 حفظ التقدم"}
          </button>

          {canSubmitFinal && (
            <button
              type="submit"
              name="submitType"
              value="final_send"
              disabled={pending}
              className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-lg active:scale-95 disabled:opacity-50 transition-all hover:bg-emerald-700"
            >
              {pending ? "جارٍ الإرسال..." : "✅ إرسال نهائي"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
