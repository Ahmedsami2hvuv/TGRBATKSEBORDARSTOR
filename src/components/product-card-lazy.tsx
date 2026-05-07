"use client";

import { useState, useEffect } from "react";
import { AddToCartButton } from "@/app/store/add-to-cart-button";

export function ProductCardLazy({
  product,
  bgUrl,
  bgOpacityPercent,
}: {
  product: any,
  bgUrl?: string,
  bgOpacityPercent?: number,
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);

  useEffect(() => {
    const favorites = JSON.parse(localStorage.getItem("kse_favorites") || "[]");
    setIsFavorite(favorites.includes(product.id));

    if (product.hasVariants && product.variants?.length > 0) {
      setSelectedVariant(product.variants[0]);
    }
  }, [product.id, product.hasVariants, product.variants]);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    const favorites = JSON.parse(localStorage.getItem("kse_favorites") || "[]");
    let newFavorites;
    if (favorites.includes(product.id)) {
      newFavorites = favorites.filter((id: string) => id !== product.id);
      setIsFavorite(false);
    } else {
      newFavorites = [...favorites, product.id];
      setIsFavorite(true);
    }
    localStorage.setItem("kse_favorites", JSON.stringify(newFavorites));
    window.dispatchEvent(new Event("favorites-updated"));
  };

  const currentPrice = selectedVariant ? Number(selectedVariant.salePrice) : Number(product.salePrice);
  const currentName = selectedVariant ? `${product.name} (${selectedVariant.name})` : product.name;

  const productForCart = {
    ...product,
    productId: product.id,
    id: selectedVariant ? `${product.id}-${selectedVariant.id}` : product.id,
    name: currentName,
    salePrice: currentPrice,
    price: currentPrice,
  };

  const photo = product.photoUrls?.[0];
  const normalizedBgOpacity = Number.isFinite(Number(bgOpacityPercent))
    ? Math.min(1, Math.max(0, Number(bgOpacityPercent) / 100))
    : 0.4;

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="group bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-lg shadow-slate-200/40 dark:shadow-none overflow-hidden flex flex-col hover:border-violet-400 dark:hover:border-violet-600 hover:-translate-y-4 hover:scale-110 hover:z-30 hover:shadow-[0_20px_50px_rgba(139,92,246,0.3)] transition-all duration-500 cursor-pointer relative"
      >
        <button
          onClick={toggleFavorite}
          className="absolute top-3 left-3 z-20 w-8 h-8 md:w-10 md:h-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95"
        >
          <span className={`text-lg md:text-xl ${isFavorite ? "text-rose-500" : "text-slate-300"}`}>
            {isFavorite ? "❤️" : "🤍"}
          </span>
        </button>

        {/* حاوية الصورة - ثابتة الأبعاد لضمان ظهور النصوص فوراً */}
        <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800/50">
          {bgUrl && (
            <img
              src={bgUrl}
              className="absolute inset-0 w-full h-full object-cover z-0"
              style={{ opacity: normalizedBgOpacity }}
              alt=""
            />
          )}

          {!imageLoaded && photo && (
             <div className="absolute inset-0 flex items-center justify-center z-10">
                {/* تأثير نبضي خفيف مكان الصورة حتى تحمل */}
                <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 animate-pulse flex items-center justify-center">
                    <span className="text-4xl opacity-10">🖼️</span>
                </div>
             </div>
          )}

          {photo ? (
            <img
              src={photo}
              alt={product.name}
              onLoad={() => setImageLoaded(true)}
              className={`w-full h-full object-contain transition-all duration-1000 relative z-10 p-2 ${imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-20 text-4xl">📦</div>
          )}
        </div>

        {/* معلومات المنتج - تظهر فوراً وتكون قابلة للتفاعل حتى قبل تحميل الصور */}
        <div className="p-3 md:p-6 flex-1 flex flex-col relative z-10 bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800">
          <div className="flex justify-between items-start mb-1 gap-2">
            <h2 className="text-sm md:text-xl font-black text-slate-900 dark:text-white group-hover:text-violet-600 transition-colors line-clamp-1 flex-1 text-right">
              {product.name}
            </h2>
            <div className="text-xs md:text-lg font-black text-violet-600 dark:text-violet-400 shrink-0">
              {(currentPrice / 1000).toLocaleString()} ألف
            </div>
          </div>
          <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold mb-3 md:mb-6 line-clamp-2 h-7 md:h-10 text-right">
            {product.description}
          </p>
          <div className="mt-auto">
            <AddToCartButton product={productForCart} />
          </div>
        </div>
      </div>
    </>
  );
}