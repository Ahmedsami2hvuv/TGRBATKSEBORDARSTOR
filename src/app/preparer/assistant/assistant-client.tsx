"use client";

import { useEffect, useState, useTransition } from "react";
import { parseQuantityFromLine } from "@/lib/site-order-parse";

type ProductItem = {
  originalIndex: number;
  line: string;
  buyAlf: number | string;
  actualBuyAlf: number | string;
  sellAlf: number | string;
  assignedPreparerId: string | null;
  assignedPreparerName: string | null;
  isPriced: boolean;
};

type OrderItem = {
  id: string;
  orderNumber: number;
  isDraft: boolean;
  title: string;
  regionName: string;
  orderTime: string;
  shopName: string;
  status: string;
  products: ProductItem[];
  totalProductsCount: number;
  myProductsCount: number;
};

type Props = {
  initialPreparer: { id: string; name: string; active: boolean } | null;
  initialPreparerId: string;
};

export function AssistantClient({ initialPreparer, initialPreparerId }: Props) {
  const [preparerId, setPreparerId] = useState(initialPreparerId || "");
  const [preparer, setPreparer] = useState(initialPreparer);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingItemIndex, setSavingItemIndex] = useState<number | null>(null);
  const [savedSuccessIndex, setSavedSuccessIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // استرجاع معرف المجهز من التخزين المحلي إن لم يكن ممرراً
  useEffect(() => {
    if (!preparerId && typeof window !== "undefined") {
      const saved = localStorage.getItem("preparer_id") || "";
      if (saved) setPreparerId(saved);
    }
  }, [preparerId]);

  async function fetchAssistantData(idToUse?: string) {
    const id = idToUse || preparerId;
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/preparer/assistant?preparerId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
      } else {
        setOrders(data.orders || []);
        if (data.preparer) setPreparer(data.preparer);
        if (!selectedOrderId && data.orders?.length > 0) {
          setSelectedOrderId(data.orders[0].id);
        }
      }
    } catch (err) {
      setErrorMsg("تعذر الاتصال بالخادم لجلب الطلبات.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (preparerId) {
      fetchAssistantData(preparerId);
    }
  }, [preparerId]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0] || null;

  async function handleAutoSave(
    order: OrderItem,
    prod: ProductItem,
    buyVal: string,
    actualBuyVal: string
  ) {
    if (!buyVal || isNaN(Number(buyVal))) return;

    setSavingItemIndex(prod.originalIndex);
    try {
      const res = await fetch("/api/preparer/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preparerId,
          orderId: order.id,
          isDraft: order.isDraft,
          originalIndex: prod.originalIndex,
          buyAlf: buyVal,
          actualBuyAlf: actualBuyVal,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // تحديث الحالة محلياً فوراً
        setOrders((prev) =>
          prev.map((ord) => {
            if (ord.id !== order.id) return ord;
            return {
              ...ord,
              products: ord.products.map((p) => {
                if (p.originalIndex !== prod.originalIndex) return p;
                return {
                  ...p,
                  buyAlf: data.buyAlf,
                  actualBuyAlf: data.actualBuyAlf ?? "",
                  sellAlf: data.sellAlf,
                  isPriced: true,
                };
              }),
            };
          })
        );
        setSavedSuccessIndex(prod.originalIndex);
        setTimeout(() => setSavedSuccessIndex(null), 2000);
      }
    } catch (err) {
      console.error("Auto save failed:", err);
    } finally {
      setSavingItemIndex(null);
    }
  }

  function handleCopyOrderText() {
    if (!selectedOrder) return;
    const lines = [
      `طلب #${selectedOrder.orderNumber} - ${selectedOrder.title}`,
      `المنطقة: ${selectedOrder.regionName}`,
      `الوقت: ${selectedOrder.orderTime}`,
      `--- المنتجات ---`,
      ...selectedOrder.products.map((p) => `• ${p.line} ${p.isPriced ? `(شراء: ${p.buyAlf}${p.actualBuyAlf ? ` | خصم: ${p.actualBuyAlf}` : ""})` : "[غير مسعر]"}`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }

  if (!preparerId && !preparer) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-4 text-center">
        <h2 className="text-lg font-black text-amber-400">مساعد المجهز الذكي 🪄</h2>
        <p className="text-xs text-slate-400">الرجاء إدخال معرف المجهز الخاص بك للبدء:</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="معرف المجهز..."
            className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
            onChange={(e) => setPreparerId(e.target.value.trim())}
          />
          <button
            onClick={() => fetchAssistantData()}
            className="rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 text-sm transition"
          >
            دخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-3 pb-16">
      {/* شريط المساعد العلوي */}
      <header className="flex items-center justify-between bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-base shadow-inner">
            🪄
          </div>
          <div>
            <h1 className="text-sm font-black text-white">المساعد الذكي للمجهز</h1>
            <p className="text-[10px] font-bold text-slate-400">
              {preparer?.name ? `المجهز: ${preparer.name}` : "تسعير فوري وحفظ تلقائي"}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchAssistantData()}
          disabled={loading}
          className="rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 active:scale-95 disabled:opacity-50"
        >
          <span>🔄</span>
          <span>{loading ? "تحديث..." : "تحديث"}</span>
        </button>
      </header>

      {errorMsg && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-xs font-bold text-rose-300 text-center">
          {errorMsg}
        </div>
      )}

      {/* قائمة الطلبات المسندة (اختيار الطلب) */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-300">الطلبات المسندة لك ({orders.length}):</span>
          {selectedOrder && (
            <button
              onClick={handleCopyOrderText}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition flex items-center gap-1"
            >
              <span>{copyFeedback ? "✓ تم النسخ!" : "📋 نسخ القائمة"}</span>
            </button>
          )}
        </div>

        {orders.length === 0 && !loading ? (
          <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs font-bold">
            🎉 لا توجد طلبات مسندة لك حالياً بحاجة لتجهيز.
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {orders.map((ord) => {
              const unpricedCount = ord.products.filter((p) => !p.isPriced).length;
              const isSelected = selectedOrderId === ord.id;
              return (
                <button
                  key={ord.id}
                  onClick={() => setSelectedOrderId(ord.id)}
                  className={`shrink-0 flex flex-col items-start p-2.5 rounded-2xl border text-right transition active:scale-95 min-w-[140px] max-w-[180px] ${
                    isSelected
                      ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono text-xs font-black text-amber-400">
                      #{ord.orderNumber}
                    </span>
                    {unpricedCount > 0 ? (
                      <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded-full">
                        {unpricedCount} غير مسعر
                      </span>
                    ) : (
                      <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded-full">
                        ✓ مسعر بالكامل
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-white truncate w-full mt-1">
                    {ord.regionName}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate w-full">
                    ⏰ {ord.orderTime}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* المنتجات الخاصة بالطلب المختار والتسعير التلقائي */}
      {selectedOrder && (
        <section className="bg-slate-900/80 rounded-2xl border border-slate-800 p-3 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h2 className="text-xs font-black text-white flex items-center gap-1.5">
                <span>📦 منتجات طلب #{selectedOrder.orderNumber}</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ({selectedOrder.products.length} مواد)
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                📍 {selectedOrder.regionName} | {selectedOrder.shopName}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {selectedOrder.products.map((prod) => (
              <ProductPricingCard
                key={`${selectedOrder.id}-${prod.originalIndex}`}
                product={prod}
                isSaving={savingItemIndex === prod.originalIndex}
                isSaved={savedSuccessIndex === prod.originalIndex}
                onSave={(buy, act) => handleAutoSave(selectedOrder, prod, buy, act)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProductPricingCard({
  product,
  isSaving,
  isSaved,
  onSave,
}: {
  product: ProductItem;
  isSaving: boolean;
  isSaved: boolean;
  onSave: (buyVal: string, actualBuyVal: string) => void;
}) {
  const [buyText, setBuyText] = useState(product.buyAlf !== "" ? String(product.buyAlf) : "");
  const [actText, setActText] = useState(product.actualBuyAlf !== "" ? String(product.actualBuyAlf) : "");

  useEffect(() => {
    setBuyText(product.buyAlf !== "" ? String(product.buyAlf) : "");
    setActText(product.actualBuyAlf !== "" ? String(product.actualBuyAlf) : "");
  }, [product.buyAlf, product.actualBuyAlf]);

  function triggerSave() {
    if (buyText.trim() !== "" && !isNaN(Number(buyText.trim()))) {
      onSave(buyText.trim(), actText.trim());
    }
  }

  const parsedQty = parseQuantityFromLine(product.line || "");

  return (
    <div
      className={`p-3 rounded-xl border transition-all ${
        product.isPriced
          ? "bg-slate-950/60 border-emerald-900/60"
          : "bg-slate-950 border-slate-800 hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-xs font-black text-white leading-snug">
            {product.line}
          </span>
          {parsedQty ? (
            <span className="shrink-0 text-[10px] font-black bg-rose-600/80 text-white px-1.5 py-0.2 rounded">
              ×{parsedQty}
            </span>
          ) : null}
        </div>
        <div className="shrink-0 flex items-center gap-1">
          {isSaving ? (
            <span className="text-[10px] font-bold text-amber-400 animate-pulse">جاري الحفظ...</span>
          ) : isSaved ? (
            <span className="text-[10px] font-black text-emerald-400">تم الحفظ ✓</span>
          ) : product.isPriced ? (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded">
              مسعر ✅
            </span>
          ) : (
            <span className="text-[10px] font-bold text-slate-500">غير مسعر</span>
          )}
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-1">
            سعر الشراء (للزبون):
          </label>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            placeholder="مثلاً 10"
            value={buyText}
            onChange={(e) => setBuyText(e.target.value)}
            onBlur={triggerSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") triggerSave();
            }}
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-center font-mono text-sm font-black text-white outline-none focus:border-amber-400 focus:bg-slate-800 transition"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-1">
            المدفوع بعد الخصم (محفظة):
          </label>
          <input
            type="text"
            inputMode="decimal"
            dir="ltr"
            placeholder="مثلاً 9 (اختياري)"
            value={actText}
            onChange={(e) => setActText(e.target.value)}
            onBlur={triggerSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") triggerSave();
            }}
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-center font-mono text-sm font-black text-amber-300 outline-none focus:border-amber-400 focus:bg-slate-800 transition"
          />
        </div>
      </div>
    </div>
  );
}
