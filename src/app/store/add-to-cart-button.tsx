"use client";

import { useState } from "react";
import { addToSharedCart } from "@/app/store/shared-actions";

export function AddToCartButton({ product }: { product: any }) {
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function addToCart(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (loading) return;

    try {
      const sharedCartId = localStorage.getItem("kse_active_shared_cart_id");
      const sharedUserName = localStorage.getItem("kse_shared_user_name") || "مستخدم مشترك";

      if (sharedCartId) {
        setLoading(true);
        const res = await addToSharedCart(sharedCartId, product, sharedUserName);
        setLoading(false);

        if (res.error) {
          alert(res.error);
          return;
        }

        window.dispatchEvent(new Event("cart-updated"));
        window.dispatchEvent(new CustomEvent("kse:shared-cart-updated"));
      } else {
        const cart = JSON.parse(localStorage.getItem("kse_cart") || "[]");

        // نستخدم المعرف الفريد للمنتج (مع المتغير إن وجد)
        const productId = product.id;
        const existingIndex = cart.findIndex((item: any) => item.id === productId);

        if (existingIndex > -1) {
          cart[existingIndex].quantity += 1;
        } else {
          cart.push({
            id: productId,
            productId: product.productId || product.id,
            supplierId: product.supplierId || null,
            name: product.name,
            price: Number(product.salePrice || product.price || 0),
            photo: (product.photoUrls?.[0] || product.photo || ""),
            quantity: 1
          });
        }

        localStorage.setItem("kse_cart", JSON.stringify(cart));

        // إطلاق كافة الأحداث لضمان المزامنة مع المساعد الذكي وواجهة المتجر
        window.dispatchEvent(new Event("cart-updated"));
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("kse:store-cart-changed", { detail: { cart } }));
      }

      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch (err) {
      console.error("Cart error:", err);
      setLoading(false);
    }
  }


  return (
    <button
      onClick={addToCart}
      className={`w-full py-3 rounded-2xl font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 transform active:scale-90 ${
        added
        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
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
  );
}
