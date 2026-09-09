"use client";

import { useEffect, useState } from "react";
import { parseQuantityFromLine } from "@/lib/auto-pricing";

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
  regionId: string | null;
  orderTime: string;
  customerPhone: string;
  customerName: string;
  shopName: string;
  shopId?: string;
  status: string;
  courier: { id: string; name: string; phone: string | null } | null;
  products: ProductItem[];
  totalProductsCount: number;
  myProductsCount: number;
};

type CourierItem = {
  id: string;
  name: string;
  phone: string | null;
};

type ShopItem = {
  id: string;
  name: string;
};

type RegionItem = {
  id: string;
  name: string;
  deliveryPrice: any;
};

type Props = {
  initialPreparer: { id: string; name: string; active: boolean } | null;
  initialPreparerId: string;
};

type ActiveTab = "home" | "pricing" | "assign_courier" | "new_order" | "wallet";

export function AssistantClient({ initialPreparer, initialPreparerId }: Props) {
  const [preparerId, setPreparerId] = useState(initialPreparerId || "");
  const [preparer, setPreparer] = useState(initialPreparer);
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [couriers, setCouriers] = useState<CourierItem[]>([]);
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [regions, setRegions] = useState<RegionItem[]>([]);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [savingItemIndex, setSavingItemIndex] = useState<number | null>(null);
  const [savedSuccessIndex, setSavedSuccessIndex] = useState<number | null>(null);
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
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/preparer/assistant?preparerId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.error) {
        setStatusMsg({ text: data.error, type: "error" });
      } else {
        setOrders(data.orders || []);
        setCouriers(data.couriers || []);
        setShops(data.shops || []);
        setRegions(data.regions || []);
        if (data.preparer) setPreparer(data.preparer);
        if (!selectedOrderId && data.orders?.length > 0) {
          setSelectedOrderId(data.orders[0].id);
        }
      }
    } catch (err) {
      setStatusMsg({ text: "تعذر الاتصال بالخادم لجلب الطلبات.", type: "error" });
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

  async function handleAutoSavePrice(
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
          action: "save_price",
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

  async function handleAssignCourier(orderId: string, isDraft: boolean, courierId: string) {
    if (!courierId) return;
    setActionLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/preparer/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_courier",
          preparerId,
          orderId,
          courierId,
          isDraft,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: data.message || "تم إسناد المندوب بنجاح ✓", type: "success" });
        fetchAssistantData();
      } else {
        setStatusMsg({ text: data.error || "فشل إسناد المندوب", type: "error" });
      }
    } catch (e) {
      setStatusMsg({ text: "خطأ في الاتصال بالخادم", type: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateOrderStatus(orderId: string, newStatus: string) {
    setActionLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/preparer/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_order_status",
          preparerId,
          orderId,
          newStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: data.message || "تم تحديث الحالة بنجاح ✓", type: "success" });
        fetchAssistantData();
      } else {
        setStatusMsg({ text: data.error || "فشل تحديث الحالة", type: "error" });
      }
    } catch (e) {
      setStatusMsg({ text: "خطأ في الاتصال بالخادم", type: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  function handleCopyOrderText() {
    if (!selectedOrder) return;
    const lines = [
      `طلب #${selectedOrder.orderNumber} - ${selectedOrder.title}`,
      `المنطقة: ${selectedOrder.regionName}`,
      `الوقت: ${selectedOrder.orderTime}`,
      `--- المنتجات ---`,
      ...selectedOrder.products.map(
        (p) =>
          `• ${p.line} ${
            p.isPriced
              ? `(شراء: ${p.buyAlf}${p.actualBuyAlf ? ` | خصم: ${p.actualBuyAlf}` : ""})`
              : "[غير مسعر]"
          }`
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }

  if (!preparerId && !preparer) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-4 text-center">
        <div className="text-3xl">🪄</div>
        <h2 className="text-lg font-black text-amber-400">مساعد المجهز الذكي</h2>
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
    <div className="max-w-lg mx-auto space-y-3 pb-16 font-sans select-none" dir="rtl">
      {/* شريط المساعد العلوي */}
      <header className="flex items-center justify-between bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("home")}
            className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-base shadow-inner hover:bg-amber-500/30 transition"
            title="الرئيسية"
          >
            🪄
          </button>
          <div>
            <h1 className="text-sm font-black text-white">مساعد المجهز الذكي</h1>
            <p className="text-[10px] font-bold text-amber-400/90">
              {preparer?.name ? `المجهز: ${preparer.name}` : "لوحة التحكم السريعة"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fetchAssistantData()}
            disabled={loading}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 text-xs font-bold transition flex items-center gap-1 active:scale-95 disabled:opacity-50"
          >
            <span>🔄</span>
            <span>{loading ? "جاري..." : "تحديث"}</span>
          </button>
        </div>
      </header>

      {/* شريط التبويبات السريعة */}
      <nav className="grid grid-cols-4 gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveTab("home")}
          className={`py-2 px-1 rounded-xl text-[11px] font-black transition flex flex-col items-center gap-0.5 ${
            activeTab === "home" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          <span>🏠</span>
          <span>الخيارات</span>
        </button>
        <button
          onClick={() => setActiveTab("pricing")}
          className={`py-2 px-1 rounded-xl text-[11px] font-black transition flex flex-col items-center gap-0.5 ${
            activeTab === "pricing" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          <span>📦</span>
          <span>التسعير</span>
        </button>
        <button
          onClick={() => setActiveTab("assign_courier")}
          className={`py-2 px-1 rounded-xl text-[11px] font-black transition flex flex-col items-center gap-0.5 ${
            activeTab === "assign_courier" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          <span>🛵</span>
          <span>المندوب</span>
        </button>
        <button
          onClick={() => setActiveTab("new_order")}
          className={`py-2 px-1 rounded-xl text-[11px] font-black transition flex flex-col items-center gap-0.5 ${
            activeTab === "new_order" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          <span>➕</span>
          <span>طلب جديد</span>
        </button>
      </nav>

      {/* رسائل التنبيه والنجاح */}
      {statusMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-bold text-center border animate-in fade-in ${
            statusMsg.type === "success"
              ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
              : "bg-rose-950/60 border-rose-800 text-rose-300"
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. التبويب الرئيسي: الخيارات الشاملة للمساعد */}
      {/* ======================================================== */}
      {activeTab === "home" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            {/* خيار 1: فتح طلبات التجهيز وتسعير كل منتج */}
            <button
              onClick={() => setActiveTab("pricing")}
              className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950/60 border border-indigo-500/30 hover:border-indigo-400 text-right space-y-1.5 transition active:scale-95 shadow-lg group"
            >
              <div className="h-9 w-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-lg font-black group-hover:scale-110 transition">
                📦
              </div>
              <h3 className="text-xs font-black text-white">طلبات التجهيز</h3>
              <p className="text-[10px] text-slate-400 leading-snug">
                تسعير كل منتج بسهولة مع الحفظ التلقائي الفوري.
              </p>
              <span className="inline-block text-[9px] font-black text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded-md">
                {orders.length} طلبات متاحة
              </span>
            </button>

            {/* خيار 2: فتح طلبات المحلات وإسنادها للمندوب */}
            <button
              onClick={() => setActiveTab("assign_courier")}
              className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-amber-950/60 border border-amber-500/30 hover:border-amber-400 text-right space-y-1.5 transition active:scale-95 shadow-lg group"
            >
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg font-black group-hover:scale-110 transition">
                🛵
              </div>
              <h3 className="text-xs font-black text-white">إسناد لمندوب</h3>
              <p className="text-[10px] text-slate-400 leading-snug">
                إسناد الطلبات لمندوب، وتسجيل حركات التسليم والاستلام.
              </p>
              <span className="inline-block text-[9px] font-black text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-md">
                {couriers.length} مناديب متاحين
              </span>
            </button>

            {/* خيار 3: رفع طلب جديد من محل معين */}
            <button
              onClick={() => setActiveTab("new_order")}
              className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950/60 border border-emerald-500/30 hover:border-emerald-400 text-right space-y-1.5 transition active:scale-95 shadow-lg group"
            >
              <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg font-black group-hover:scale-110 transition">
                ➕
              </div>
              <h3 className="text-xs font-black text-white">رفع طلب من محل</h3>
              <p className="text-[10px] text-slate-400 leading-snug">
                لصق قائمة وتجهيز طلب سريع من أي محل مرتبط بك.
              </p>
              <span className="inline-block text-[9px] font-black text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-md">
                {shops.length} محلات مرتبطة
              </span>
            </button>

            {/* خيار 4: فتح المحفظة والحسابات */}
            <a
              href={`/preparer/wallet?p=${encodeURIComponent(preparerId)}`}
              className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-sky-950/60 border border-sky-500/30 hover:border-sky-400 text-right space-y-1.5 transition active:scale-95 shadow-lg group block"
            >
              <div className="h-9 w-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-lg font-black group-hover:scale-110 transition">
                💰
              </div>
              <h3 className="text-xs font-black text-white">المحفظة والديون</h3>
              <p className="text-[10px] text-slate-400 leading-snug">
                عرض رصيدك، استحقاقات المشتريات، ودفتر الحسابات.
              </p>
              <span className="inline-block text-[9px] font-black text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded-md">
                فتح المحفظة ↗
              </span>
            </a>
          </div>

          {/* روابط سريعة للموقع والتطبيق الكامل */}
          <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
            <span className="text-[11px] font-black text-slate-300 block">روابط الواجهة الكاملة:</span>
            <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
              <a
                href={`/preparer/preparation?p=${encodeURIComponent(preparerId)}`}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                تجهيز الطلبات الكامل 📋
              </a>
              <a
                href={`/preparer?p=${encodeURIComponent(preparerId)}`}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                لوحة المجهز الرئيسية 🏢
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. تبويب: تسعير كل منتج في الطلبات المسندة */}
      {/* ======================================================== */}
      {activeTab === "pricing" && (
        <div className="space-y-3">
          {/* اختيار الطلب المسند */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black text-slate-300">الطلبات المسندة للتسعير ({orders.length}):</span>
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
                            ✓ مسعر
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

          {/* قائمة المنتجات والتسعير السريع */}
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
                <a
                  href={`/preparer/preparation?p=${encodeURIComponent(preparerId)}`}
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300"
                >
                  فتح في التجهيز ↗
                </a>
              </div>

              <div className="space-y-2.5">
                {selectedOrder.products.map((prod) => (
                  <ProductPricingCard
                    key={`${selectedOrder.id}-${prod.originalIndex}`}
                    product={prod}
                    isSaving={savingItemIndex === prod.originalIndex}
                    isSaved={savedSuccessIndex === prod.originalIndex}
                    onSave={(buy, act) => handleAutoSavePrice(selectedOrder, prod, buy, act)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. تبويب: إسناد الطلبات لمندوب وتحديث الحركات */}
      {/* ======================================================== */}
      {activeTab === "assign_courier" && (
        <div className="space-y-3">
          <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-xs font-black text-white">إسناد وتحديث حركات الطلبات للمناديب:</h2>

            {orders.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">لا توجد طلبات نشطة حالياً.</p>
            ) : (
              <div className="space-y-2.5">
                {orders.map((ord) => (
                  <div key={ord.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-amber-400">
                        طلب #{ord.orderNumber} ({ord.shopName})
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        الحالة: {ord.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      📍 {ord.regionName} | ⏰ {ord.orderTime}
                    </p>

                    {/* المندوب المسند حالياً */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400 text-[11px]">المندوب الحالي:</span>
                      <span className="font-bold text-white text-[11px]">
                        {ord.courier?.name ? `🛵 ${ord.courier.name}` : "لم يتم إسناد مندوب"}
                      </span>
                    </div>

                    {/* اختيار المندوب للإسناد */}
                    <div className="flex gap-1.5 pt-1">
                      <select
                        defaultValue={ord.courier?.id || ""}
                        onChange={(e) => handleAssignCourier(ord.id, ord.isDraft, e.target.value)}
                        disabled={actionLoading}
                        className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                      >
                        <option value="">اختر مندوب للإسناد...</option>
                        {couriers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* أزرار الحركات السريعة */}
                    {!ord.isDraft && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, "delivering")}
                          disabled={actionLoading}
                          className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black transition disabled:opacity-50"
                        >
                          🛵 أعطيت للمندوب
                        </button>
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, "processing")}
                          disabled={actionLoading}
                          className="py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black transition disabled:opacity-50"
                        >
                          📦 استلمت من المحل
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. تبويب: رفع طلب جديد من محل */}
      {/* ======================================================== */}
      {activeTab === "new_order" && (
        <div className="space-y-3">
          <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-xs font-black text-white">رفع طلب جديد من محل:</h2>
            <p className="text-[10px] text-slate-400">
              يمكنك رفع طلب جديد وتجهيزه مباشرة من المحلات المخصصة لك:
            </p>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-300">المحل المجهز منه:</label>
              <select className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white outline-none focus:border-amber-400">
                {shops.length === 0 ? (
                  <option value="">لا توجد محلات مسندة</option>
                ) : (
                  shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="pt-2">
              <a
                href={`/preparer/order/new?p=${encodeURIComponent(preparerId)}`}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95"
              >
                <span>➕</span>
                <span>فتح شاشة رفع وتجهيز الطلب الجديد</span>
              </a>
            </div>
          </div>
        </div>
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
