"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // جلب الطلبات المخزنة في المتصفح
    const storedOrders = JSON.parse(localStorage.getItem("kse_orders") || "[]");
    setOrders(storedOrders.reverse()); // نعكس الترتيب ليكون الأحدث أولاً
  }, []);

  const handleRepeatOrder = (items: any[]) => {
    if (!items || items.length === 0) return;
    localStorage.setItem("kse_cart", JSON.stringify(items));
    window.dispatchEvent(new Event("cart-updated"));
    router.push("/store/cart");
  };

  const handleAddMoreToOrder = (orderId: string) => {
    // حفظ الـ ID الخاص بالطلب ليتم الإضافة عليه في السلة
    localStorage.setItem("kse_add_to_order_id", orderId);
    // توجيه الزبون للمتجر لإضافة منتجات
    router.push("/store");
  };

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
              
              <div className="space-y-2 mb-4">
                {order.items && order.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                    <span className="text-slate-600 font-bold">{item.name}</span>
                    <span className="text-slate-500">الكمية: {item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => handleRepeatOrder(order.items)}
                  className="w-1/2 py-3 bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  تكرار الطلب
                </button>

                {/* يظهر هذا الزر لإضافة منتجات لطلبية سابقة (نفترض أن الطلبات خلال 24 ساعة قابلة للتعديل) */}
                {Date.now() - new Date(order.date).getTime() < 24 * 60 * 60 * 1000 && (
                  <button 
                    onClick={() => handleAddMoreToOrder(order.id)}
                    className="w-1/2 py-3 bg-green-50 text-green-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-green-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    إضافة منتجات
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
