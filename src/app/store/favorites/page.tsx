"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductCard } from "../product-card";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function loadFavs() {
      const favIds = JSON.parse(localStorage.getItem("kse_favorites") || "[]");
      if (favIds.length > 0) {
        // جلب تفاصيل المنتجات المفضلة مع التأكد من جلب المتغيرات (Variants)
        const res = await fetch("/api/store/products?ids=" + favIds.join(","));
        if (res.ok) {
           const data = await res.json();
           setFavorites(data);
        }
      }
    }
    loadFavs();

    // الاستماع لتحديثات المفضلة لإعادة تحميل الصفحة إذا تم الحذف
    const handleUpdate = () => {
      const favIds = JSON.parse(localStorage.getItem("kse_favorites") || "[]");
      if (favIds.length === 0) setFavorites([]);
      else loadFavs();
    };
    window.addEventListener("favorites-updated", handleUpdate);
    return () => window.removeEventListener("favorites-updated", handleUpdate);
  }, []);

  if (!mounted) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-4xl font-black text-slate-900 flex items-center gap-3">
          <span className="text-rose-500">❤️</span>
          قائمة مفضلاتي
        </h1>
        <Link
          href="/store"
          className="px-6 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-violet-50 hover:text-violet-600 transition-all text-sm"
        >
          العودة للتسوق
        </Link>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 shadow-inner">
          <div className="text-6xl mb-6">✨</div>
          <p className="text-slate-500 font-black text-lg mb-8">قائمة مفضلاتك فارغة حالياً</p>
          <Link href="/store" className="inline-flex px-10 py-4 bg-violet-600 text-white font-black rounded-2xl hover:bg-violet-700 shadow-xl shadow-violet-200 transition-transform active:scale-95">
            استكشف المنتجات
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
          {favorites.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
