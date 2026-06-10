"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSharedCart } from "@/app/store/shared-actions";

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [sharing, setSharing] = useState(false);

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

  async function handleCreateSharedCart(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim()) return;

    setSharing(true);
    const res = await createSharedCart(ownerName.trim(), JSON.stringify(cart));
    setSharing(false);

    if (res.error) {
      alert(res.error);
      return;
    }

    if (res.cartId) {
      localStorage.setItem("kse_active_shared_cart_id", res.cartId);
      localStorage.setItem("kse_shared_user_name", ownerName.trim());
      // نقوم بإفراغ السلة المحلية لأنها تحولت إلى سلة مشتركة
      localStorage.setItem("kse_cart", "[]");
      window.dispatchEvent(new Event("cart-updated"));
      router.push(`/store/shared-cart?code=${res.cartId}`);
    }
  }

  const subtotal = cart.reduce((acc, item) => acc + (Number(item.price || 0) * (item.quantity || 1)), 0);

  if (!mounted) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <h1 className="text-3xl font-black text-slate-900 dark:text-white">سلة التسوق</h1>

      {cart.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
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
              <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 shrink-0">
                  {item.photo ? <img src={item.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">📦</div>}
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-slate-900 dark:text-white">{item.name}</h3>
                  {item.isCustom ? (
                    <p className="text-amber-600 font-bold text-sm">يتم التسعير عند التجهيز</p>
                  ) : (
                    <p className="text-violet-600 font-bold">{Number(item.price).toLocaleString()} د.ع</p>
                  )}
                </div>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl">
                  <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 rounded-lg shadow-sm font-bold text-slate-600">-</button>
                  <span className="font-black w-4 text-center">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 rounded-lg shadow-sm font-bold text-slate-600">+</button>
                </div>
                <button onClick={() => removeItem(item.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition">🗑️</button>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-xl shadow-slate-200 dark:shadow-none space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-bold">المجموع الفرعي</span>
              <span className="text-2xl font-black">{subtotal.toLocaleString()} د.ع</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setShowShareModal(true)}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-center transition flex items-center justify-center gap-2 border border-slate-700"
              >
                👥 مشاركة السلة مع العائلة
              </button>

              <Link
                href="/store/checkout"
                className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black text-center block transition transform active:scale-95 shadow-lg shadow-violet-800/40"
              >
                إتمام الطلب الفردي
              </Link>
            </div>
          </div>
        </>
      )}

      {/* مودال مشاركة السلة */}
      {showShareModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl max-w-md w-full space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-violet-100 dark:bg-violet-950 rounded-3xl flex items-center justify-center mx-auto text-3xl text-violet-600">
              👥
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">إنشاء سلة عائلية مشتركة</h3>
              <p className="text-slate-500 text-sm font-bold">
                يرجى كتابة اسمك كمالك للسلة، وسنقوم بتحويل سلتك الحالية إلى سلة مشتركة يمكنك مشاركتها مع عائلتك.
              </p>
            </div>

            <form onSubmit={handleCreateSharedCart} className="space-y-4">
              <input
                type="text"
                required
                placeholder="اكتب اسمك (مثال: أبو أحمد)..."
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-violet-600 outline-none font-bold text-slate-900 dark:text-white transition"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={sharing}
                  className="flex-1 py-4 bg-violet-600 text-white font-black rounded-2xl hover:bg-violet-700 transition disabled:opacity-50"
                >
                  {sharing ? "جاري الإنشاء..." : "إنشاء ومشاركة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

