"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { submitStoreOrder } from "../actions";
import Link from "next/link";

export default function CheckoutPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [mounted, setMounted] = useState(false);
  const [state, action] = useFormState(submitStoreOrder, {});

  useEffect(() => {
    setMounted(true);
    setCart(JSON.parse(localStorage.getItem("kse_cart") || "[]"));

    // Fetch regions from API
    fetch("/api/regions")
      .then(res => res.json())
      .then(data => setRegions(data))
      .catch(err => console.error("Failed to fetch regions", err));
  }, []);

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const selectedRegion = regions.find(r => r.id === selectedRegionId);
  const deliveryPrice = selectedRegion ? Number(selectedRegion.deliveryPrice) : 0;
  const total = subtotal + deliveryPrice;

  if (!mounted) return null;

  if (state.ok) {
    // Clear cart on success
    if (typeof window !== "undefined") {
      localStorage.removeItem("kse_cart");
      window.dispatchEvent(new Event("cart-updated"));
    }
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-6">
        <div className="text-8xl animate-bounce">🎉</div>
        <h1 className="text-4xl font-black text-slate-900">شكراً لطلبك!</h1>
        <p className="text-xl text-slate-600 font-bold">رقم طلبك هو: <span className="text-violet-600">#{state.orderNumber}</span></p>
        <p className="text-slate-500 font-bold">سيتم التواصل معك قريباً لتأكيد الطلب والتوصيل.</p>
        <Link href="/store" className="inline-block px-10 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-violet-600 transition shadow-xl">
          العودة للمتجر
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-black text-slate-900 mb-8">إتمام الطلب</h1>

      <form action={action} className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <input type="hidden" name="cart" value={JSON.stringify(cart)} />

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center text-sm">1</span>
              معلومات الاتصال
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">رقم الهاتف</label>
                <input
                  name="phone"
                  type="tel"
                  required
                  className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition"
                  placeholder="07XXXXXXXXX"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center text-sm">2</span>
              العنوان والتوصيل
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">المنطقة</label>
                <select
                  name="regionId"
                  required
                  value={selectedRegionId}
                  onChange={(e) => setSelectedRegionId(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition appearance-none"
                >
                  <option value="">اختر منطقتك...</option>
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({(Number(r.deliveryPrice) / 1000).toLocaleString()} ألف)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">أقرب نقطة دالة</label>
                <textarea
                  name="landmark"
                  className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition"
                  placeholder="مثال: قرب مدرسة ... أو خلف جامع ..."
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 h-fit">
          <div className="bg-slate-900 text-white p-10 rounded-[4rem] shadow-2xl shadow-violet-200/20">
            <h2 className="text-2xl font-black mb-8">ملخص الطلب</h2>

            <div className="space-y-4 mb-8">
              {cart.map(item => {
                const itemTotal = (item.price * item.quantity);
                return (
                  <div key={item.id} className="flex justify-between items-center text-slate-400">
                    <span className="font-bold">{item.name} × {item.quantity}</span>
                    <span className="font-black text-white">{(itemTotal / 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ألف</span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-800 pt-6 space-y-4">
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-bold">المجموع الفرعي</span>
                <span className="font-black text-white">{(subtotal / 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ألف</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-bold">سعر التوصيل</span>
                <span className="font-black text-white">{(deliveryPrice / 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ألف</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <span className="text-xl font-black text-violet-400">الإجمالي</span>
                <span className="text-3xl font-black text-white">{(total / 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ألف</span>
              </div>
            </div>

            {state.error && (
              <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm font-bold text-center">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              className="w-full mt-10 py-5 bg-violet-600 text-white rounded-[2rem] font-black text-xl hover:bg-violet-500 transition-all transform active:scale-95 shadow-xl shadow-violet-900/40"
            >
              تأكيد وإرسال الطلب
            </button>
            <p className="text-center text-[10px] text-slate-500 mt-6 font-bold">بالنقر على تأكيد الطلب، فإنك توافق على شروط الخدمة وسياسة الخصوصية.</p>
          </div>
        </div>
      </form>
    </div>
  );
}
