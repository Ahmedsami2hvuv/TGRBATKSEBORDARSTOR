"use client";

import { useState } from "react";

export function AddToCartButton({ product, variant = "default" }: { product: any, variant?: "default" | "compact" }) {
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  async function addToCart(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (loading) return;

    try {
      const cart = JSON.parse(localStorage.getItem("kse_cart") || "[]");

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

      window.dispatchEvent(new Event("cart-updated"));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("kse:store-cart-changed", { detail: { cart } }));

      setAdded(true);
      setQuantity(1);

      // إطلاق حدث طيران الصورة
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const imageUrl = product.photoUrls?.[0] || product.photo || product.imageUrl || "";
      
      if (imageUrl) {
        window.dispatchEvent(new CustomEvent("kse:fly-to-cart", { 
           detail: { startX, startY, imageUrl } 
        }));
      }
      
      
      // إرسال تنبيه عائم
      window.dispatchEvent(new CustomEvent("kse:show-toast", { detail: { message: "عاشت ايدك، تمت الإضافة للسلة!", type: "success" } }));
      
      setTimeout(() => setAdded(false), 1500);
    } catch (err) {
      console.error("Cart error:", err);
      setLoading(false);
    }
  }

  if (variant === "compact") {
    return (
      <button
        onClick={addToCart}
        className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white transition-all transform active:scale-90 shadow-sm ${
          added ? "bg-emerald-500 scale-110" : "bg-green-500 hover:bg-green-600"
        }`}
      >
        {added ? (
          <span className="text-xs md:text-sm">✔</span>
        ) : (
          <span className="text-lg md:text-xl font-medium">+</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-2 w-full">
      {/* أزرار التحكم بالكمية */}
      <div className="flex items-center justify-between border border-slate-200 rounded-xl p-1 bg-white w-full md:w-32 shrink-0 select-none shadow-sm">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (quantity > 1) {
              setQuantity(quantity - 1);
            }
          }}
          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-800 text-lg transition-all active:scale-90"
        >
          -
        </button>
        <span className="w-8 text-center font-bold text-sm text-slate-800">
          {quantity}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setQuantity(quantity + 1);
          }}
          className="w-8 h-8 flex items-center justify-center text-green-500 hover:text-green-600 font-bold text-lg transition-all active:scale-90"
        >
          +
        </button>
      </div>

      {/* زر إضافة للسلة */}
      <button
        onClick={addToCart}
        className={`w-full md:flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 transform active:scale-90 ${
          added
            ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
            : "bg-green-500 text-white hover:bg-green-600 shadow-md shadow-green-200"
        }`}
      >
        {added ? (
          <>
            <span>✅</span>
            تمت الإضافة
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            أضف للسلة
          </>
        )}
      </button>
    </div>
  );
}
