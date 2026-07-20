"use client";

import { useState } from "react";

export function AddToCartButton({ product }: { product: any }) {
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  async function addToCart(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (loading) return;

    try {
      const cart = JSON.parse(localStorage.getItem("kse_cart") || "[]");

      // نستخدم المعرف الفريد للمنتج (مع المتغير إن وجد)
      const productId = product.id;
      const existingIndex = cart.findIndex((item: any) => item.id === productId);

      if (existingIndex > -1) {
        cart[existingIndex].quantity += quantity;
      } else {
        cart.push({
          id: productId,
          productId: product.productId || product.id,
          supplierId: product.supplierId || null,
          name: product.name,
          price: Number(product.salePrice || product.price || 0),
          photo: (product.photoUrls?.[0] || product.photo || ""),
          quantity: quantity
        });
      }

      localStorage.setItem("kse_cart", JSON.stringify(cart));

      // إطلاق كافة الأحداث لضمان Mزامنة مع المساعد الذكي وواجهة المتجر
      window.dispatchEvent(new Event("cart-updated"));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("kse:store-cart-changed", { detail: { cart } }));

      setAdded(true);
      setQuantity(1); // إعادة ضبط الكمية إلى 1 بعد الإضافة بنجاح
      setTimeout(() => setAdded(false), 1500);
    } catch (err) {
      console.error("Cart error:", err);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-2 w-full">
      {/* أزرار التحكم بالكمية */}
      <div className="flex items-center justify-between border border-slate-200 dark:border-slate-800 rounded-2xl p-0.5 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm w-full md:w-auto shrink-0 select-none">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (quantity > 1) {
              setQuantity(quantity - 1);
            }
          }}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-850 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-black text-sm transition-all active:scale-90"
        >
          -
        </button>
        <span className="w-8 text-center font-black text-xs md:text-sm text-slate-800 dark:text-slate-200">
          {quantity}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setQuantity(quantity + 1);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-850 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-black text-sm transition-all active:scale-90"
        >
          +
        </button>
      </div>

      {/* زر إضافة للسلة */}
      <button
        onClick={addToCart}
        className={`w-full md:flex-1 py-3 rounded-2xl font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 transform active:scale-90 ${
          added
            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-none"
            : "bg-slate-900 text-white hover:bg-violet-600 shadow-lg shadow-slate-200 dark:shadow-none"
        }`}
      >
        {added ? (
          <>
            <span className="animate-bounce">✅</span>
            تمت الإضافة
          </>
        ) : (
          <>
            <span>🛒</span>
            إضافة للسلة
          </>
        )}
      </button>
    </div>
  );
}
