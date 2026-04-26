"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CartPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCart(JSON.parse(localStorage.getItem("kse_cart") || "[]"));
  }, []);

  function updateQty(id: string, delta: number) {
    const next = cart.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    });
    setCart(next);
    localStorage.setItem("kse_cart", JSON.stringify(next));
    window.dispatchEvent(new Event("cart-updated"));
  }

  function removeItem(id: string) {
    const next = cart.filter(item => item.id !== id);
    setCart(next);
    localStorage.setItem("kse_cart", JSON.stringify(next));
    window.dispatchEvent(new Event("cart-updated"));
  }

  const subtotal = cart.reduce((acc, item) => acc + (Number(item.price || 0) * (item.quantity || 1)), 0);

  if (!mounted) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <h1 className="text-3xl font-black text-slate-900">سلة التسوق</h1>

      {cart.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
          <div className="text-6xl mb-4">🛒</div>
          <p className="text-slate-500 font-bold mb-6">سلتك فارغة حالياً</p>
          <Link href="/store" className="inline-flex px-8 py-3 bg-violet-600 text-white font-black rounded-2xl hover:bg-violet-700 transition">
            ابدأ التسوق الآن
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 shrink-0">
                  {item.photo ? <img src={item.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">📦</div>}
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-slate-900">{item.name}</h3>
                  {item.isCustom ? (
                    <p className="text-amber-600 font-bold text-sm">يتم التسعير عند التجهيز</p>
                  ) : (
                    <p className="text-violet-600 font-bold">{Number(item.price).toLocaleString()} د.ع</p>
                  )}
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl">
                  <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-slate-600">-</button>
                  <span className="font-black w-4 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-slate-600">+</button>
                </div>
                <button onClick={() => removeItem(item.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition">🗑️</button>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-xl shadow-slate-200">
            <div className="flex justify-between items-center mb-6">
              <span className="text-slate-400 font-bold">المجموع الفرعي</span>
              <span className="text-2xl font-black">{subtotal.toLocaleString()} د.ع</span>
            </div>
            <Link
              href="/store/checkout"
              className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-center block hover:bg-violet-400 hover:text-white transition-all transform active:scale-95"
            >
              إتمام الطلب
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
