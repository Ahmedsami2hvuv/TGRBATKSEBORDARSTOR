"use client";

import { useState, useTransition } from "react";
import { DebtItemClient } from "./debt-item-client";
import { hideOrderFromPreparerDebtsAction } from "../actions";

export function DebtListContainer({
  initialOrders,
  auth
}: {
  initialOrders: any[],
  auth: { p: string; exp: string; s: string }
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [selectedShopId, setSelectedShopId] = useState<string | "all">("all");
  const [isPending, startTransition] = useTransition();

  // استخراج المحلات الفريدة التي لها ديون حالياً
  const shopsMap = new Map();
  orders.forEach(o => {
    if (!shopsMap.has(o.shopId)) {
      shopsMap.set(o.shopId, o.shop.name);
    }
  });
  const uniqueShops = Array.from(shopsMap.entries()).map(([id, name]) => ({ id, name }));

  const filteredOrders = selectedShopId === "all"
    ? orders
    : orders.filter(o => o.shopId === selectedShopId);

  const handleHideOne = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const handleHideAllCurrent = () => {
    const currentIds = filteredOrders.map(o => o.id);
    if (currentIds.length === 0) return;

    if (!confirm("هل أنت متأكد من إخفاء كافة الديون المعروضة حالياً؟")) return;

    // إخفاء محلي فوري لراحة المستخدم
    setOrders(prev => prev.filter(o => !currentIds.includes(o.id)));

    startTransition(async () => {
      const fd = new FormData();
      fd.append("p", auth.p);
      fd.append("exp", auth.exp);
      fd.append("s", auth.s);
      fd.append("orderIds", currentIds.join(","));

      const res = await hideOrderFromPreparerDebtsAction(null, fd);
      if (res && res.error) {
        alert(res.error);
        window.location.reload();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* شريط الفلترة والأزرار الجماعية */}
      <div className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur-md pt-2 pb-4 -mx-4 px-4 border-b border-slate-200/50">
        <div className="flex overflow-x-auto gap-2 no-scrollbar mb-3">
          <button
            onClick={() => setSelectedShopId("all")}
            className={`shrink-0 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-sm ${
              selectedShopId === "all"
                ? "bg-indigo-600 text-white shadow-indigo-200"
                : "bg-white text-slate-500 border border-slate-200"
            }`}
          >
            الكل ({orders.length})
          </button>
          {uniqueShops.map(shop => {
              const count = orders.filter(o => o.shopId === shop.id).length;
              return (
                  <button
                  key={shop.id}
                  onClick={() => setSelectedShopId(shop.id)}
                  className={`shrink-0 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-sm ${
                      selectedShopId === shop.id
                      ? "bg-indigo-600 text-white shadow-indigo-200"
                      : "bg-white text-slate-500 border border-slate-200"
                  }`}
                  >
                  {shop.name} ({count})
                  </button>
              );
          })}
        </div>

        {filteredOrders.length > 0 && (
          <button
            onClick={handleHideAllCurrent}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-sm transition-all shadow-lg shadow-rose-100/50 active:scale-[0.99]"
          >
            <span>🚫</span>
            {selectedShopId === "all" 
              ? `إخفاء كافة الديون الحالية (${filteredOrders.length})`
              : `إخفاء كل ديون ${shopsMap.get(selectedShopId)} (${filteredOrders.length})`
            }
          </button>
        )}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white/50 backdrop-blur-sm rounded-[2rem] p-16 text-center text-slate-400 border-2 border-dashed border-slate-200">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-lg font-black">لا توجد ديون معروضة حالياً</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <DebtItemClient key={order.id} order={order} auth={auth} onHide={handleHideOne} />
          ))}
        </div>
      )}
    </div>
  );
}
