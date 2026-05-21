"use client";

import { useState } from "react";
import { DebtItemClient } from "./debt-item-client";

export function DebtListContainer({
  initialOrders,
  auth
}: {
  initialOrders: any[],
  auth: { p: string; exp: string; s: string }
}) {
  const [selectedShopId, setSelectedShopId] = useState<string | "all">("all");

  // استخراج المحلات الفريدة التي لها ديون حالياً
  const shopsMap = new Map();
  initialOrders.forEach(o => {
    if (!shopsMap.has(o.shopId)) {
      shopsMap.set(o.shopId, o.shop.name);
    }
  });
  const uniqueShops = Array.from(shopsMap.entries()).map(([id, name]) => ({ id, name }));

  const filteredOrders = selectedShopId === "all"
    ? initialOrders
    : initialOrders.filter(o => o.shopId === selectedShopId);

  return (
    <div className="space-y-6">
      {/* شريط الفلترة */}
      <div className="flex overflow-x-auto pb-4 gap-2 no-scrollbar -mx-4 px-4 sticky top-0 z-30 bg-slate-50/80 backdrop-blur-md pt-2">
        <button
          onClick={() => setSelectedShopId("all")}
          className={`shrink-0 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-sm ${
            selectedShopId === "all"
              ? "bg-indigo-600 text-white shadow-indigo-200"
              : "bg-white text-slate-500 border border-slate-200"
          }`}
        >
          الكل ({initialOrders.length})
        </button>
        {uniqueShops.map(shop => {
            const count = initialOrders.filter(o => o.shopId === shop.id).length;
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

      {filteredOrders.length === 0 ? (
        <div className="bg-white/50 backdrop-blur-sm rounded-[2rem] p-16 text-center text-slate-400 border-2 border-dashed border-slate-200">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-lg font-black">لا توجد ديون لهذا المحل</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <DebtItemClient key={order.id} order={order} auth={auth} />
          ))}
        </div>
      )}
    </div>
  );
}
