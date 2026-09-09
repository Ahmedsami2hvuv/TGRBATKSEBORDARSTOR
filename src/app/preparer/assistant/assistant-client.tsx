"use client";

import { useEffect, useState, useMemo } from "react";

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
  regionId?: string | null;
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

type ActiveTab = "orders_couriers" | "new_order" | "pricing";

export function AssistantClient({ initialPreparer, initialPreparerId }: Props) {
  const [preparerId, setPreparerId] = useState(initialPreparerId || "");
  const [preparer, setPreparer] = useState(initialPreparer);
  const [activeTab, setActiveTab] = useState<ActiveTab>("orders_couriers");

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [couriers, setCouriers] = useState<CourierItem[]>([]);
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [regions, setRegions] = useState<RegionItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // حالات نافذة الإسناد السريع للمندوب
  const [assignModalOrder, setAssignModalOrder] = useState<OrderItem | null>(null);
  const [courierSearchQuery, setCourierSearchQuery] = useState("");

  // حالات رفع طلب جديد
  const [shopSearchQuery, setShopSearchQuery] = useState("");
  const [selectedShop, setSelectedShop] = useState<ShopItem | null>(null);
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const [newOrderType, setNewOrderType] = useState("عادي");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newOrderSubtotalAlf, setNewOrderSubtotalAlf] = useState("");
  const [newOrderTime, setNewOrderTime] = useState("فوري");
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [newDeliveryPriceAlf, setNewDeliveryPriceAlf] = useState("");
  const [isPrepaidAll, setIsPrepaidAll] = useState(false);
  const [isReverseOrder, setIsReverseOrder] = useState(false);
  const [newNotes, setNewNotes] = useState("");
  const [newImageBase64, setNewImageBase64] = useState<string | null>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // حالات التسعير
  const [selectedPricingOrderId, setSelectedPricingOrderId] = useState<string | null>(null);
  const [pricingInputs, setPricingInputs] = useState<Record<string, { buy: string; actualBuy: string }>>({});
  const [savingProdKey, setSavingProdKey] = useState<string | null>(null);
  const [savedProdKey, setSavedProdKey] = useState<string | null>(null);

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
        if (data.preparer) {
          setPreparer(data.preparer);
          try {
            if (typeof window !== "undefined" && (window as any).AndroidAssistant?.setPreparerName) {
              (window as any).AndroidAssistant.setPreparerName(data.preparer.name);
            }
          } catch (e) {}
        }
        if (!selectedPricingOrderId && data.orders?.length > 0) {
          setSelectedPricingOrderId(data.orders[0].id);
        }
      }
    } catch (err) {
      setStatusMsg({ text: "تعذر الاتصال بالخادم لجلب البيانات.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (preparer?.name && typeof window !== "undefined") {
      try {
        if ((window as any).AndroidAssistant?.setPreparerName) {
          (window as any).AndroidAssistant.setPreparerName(preparer.name);
        }
      } catch (e) {}
    }
  }, [preparer]);

  useEffect(() => {
    if (preparerId) {
      fetchAssistantData(preparerId);
    }
  }, [preparerId]);

  // إسناد المندوب للطلب فوراً
  async function handleAssignCourier(order: OrderItem, courier: CourierItem) {
    setActionLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/preparer/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_courier",
          preparerId,
          orderId: order.id,
          courierId: courier.id,
          isDraft: order.isDraft,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: data.message || `تم إسناد الطلب إلى ${courier.name} ✓`, type: "success" });
        setAssignModalOrder(null);
        fetchAssistantData();
      } else {
        setStatusMsg({ text: data.error || "فشل إسناد المندوب", type: "error" });
      }
    } catch (e) {
      setStatusMsg({ text: "خطأ في الاتصال أثناء الإسناد", type: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  // إجراء "أعطيت"
  async function handleActionGiven(order: OrderItem) {
    setActionLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/preparer/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "action_given",
          preparerId,
          orderId: order.id,
          isDraft: order.isDraft,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: data.message || "تم تسجيل (أعطيت للمندوب) بنجاح ✓", type: "success" });
        fetchAssistantData();
      } else {
        setStatusMsg({ text: data.error || "فشل تسجيل الإجراء", type: "error" });
      }
    } catch (e) {
      setStatusMsg({ text: "خطأ في الاتصال بالخادم", type: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  // إجراء "أخذت"
  async function handleActionTaken(order: OrderItem) {
    setActionLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/preparer/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "action_taken",
          preparerId,
          orderId: order.id,
          isDraft: order.isDraft,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: data.message || "تم تسجيل (أخذت من المحل) بنجاح ✓", type: "success" });
        fetchAssistantData();
      } else {
        setStatusMsg({ text: data.error || "فشل تسجيل الإجراء", type: "error" });
      }
    } catch (e) {
      setStatusMsg({ text: "خطأ في الاتصال بالخادم", type: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  // اختيار المنطقة عند رفع طلب جديد وحساب سعر التوصيل الافتراضي
  function handleRegionChange(regId: string) {
    setSelectedRegionId(regId);
    const reg = regions.find((r) => r.id === regId);
    if (reg && reg.deliveryPrice) {
      const dPrice = typeof reg.deliveryPrice === "object" ? Number(reg.deliveryPrice) : Number(reg.deliveryPrice);
      if (!isNaN(dPrice) && dPrice > 0) {
        setNewDeliveryPriceAlf(String(dPrice / 1000));
      }
    }
  }

  // رفع صورة الطلب كـ Base64
  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewImageBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  // رفع الطلب الجديد
  async function handleCreateOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedShop) {
      setStatusMsg({ text: "يرجى اختيار المحل أولاً", type: "error" });
      return;
    }
    if (!newCustomerPhone || newCustomerPhone.trim().length < 8) {
      setStatusMsg({ text: "يرجى إدخال رقم هاتف الزبون بشكل صحيح", type: "error" });
      return;
    }
    if (!selectedRegionId) {
      setStatusMsg({ text: "يرجى اختيار المنطقة", type: "error" });
      return;
    }

    setSubmittingOrder(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/preparer/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_order",
          preparerId,
          shopId: selectedShop.id,
          orderType: newOrderType,
          customerPhone: newCustomerPhone,
          orderSubtotalAlf: newOrderSubtotalAlf,
          orderTime: newOrderTime,
          regionId: selectedRegionId,
          deliveryPriceAlf: newDeliveryPriceAlf,
          prepaidAll: isPrepaidAll,
          isReverseOrder: isReverseOrder,
          imageBase64: newImageBase64,
          notes: newNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: data.message || `تم رفع الطلب بنجاح برقم #${data.orderNumber} ✓`, type: "success" });
        setSelectedShop(null);
        setShopSearchQuery("");
        setNewCustomerPhone("");
        setNewOrderSubtotalAlf("");
        setNewOrderTime("فوري");
        setSelectedRegionId("");
        setNewDeliveryPriceAlf("");
        setIsPrepaidAll(false);
        setIsReverseOrder(false);
        setNewNotes("");
        setNewImageBase64(null);
        fetchAssistantData();
      } else {
        setStatusMsg({ text: data.error || "فشل رفع الطلب", type: "error" });
      }
    } catch (err) {
      setStatusMsg({ text: "خطأ في الاتصال أثناء رفع الطلب", type: "error" });
    } finally {
      setSubmittingOrder(false);
    }
  }

  // حفظ سعر المادة في تبويب التسعير
  async function handleSaveProductPrice(order: OrderItem, prod: ProductItem, buyVal: string, actualBuyVal: string) {
    if (!buyVal || isNaN(Number(buyVal))) return;
    const key = `${order.id}-${prod.originalIndex}`;
    setSavingProdKey(key);
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
        setSavedProdKey(key);
        setTimeout(() => setSavedProdKey(null), 2500);
      }
    } catch (err) {
      console.error("Save price failed:", err);
    } finally {
      setSavingProdKey(null);
    }
  }

  // فلترة المحلات للبحث
  const filteredShops = useMemo(() => {
    if (!shopSearchQuery.trim()) return shops.slice(0, 10);
    const q = shopSearchQuery.toLowerCase().trim();
    return shops.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 15);
  }, [shops, shopSearchQuery]);

  // فلترة المناديب للبحث
  const filteredCouriers = useMemo(() => {
    if (!courierSearchQuery.trim()) return couriers;
    const q = courierSearchQuery.toLowerCase().trim();
    return couriers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
  }, [couriers, courierSearchQuery]);

  // الطلب المحدد في شاشة التسعير
  const selectedPricingOrder = orders.find((o) => o.id === selectedPricingOrderId) || orders[0] || null;

  return (
    <div className="flex flex-col h-full min-h-[520px] max-w-lg mx-auto bg-neutral-950 text-neutral-100 font-sans select-none overflow-hidden pb-4" dir="rtl">
      {/* شريط التبويبات الرئيسي */}
      <div className="grid grid-cols-3 p-1.5 bg-neutral-900 border-b border-neutral-800/80 text-xs font-medium gap-1 sticky top-0 z-10">
        <button
          onClick={() => setActiveTab("orders_couriers")}
          className={`py-2 px-1 rounded-lg text-center transition flex flex-col items-center gap-1 ${
            activeTab === "orders_couriers"
              ? "bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40"
              : "text-neutral-400 hover:bg-neutral-800/60"
          }`}
        >
          <span className="text-sm">🛵</span>
          <span>الطلبات والمناديب</span>
        </button>

        <button
          onClick={() => setActiveTab("new_order")}
          className={`py-2 px-1 rounded-lg text-center transition flex flex-col items-center gap-1 ${
            activeTab === "new_order"
              ? "bg-blue-500/20 text-blue-400 font-bold border border-blue-500/40"
              : "text-neutral-400 hover:bg-neutral-800/60"
          }`}
        >
          <span className="text-sm">➕</span>
          <span>طلب جديد</span>
        </button>

        <button
          onClick={() => setActiveTab("pricing")}
          className={`py-2 px-1 rounded-lg text-center transition flex flex-col items-center gap-1 ${
            activeTab === "pricing"
              ? "bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40"
              : "text-neutral-400 hover:bg-neutral-800/60"
          }`}
        >
          <span className="text-sm">🏷️</span>
          <span>تسعير المواد</span>
        </button>
      </div>

      {/* رسالة التنبيه / النجاح */}
      {statusMsg && (
        <div
          className={`mx-3 mt-2.5 p-2.5 rounded-lg text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200 ${
            statusMsg.type === "success"
              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
              : "bg-rose-950/80 text-rose-300 border border-rose-800/60"
          }`}
        >
          <span>{statusMsg.text}</span>
          <button
            onClick={() => setStatusMsg(null)}
            className="text-neutral-400 hover:text-white px-1 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* المحتوى حسب التبويب */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400 text-xs gap-2">
            <span className="text-2xl animate-spin">⏳</span>
            <span>جاري تحميل البيانات...</span>
          </div>
        ) : null}

        {/* 1. تبويب الطلبات والمناديب (إسناد وحركات) */}
        {activeTab === "orders_couriers" && (
          <div className="space-y-2.5">
            {orders.length === 0 && !loading && (
              <div className="text-center py-12 text-neutral-500 text-xs bg-neutral-900/40 rounded-xl border border-neutral-800">
                لا توجد طلبات معلقة حالياً.
              </div>
            )}

            {orders.map((order) => {
              const hasCourier = Boolean(order.courier);
              const isDelivering = order.status === "delivering";

              return (
                <div
                  key={order.id}
                  className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3 shadow-sm hover:border-neutral-700 transition"
                >
                  {/* رأس الكرت: رقم الطلب + المندوب + الحالة */}
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800/60 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-amber-400">
                        #{order.orderNumber}
                      </span>
                      {order.isDraft && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-purple-950 text-purple-300 rounded border border-purple-800/40">
                          مسودة
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasCourier ? (
                        <span className="text-[11px] bg-blue-950/70 text-blue-300 px-2 py-0.5 rounded-md border border-blue-800/40 flex items-center gap-1">
                          🛵 {order.courier?.name}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">
                          غير مسند
                        </span>
                      )}

                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          isDelivering
                            ? "bg-amber-950 text-amber-300 border border-amber-800/40"
                            : "bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        {isDelivering ? "جارٍ التوصيل" : order.status}
                      </span>
                    </div>
                  </div>

                  {/* تفاصيل الكرت: المحل - المنطقة - الوقت */}
                  <div className="grid grid-cols-3 gap-1 text-[11px] text-neutral-300 mb-3 bg-neutral-950/50 p-2 rounded-lg border border-neutral-800/50">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-neutral-500">المحل</span>
                      <span className="font-medium truncate" title={order.shopName}>
                        🏬 {order.shopName}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[9px] text-neutral-500">المنطقة</span>
                      <span className="font-medium truncate" title={order.regionName}>
                        📍 {order.regionName}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[9px] text-neutral-500">الوقت</span>
                      <span className="font-medium truncate" title={order.orderTime}>
                        ⏰ {order.orderTime}
                      </span>
                    </div>
                  </div>

                  {/* الأزرار الثلاثة المطلوبة */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {/* زر إسناد */}
                    <button
                      onClick={() => {
                        setAssignModalOrder(order);
                        setCourierSearchQuery("");
                      }}
                      disabled={actionLoading}
                      className="py-1.5 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                    >
                      <span>🛵</span>
                      <span>إسناد</span>
                    </button>

                    {/* زر أعطيت */}
                    <button
                      onClick={() => handleActionGiven(order)}
                      disabled={actionLoading}
                      className="py-1.5 px-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                    >
                      <span>📦</span>
                      <span>أعطيت</span>
                    </button>

                    {/* زر أخذت */}
                    <button
                      onClick={() => handleActionTaken(order)}
                      disabled={actionLoading}
                      className="py-1.5 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                    >
                      <span>💰</span>
                      <span>أخذت</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. تبويب رفع طلب جديد (مباشر وسلس داخل المساعد) */}
        {activeTab === "new_order" && (
          <form onSubmit={handleCreateOrderSubmit} className="space-y-3 bg-neutral-900/60 p-3.5 rounded-xl border border-neutral-800">
            <h3 className="text-xs font-bold text-blue-400 flex items-center gap-1.5 border-b border-neutral-800 pb-2">
              <span>➕</span>
              <span>رفع وتجهيز طلبية جديدة</span>
            </h3>

            {/* اختيار المحل مع بحث تلقائي ذكي */}
            <div className="space-y-1 relative">
              <label className="text-[11px] font-semibold text-neutral-300">
                اسم المحل <span className="text-rose-400">*</span>
              </label>

              {selectedShop ? (
                <div className="flex items-center justify-between bg-neutral-800 border border-blue-500/50 p-2 rounded-lg text-xs text-blue-300">
                  <span className="font-bold">🏬 {selectedShop.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShop(null);
                      setShopSearchQuery("");
                    }}
                    className="text-neutral-400 hover:text-white text-xs px-2 py-0.5 bg-neutral-700 rounded"
                  >
                    تغيير
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="اكتب أول أحرف من اسم المحل..."
                    value={shopSearchQuery}
                    onChange={(e) => {
                      setShopSearchQuery(e.target.value);
                      setIsShopDropdownOpen(true);
                    }}
                    onFocus={() => setIsShopDropdownOpen(true)}
                    className="w-full bg-neutral-950 border border-neutral-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-neutral-500 outline-none"
                  />

                  {isShopDropdownOpen && filteredShops.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl max-h-44 overflow-y-auto z-30 divide-y divide-neutral-800">
                      {filteredShops.map((shop) => (
                        <button
                          key={shop.id}
                          type="button"
                          onClick={() => {
                            setSelectedShop(shop);
                            setIsShopDropdownOpen(false);
                            if (shop.regionId && !selectedRegionId) {
                              handleRegionChange(shop.regionId);
                            }
                          }}
                          className="w-full text-right px-3 py-2 text-xs text-neutral-200 hover:bg-blue-600/20 hover:text-blue-300 transition flex items-center justify-between"
                        >
                          <span>🏬 {shop.name}</span>
                          <span className="text-[10px] text-neutral-500">اختر</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* نوع الطلب */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-300">نوع الطلب</label>
              <div className="grid grid-cols-4 gap-1">
                {["عادي", "فوري", "مجدول", "تجهيز"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewOrderType(type)}
                    className={`py-1.5 text-xs rounded-lg font-medium transition ${
                      newOrderType === type
                        ? "bg-blue-600 text-white font-bold"
                        : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* رقم هاتف الزبون */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-300">
                رقم هاتف الزبون <span className="text-rose-400">*</span>
              </label>
              <input
                type="tel"
                placeholder="07XXXXXXXXX"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-neutral-500 outline-none dir-ltr text-right"
              />
            </div>

            {/* سعر الطلب / المواد بالآلاف */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">سعر المواد (بالآلاف)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="مثال: 15"
                  value={newOrderSubtotalAlf}
                  onChange={(e) => setNewOrderSubtotalAlf(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-neutral-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">وقت الطلب</label>
                <input
                  type="text"
                  placeholder="فوري / عصراً..."
                  value={newOrderTime}
                  onChange={(e) => setNewOrderTime(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-neutral-500 outline-none"
                />
              </div>
            </div>

            {/* اختيار المنطقة وتعديل أجرة التوصيل */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">
                  المنطقة <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedRegionId}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white outline-none"
                >
                  <option value="">اختر المنطقة...</option>
                  {regions.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">أجرة التوصيل (آلاف)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="تلقائي"
                  value={newDeliveryPriceAlf}
                  onChange={(e) => setNewDeliveryPriceAlf(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-neutral-500 outline-none"
                />
              </div>
            </div>

            {/* أزرار التبديل: كلشي واصل + طلب عكسي */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-2 p-2 bg-neutral-950 border border-neutral-800 rounded-lg cursor-pointer hover:border-neutral-700 transition">
                <input
                  type="checkbox"
                  checked={isPrepaidAll}
                  onChange={(e) => setIsPrepaidAll(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-neutral-800 border-neutral-700 focus:ring-0"
                />
                <span className="text-xs text-neutral-300 font-medium">كلشي واصل</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-neutral-950 border border-neutral-800 rounded-lg cursor-pointer hover:border-neutral-700 transition">
                <input
                  type="checkbox"
                  checked={isReverseOrder}
                  onChange={(e) => setIsReverseOrder(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 bg-neutral-800 border-neutral-700 focus:ring-0"
                />
                <span className="text-xs text-neutral-300 font-medium">طلب عكسي</span>
              </label>
            </div>

            {/* ملاحظات */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-300">ملاحظات الطلب (اختياري)</label>
              <textarea
                rows={2}
                placeholder="تفاصيل إضافية أو عنوان دقيق..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-neutral-500 outline-none resize-none"
              />
            </div>

            {/* إرفاق صورة */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-300">صورة الطلب / الفاتورة</label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer py-2 px-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-xs text-neutral-300 text-center font-medium transition flex items-center justify-center gap-2">
                  <span>📷</span>
                  <span>{newImageBase64 ? "تغيير الصورة" : "التقاط أو رفع صورة"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </label>
                {newImageBase64 && (
                  <button
                    type="button"
                    onClick={() => setNewImageBase64(null)}
                    className="py-2 px-2.5 bg-rose-950 text-rose-300 border border-rose-800 rounded-lg text-xs"
                  >
                    حذف ✕
                  </button>
                )}
              </div>
              {newImageBase64 && (
                <div className="relative w-full h-24 rounded-lg overflow-hidden border border-neutral-700 mt-1">
                  <img src={newImageBase64} alt="Order preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* زر رفع الطلب */}
            <button
              type="submit"
              disabled={submittingOrder}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg transition active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submittingOrder ? (
                <>
                  <span className="animate-spin text-sm">⏳</span>
                  <span>جاري رفع الطلب...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>رفع الطلب الآن</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* 3. تبويب تسعير المواد الفوري */}
        {activeTab === "pricing" && (
          <div className="space-y-3">
            {/* اختيار الطلب للتسعير */}
            {orders.length > 1 && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-400">اختر الطلب للتسعير:</label>
                <select
                  value={selectedPricingOrderId || ""}
                  onChange={(e) => setSelectedPricingOrderId(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-neutral-200 outline-none"
                >
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.orderNumber} - {o.shopName} ({o.products.length} مواد)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedPricingOrder ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800 text-xs">
                  <div>
                    <span className="font-bold text-amber-400">طلب #{selectedPricingOrder.orderNumber}</span>
                    <span className="text-neutral-400 mr-2">🏬 {selectedPricingOrder.shopName}</span>
                  </div>
                  <span className="text-neutral-400 text-[11px]">📍 {selectedPricingOrder.regionName}</span>
                </div>

                {selectedPricingOrder.products.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 text-xs bg-neutral-900/30 rounded-lg">
                    لا توجد مواد مسندة لك في هذا الطلب.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedPricingOrder.products.map((prod) => {
                      const key = `${selectedPricingOrder.id}-${prod.originalIndex}`;
                      const currentInput = pricingInputs[key] || {
                        buy: prod.buyAlf != null && prod.buyAlf !== "" ? String(prod.buyAlf) : "",
                        actualBuy: prod.actualBuyAlf != null && prod.actualBuyAlf !== "" ? String(prod.actualBuyAlf) : "",
                      };
                      const isSaving = savingProdKey === key;
                      const isSaved = savedProdKey === key;

                      return (
                        <div
                          key={prod.originalIndex}
                          className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-3 space-y-2.5 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold text-neutral-100 flex-1 leading-snug">
                              • {prod.line}
                            </span>
                            {isSaved ? (
                              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-1.5 py-0.5 rounded animate-pulse">
                                تم الحفظ ✓
                              </span>
                            ) : prod.isPriced ? (
                              <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">
                                مسعر
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800/50">
                                غير مسعر
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {/* سعر الشراء (سعر السوق/الفاتورة) */}
                            <div className="space-y-1">
                              <span className="text-[10px] text-neutral-400 font-medium">سعر الشراء (الفاتورة)</span>
                              <input
                                type="number"
                                step="any"
                                placeholder="مثال: 10"
                                value={currentInput.buy}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPricingInputs((prev) => ({
                                    ...prev,
                                    [key]: { ...currentInput, buy: val },
                                  }));
                                }}
                                onBlur={() => {
                                  if (currentInput.buy) {
                                    handleSaveProductPrice(
                                      selectedPricingOrder,
                                      prod,
                                      currentInput.buy,
                                      currentInput.actualBuy
                                    );
                                  }
                                }}
                                className="w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-lg p-2 text-xs text-white font-bold outline-none"
                              />
                            </div>

                            {/* سعر المحفظة الفعلي بعد الخصم */}
                            <div className="space-y-1">
                              <span className="text-[10px] text-emerald-400 font-medium">سعر الخصم (للمحفظة)</span>
                              <input
                                type="number"
                                step="any"
                                placeholder="مثال: 9"
                                value={currentInput.actualBuy}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPricingInputs((prev) => ({
                                    ...prev,
                                    [key]: { ...currentInput, actualBuy: val },
                                  }));
                                }}
                                onBlur={() => {
                                  if (currentInput.buy) {
                                    handleSaveProductPrice(
                                      selectedPricingOrder,
                                      prod,
                                      currentInput.buy,
                                      currentInput.actualBuy
                                    );
                                  }
                                }}
                                className="w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-lg p-2 text-xs text-emerald-300 font-bold outline-none"
                              />
                            </div>
                          </div>

                          {/* سعر البيع للزبون + زر الحفظ */}
                          <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 text-xs">
                            <div className="text-[11px] text-neutral-400">
                              سعر البيع المقترح:{" "}
                              <span className="text-amber-400 font-bold">
                                {prod.sellAlf ? `${prod.sellAlf} ألف` : "—"}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (currentInput.buy) {
                                  handleSaveProductPrice(
                                    selectedPricingOrder,
                                    prod,
                                    currentInput.buy,
                                    currentInput.actualBuy
                                  );
                                }
                              }}
                              disabled={isSaving || !currentInput.buy}
                              className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition active:scale-95 disabled:opacity-40"
                            >
                              {isSaving ? "جاري الحفظ..." : "حفظ السعر"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-500 text-xs bg-neutral-900/40 rounded-xl border border-neutral-800">
                لا توجد طلبات لتسعيرها حالياً.
              </div>
            )}
          </div>
        )}
      </div>

      {/* منبثق إسناد المندوب السريع (Modal) */}
      {assignModalOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-2xl p-4 space-y-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-xs font-bold text-neutral-200">
                إسناد طلب #{assignModalOrder.orderNumber} لمندوب
              </span>
              <button
                onClick={() => setAssignModalOrder(null)}
                className="text-neutral-400 hover:text-white text-xs px-2 py-0.5 bg-neutral-800 rounded"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="ابحث عن اسم المندوب..."
              value={courierSearchQuery}
              onChange={(e) => setCourierSearchQuery(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-neutral-500 outline-none"
            />

            <div className="max-h-56 overflow-y-auto space-y-1.5 divide-y divide-neutral-800/40">
              {filteredCouriers.length === 0 ? (
                <div className="text-center py-6 text-neutral-500 text-xs">لا يوجد مندوب مطابق.</div>
              ) : (
                filteredCouriers.map((courier) => (
                  <button
                    key={courier.id}
                    onClick={() => handleAssignCourier(assignModalOrder, courier)}
                    disabled={actionLoading}
                    className="w-full text-right p-2 text-xs text-neutral-200 hover:bg-blue-600/20 hover:text-blue-300 rounded-lg transition flex items-center justify-between active:scale-98"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold">🛵 {courier.name}</span>
                      {courier.phone && <span className="text-[10px] text-neutral-400">{courier.phone}</span>}
                    </div>
                    <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded">
                      إسناد فوري
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
