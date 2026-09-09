"use client";

import { useEffect, useState, useMemo } from "react";

// أيقونات SVG احترافية ونظيفة لواجهات الأعمال والتجهيز
function IconTruck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5v10" />
      <circle cx="6.5" cy="18.5" r="2.5" />
      <circle cx="16.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function IconPlus({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

function IconTag({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  );
}

function IconStore({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
    </svg>
  );
}

function IconMapPin({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconClock({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconUserCheck({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function IconPackageOut({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function IconHandTake({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconCamera({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

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
    <div className="flex flex-col h-full min-h-[520px] max-w-lg mx-auto bg-slate-950 text-slate-100 font-sans select-none overflow-hidden pb-4" dir="rtl">
      {/* شريط التبويبات الرئيسي بتصميم Segmented Control احترافي */}
      <div className="p-2 bg-slate-900 border-b border-slate-800 sticky top-0 z-20">
        <div className="grid grid-cols-3 bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
          <button
            onClick={() => setActiveTab("orders_couriers")}
            className={`py-2 px-1 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === "orders_couriers"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
            }`}
          >
            <IconTruck className="w-4 h-4" />
            <span>الطلبات</span>
          </button>

          <button
            onClick={() => setActiveTab("new_order")}
            className={`py-2 px-1 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === "new_order"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
            }`}
          >
            <IconPlus className="w-4 h-4" />
            <span>طلب جديد</span>
          </button>

          <button
            onClick={() => setActiveTab("pricing")}
            className={`py-2 px-1 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === "pricing"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
            }`}
          >
            <IconTag className="w-4 h-4" />
            <span>تسعير المواد</span>
          </button>
        </div>
      </div>

      {/* رسالة التنبيه / النجاح */}
      {statusMsg && (
        <div
          className={`mx-3 mt-2.5 p-2.5 rounded-lg text-xs flex items-center justify-between animate-in fade-in duration-150 ${
            statusMsg.type === "success"
              ? "bg-emerald-950/90 text-emerald-300 border border-emerald-800/70"
              : "bg-rose-950/90 text-rose-300 border border-rose-800/70"
          }`}
        >
          <span className="font-medium">{statusMsg.text}</span>
          <button
            onClick={() => setStatusMsg(null)}
            className="text-slate-400 hover:text-white px-1 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* المحتوى حسب التبويب */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs gap-2">
            <span className="w-5 h-5 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
            <span>جاري تحميل البيانات...</span>
          </div>
        ) : null}

        {/* 1. تبويب الطلبات والمناديب */}
        {activeTab === "orders_couriers" && (
          <div className="space-y-2.5">
            {orders.length === 0 && !loading && (
              <div className="text-center py-12 text-slate-400 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
                لا توجد طلبات معلقة حالياً.
              </div>
            )}

            {orders.map((order) => {
              const hasCourier = Boolean(order.courier);
              const isDelivering = order.status === "delivering";

              return (
                <div
                  key={order.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-sm hover:border-slate-700 transition"
                >
                  {/* رأس الكرت: رقم الطلب + المندوب + الحالة */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/70 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-sm text-slate-100">
                        #{order.orderNumber}
                      </span>
                      {order.isDraft && (
                        <span className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 rounded border border-slate-700">
                          مسودة
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasCourier ? (
                        <span className="text-[11px] bg-slate-800 text-slate-200 px-2 py-0.5 rounded-md border border-slate-700 flex items-center gap-1">
                          <IconTruck className="w-3 h-3 text-slate-400" />
                          <span>{order.courier?.name}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                          غير مسند
                        </span>
                      )}

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          isDelivering
                            ? "bg-blue-950 text-blue-300 border border-blue-800/50"
                            : "bg-slate-800 text-slate-300 border border-slate-700"
                        }`}
                      >
                        {isDelivering ? "جارٍ التوصيل" : order.status}
                      </span>
                    </div>
                  </div>

                  {/* تفاصيل الكرت: المحل - المنطقة - الوقت */}
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] text-slate-300 mb-3 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/60">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-500 font-medium">المحل</span>
                      <span className="font-medium truncate flex items-center gap-1" title={order.shopName}>
                        <IconStore className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{order.shopName}</span>
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-500 font-medium">المنطقة</span>
                      <span className="font-medium truncate flex items-center gap-1" title={order.regionName}>
                        <IconMapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{order.regionName}</span>
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-500 font-medium">الوقت</span>
                      <span className="font-medium truncate flex items-center gap-1" title={order.orderTime}>
                        <IconClock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{order.orderTime}</span>
                      </span>
                    </div>
                  </div>

                  {/* الأزرار الثلاثة العملية */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {/* زر إسناد */}
                    <button
                      onClick={() => {
                        setAssignModalOrder(order);
                        setCourierSearchQuery("");
                      }}
                      disabled={actionLoading}
                      className="py-2 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 shadow-sm"
                    >
                      <IconUserCheck className="w-3.5 h-3.5" />
                      <span>إسناد</span>
                    </button>

                    {/* زر أعطيت */}
                    <button
                      onClick={() => handleActionGiven(order)}
                      disabled={actionLoading}
                      className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 shadow-sm"
                    >
                      <IconPackageOut className="w-3.5 h-3.5 text-slate-300" />
                      <span>أعطيت</span>
                    </button>

                    {/* زر أخذت */}
                    <button
                      onClick={() => handleActionTaken(order)}
                      disabled={actionLoading}
                      className="py-2 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 shadow-sm"
                    >
                      <IconHandTake className="w-3.5 h-3.5" />
                      <span>أخذت</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. تبويب رفع طلب جديد */}
        {activeTab === "new_order" && (
          <form onSubmit={handleCreateOrderSubmit} className="space-y-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
              <IconPlus className="w-4 h-4 text-blue-500" />
              <span>تسجيل وتجهيز طلبية جديدة</span>
            </h3>

            {/* اختيار المحل مع بحث تلقائي */}
            <div className="space-y-1 relative">
              <label className="text-[11px] font-semibold text-slate-300">
                اسم المحل <span className="text-rose-400">*</span>
              </label>

              {selectedShop ? (
                <div className="flex items-center justify-between bg-slate-950 border border-blue-500/60 p-2 rounded-lg text-xs text-slate-100">
                  <span className="font-semibold flex items-center gap-1.5">
                    <IconStore className="w-3.5 h-3.5 text-blue-400" />
                    <span>{selectedShop.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShop(null);
                      setShopSearchQuery("");
                    }}
                    className="text-slate-400 hover:text-white text-xs px-2 py-0.5 bg-slate-800 rounded border border-slate-700"
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
                    className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-slate-500 outline-none"
                  />

                  {isShopDropdownOpen && filteredShops.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-44 overflow-y-auto z-30 divide-y divide-slate-800">
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
                          className="w-full text-right px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition flex items-center justify-between"
                        >
                          <span className="flex items-center gap-1.5">
                            <IconStore className="w-3.5 h-3.5 text-slate-400" />
                            <span>{shop.name}</span>
                          </span>
                          <span className="text-[10px] text-blue-400 font-medium">اختر</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* نوع الطلب */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">نوع الطلب</label>
              <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {["عادي", "فوري", "مجدول", "تجهيز"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewOrderType(type)}
                    className={`py-1.5 text-xs rounded font-medium transition ${
                      newOrderType === type
                        ? "bg-blue-600 text-white font-semibold shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* رقم هاتف الزبون */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">
                رقم هاتف الزبون <span className="text-rose-400">*</span>
              </label>
              <input
                type="tel"
                placeholder="07XXXXXXXXX"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-slate-500 outline-none dir-ltr text-right"
              />
            </div>

            {/* سعر الطلب / المواد بالآلاف */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">سعر المواد (بالآلاف)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="مثال: 15"
                  value={newOrderSubtotalAlf}
                  onChange={(e) => setNewOrderSubtotalAlf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">وقت الطلب</label>
                <input
                  type="text"
                  placeholder="فوري / عصراً..."
                  value={newOrderTime}
                  onChange={(e) => setNewOrderTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>
            </div>

            {/* اختيار المنطقة وتعديل أجرة التوصيل */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  المنطقة <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedRegionId}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white outline-none"
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
                <label className="text-[11px] font-semibold text-slate-300">أجرة التوصيل (آلاف)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="تلقائي"
                  value={newDeliveryPriceAlf}
                  onChange={(e) => setNewDeliveryPriceAlf(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>
            </div>

            {/* أزرار التبديل: كلشي واصل + طلب عكسي */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={isPrepaidAll}
                  onChange={(e) => setIsPrepaidAll(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-0"
                />
                <span className="text-xs text-slate-300 font-medium">كلشي واصل</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={isReverseOrder}
                  onChange={(e) => setIsReverseOrder(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-0"
                />
                <span className="text-xs text-slate-300 font-medium">طلب عكسي</span>
              </label>
            </div>

            {/* ملاحظات */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">ملاحظات الطلب (اختياري)</label>
              <textarea
                rows={2}
                placeholder="تفاصيل إضافية أو عنوان دقيق..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-slate-500 outline-none resize-none"
              />
            </div>

            {/* إرفاق صورة */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300">صورة الطلب / الفاتورة</label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-200 text-center font-medium transition flex items-center justify-center gap-2">
                  <IconCamera className="w-4 h-4 text-slate-400" />
                  <span>{newImageBase64 ? "تغيير الصورة" : "إرفاق صورة الفاتورة"}</span>
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
                    className="py-2 px-2.5 bg-rose-950 text-rose-300 border border-rose-800 rounded-lg text-xs font-medium"
                  >
                    حذف ✕
                  </button>
                )}
              </div>
              {newImageBase64 && (
                <div className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-700 mt-1">
                  <img src={newImageBase64} alt="Order preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* زر رفع الطلب */}
            <button
              type="submit"
              disabled={submittingOrder}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-xs shadow-md transition active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submittingOrder ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>جاري رفع الطلب...</span>
                </>
              ) : (
                <span>رفع وتأكيد الطلب</span>
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
                <label className="text-[11px] font-semibold text-slate-400">اختر الطلب للتسعير:</label>
                <select
                  value={selectedPricingOrderId || ""}
                  onChange={(e) => setSelectedPricingOrderId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
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
                <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 font-mono">#{selectedPricingOrder.orderNumber}</span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <IconStore className="w-3 h-3 text-slate-500" />
                      <span>{selectedPricingOrder.shopName}</span>
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <IconMapPin className="w-3 h-3 text-slate-500" />
                    <span>{selectedPricingOrder.regionName}</span>
                  </span>
                </div>

                {selectedPricingOrder.products.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs bg-slate-900/30 rounded-lg">
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
                          className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-100 flex-1 leading-snug">
                              {prod.line}
                            </span>
                            {isSaved ? (
                              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded font-medium">
                                تم الحفظ ✓
                              </span>
                            ) : prod.isPriced ? (
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                                مسعر
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded">
                                غير مسعر
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {/* سعر الشراء (سعر السوق/الفاتورة) */}
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-medium">سعر الشراء (الفاتورة)</span>
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
                                className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white font-bold outline-none"
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
                                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg p-2 text-xs text-emerald-300 font-bold outline-none"
                              />
                            </div>
                          </div>

                          {/* سعر البيع للزبون + زر الحفظ */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                            <div className="text-[11px] text-slate-400">
                              سعر البيع المقترح:{" "}
                              <span className="text-slate-200 font-semibold">
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
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-lg text-xs font-semibold transition active:scale-95 disabled:opacity-40"
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
              <div className="text-center py-12 text-slate-400 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
                لا توجد طلبات لتسعيرها حالياً.
              </div>
            )}
          </div>
        )}
      </div>

      {/* منبثق إسناد المندوب السريع (Modal) */}
      {assignModalOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-4 space-y-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-200">
                إسناد طلب #{assignModalOrder.orderNumber} لمندوب
              </span>
              <button
                onClick={() => setAssignModalOrder(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-0.5 bg-slate-800 rounded border border-slate-700"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="ابحث عن اسم المندوب..."
              value={courierSearchQuery}
              onChange={(e) => setCourierSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-slate-500 outline-none"
            />

            <div className="max-h-56 overflow-y-auto space-y-1.5 divide-y divide-slate-800/40">
              {filteredCouriers.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">لا يوجد مندوب مطابق.</div>
              ) : (
                filteredCouriers.map((courier) => (
                  <button
                    key={courier.id}
                    onClick={() => handleAssignCourier(assignModalOrder, courier)}
                    disabled={actionLoading}
                    className="w-full text-right p-2.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg transition flex items-center justify-between active:scale-98"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{courier.name}</span>
                      {courier.phone && <span className="text-[10px] text-slate-400">{courier.phone}</span>}
                    </div>
                    <span className="text-[10px] bg-blue-600 text-white font-medium px-2.5 py-1 rounded-md shadow-sm">
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
