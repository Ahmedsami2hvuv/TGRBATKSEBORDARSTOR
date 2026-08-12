"use client";

import { useState, useEffect } from "react";
import { ProductCard } from "../product-card";
import Link from "next/link";

export default function FavoritesPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFavorites() {
      try {
        const favorites = JSON.parse(localStorage.getItem("kse_favorites") || "[]");
        if (favorites.length === 0) {
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/store/favorites?ids=${favorites.join(",")}`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (error) {
        console.error("Error loading favorites:", error);
      } finally {
        setLoading(false);
      }
    }

    loadFavorites();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-24" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-rose-500 fill-rose-500" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <h1 className="text-2xl font-black text-slate-800">المفضلة</h1>
        </div>

        {loading ? (
          <div className="text-center py-20 animate-pulse">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-bold">جاري تحميل المفضلة...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="text-6xl mb-4">💔</div>
            <h2 className="text-xl font-black text-slate-800 mb-2">قائمة المفضلة فارغة</h2>
            <p className="text-slate-500 font-bold mb-6">لم تقم بإضافة أي منتجات للمفضلة بعد.</p>
            <Link href="/store" className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-xl font-black transition-colors">
              تصفح المنتجات
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
