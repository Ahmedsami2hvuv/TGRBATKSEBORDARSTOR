"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // جلب الطلبات المخزنة في المتصفح
    const storedOrders = JSON.parse(localStorage.getItem("kse_orders") || "[]");
    setOrders(storedOrders.reverse()); // نعكس الترتيب ليكون الأحدث أولاً
  }, []);

  if (!mounted) return <div className="p-8 text-center text-slate-500">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-slate-800">طلباتي</h1>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-10 text-center shadow-sm border border-slate-100 flex flex-col items-center justify-center">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-5xl mb-4">
            📦
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">لا توجد طلبات سابقة</h2>
          <p className="text-sm text-slate-500 mb-6">لم تقم بإجراء أي طلبات حتى الآن من المتصفح الحالي.</p>
          <Link href="/store" className="bg-green-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-green-600 transition-colors">
            تصفح المتجر
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order, index) => (
            <div key={index} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-xl">
                    🛍️
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800">رقم الطلب #{order.orderNumber || "غير معروف"}</h3>
                    <p className="text-xs text-slate-400">{new Date(order.date).toLocaleDateString("ar-IQ")}</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold">
                  مكتمل
                </div>
              </div>
              
              <div className="space-y-2">
                {order.items && order.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-bold">{item.name}</span>
                    <span className="text-slate-500">الكمية: {item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
