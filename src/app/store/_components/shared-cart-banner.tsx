"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSharedCart } from "@/app/store/shared-actions";

export function SharedCartBanner() {
  const router = useRouter();
  const [activeCartId, setActiveCartId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string>("");
  const [itemsCount, setItemsCount] = useState<number>(0);

  useEffect(() => {
    // نقوم بفحص السلة المشتركة بشكل دوري
    const checkActiveCart = async () => {
      const cartId = localStorage.getItem("kse_active_shared_cart_id");
      if (cartId) {
        setActiveCartId(cartId);
        const res = await getSharedCart(cartId);
        if (res.ok && res.cart) {
          setOwnerName(res.cart.ownerName);
          const items = Array.isArray(res.cart.items) ? res.cart.items : [];
          const count = items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
          setItemsCount(count);
        }
      } else {
        setActiveCartId(null);
      }
    };

    checkActiveCart();
    
    // نستمع للأحداث المحلية
    window.addEventListener("cart-updated", checkActiveCart);
    window.addEventListener("kse:shared-cart-updated", checkActiveCart);
    
    return () => {
      window.removeEventListener("cart-updated", checkActiveCart);
      window.removeEventListener("kse:shared-cart-updated", checkActiveCart);
    };
  }, []);

  function handleLeave() {
    if (confirm("هل أنت متأكد من مغادرة السلة المشتركة والعودة للتسوق الفردي؟")) {
      localStorage.removeItem("kse_active_shared_cart_id");
      localStorage.removeItem("kse_shared_user_name");
      setActiveCartId(null);
      window.dispatchEvent(new Event("cart-updated"));
      router.refresh();
    }
  }

  if (!activeCartId) return null;

  return (
    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs md:text-sm font-black py-2.5 px-4 shadow-inner">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="animate-pulse">🟢</span>
          <span>أنت تتسوق الآن لصالح السلة المشتركة لـ <b>{ownerName}</b> ({itemsCount} منتج)</span>
        </div>
        
        <div className="flex items-center gap-3">
          <Link 
            href={`/store/shared-cart?code=${activeCartId}`}
            className="px-3 py-1 bg-white text-violet-700 rounded-lg hover:bg-violet-50 transition font-black"
          >
            عرض السلة المشتركة 👥
          </Link>
          <button 
            onClick={handleLeave}
            className="text-white hover:text-rose-200 transition"
          >
            خروج 🚪
          </button>
        </div>
      </div>
    </div>
  );
}
