"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ProductCard } from "@/app/store/product-card";

export function StoreSidePanels() {
  const [activePanel, setActivePanel] = useState<"cart" | "favorites" | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    const loadData = async () => {
      const savedCart = JSON.parse(localStorage.getItem("kse_cart") || "[]");
      setCart(savedCart);

      const favIds = JSON.parse(localStorage.getItem("kse_favorites") || "[]");
      if (favIds.length > 0) {
        try {
          const res = await fetch("/api/store/products?ids=" + favIds.join(","));
          if (res.ok) {
            const data = await res.json();
            setFavorites(data);
          }
        } catch (e) { console.error(e); }
      } else {
        setFavorites([]);
      }
    };

    loadData();

    const handleCartUpdate = () => {
      setCart(JSON.parse(localStorage.getItem("kse_cart") || "[]"));
    };

    const handleFavUpdate = () => {
      loadData();
    };

    window.addEventListener("cart-updated", handleCartUpdate);
    window.addEventListener("favorites-updated", handleFavUpdate);
    window.addEventListener("open-cart", () => setActivePanel("cart"));
    window.addEventListener("open-favorites", () => setActivePanel("favorites"));

    return () => {
      window.removeEventListener("cart-updated", handleCartUpdate);
      window.removeEventListener("favorites-updated", handleFavUpdate);
      window.removeEventListener("open-cart", () => setActivePanel("cart"));
      window.removeEventListener("open-favorites", () => setActivePanel("favorites"));
    };
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

  function removeCartItem(id: string) {
    const next = cart.filter(item => item.id !== id);
    setCart(next);
    localStorage.setItem("kse_cart", JSON.stringify(next));
    window.dispatchEvent(new Event("cart-updated"));
  }

  const subtotal = cart.reduce((acc, item) => acc + (Number(item.price || 0) * (item.quantity || 1)), 0);

  if (!isLoaded) return null;

  return (
    <>
      {/* Overlay */}
      {activePanel && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity animate-in fade-in"
          onClick={() => setActivePanel(null)}
        />
      )}

      {/* Side Panel */}
      <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-900 z-[101] shadow-2xl transform transition-transform duration-500 ease-out flex flex-col ${activePanel ? "translate-x-0" : "translate-x-full"}`} dir="rtl">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            {activePanel === "cart" ? (
              <><span className="text-violet-600">🛒</span> سلة التسوق</>
            ) : (
              <><span className="text-rose-500">❤️</span> المفضلات</>
            )}
          </h2>
          <button
            onClick={() => setActivePanel(null)}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activePanel === "cart" ? (
            cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="text-6xl mb-4 opacity-20">🛒</div>
                <p className="text-slate-500 font-bold">سلتك فارغة حالياً</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white shrink-0 shadow-sm">
                      {item.photo ? <img src={item.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-slate-900 dark:text-white truncate">{item.name}</h3>
                      <p className="text-violet-600 font-black text-sm">{Number(item.price).toLocaleString()} د.ع</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                      <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-violet-600 font-bold hover:bg-violet-50 rounded-md">+</button>
                      <span className="font-black text-xs">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-rose-500 font-bold hover:bg-rose-50 rounded-md">-</button>
                    </div>
                    <button onClick={() => removeCartItem(item.id)} className="p-2 text-rose-400 hover:text-rose-600">🗑️</button>
                  </div>
                ))}
              </div>
            )
          ) : (
            favorites.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="text-6xl mb-4 opacity-20">❤️</div>
                <p className="text-slate-500 font-bold">قائمة المفضلات فارغة</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {favorites.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )
          )}
        </div>

        {activePanel === "cart" && cart.length > 0 && (
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-500 font-bold">المجموع</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{subtotal.toLocaleString()} د.ع</span>
            </div>
            <Link
              href="/store/checkout"
              onClick={() => setActivePanel(null)}
              className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black text-center block hover:bg-violet-700 shadow-xl shadow-violet-200 dark:shadow-none transition-all"
            >
              إتمام الطلب
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
