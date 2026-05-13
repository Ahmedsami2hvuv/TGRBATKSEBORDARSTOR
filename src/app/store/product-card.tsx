"use client";

import { useState, useEffect } from "react";
import { AddToCartButton } from "./add-to-cart-button";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function ProductCard({
  product,
}: {
  product: any,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
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

  const photos = product.photoUrls && product.photoUrls.length > 0 ? product.photoUrls : [""];
  const currentPrice = selectedVariant ? Number(selectedVariant.salePrice) : Number(product.salePrice);
  const currentName = selectedVariant ? `${product.name} (${selectedVariant.name})` : product.name;

  const productForCart = {
    ...product,
    productId: product.id,
    id: selectedVariant ? `${product.id}-${selectedVariant.id}` : product.id,
    name: currentName,
    salePrice: currentPrice,
    price: currentPrice,
    supplierId: product.supplierId || null,
  };

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="group bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-lg shadow-slate-200/40 dark:shadow-none overflow-hidden flex flex-col hover:border-violet-400 dark:hover:border-violet-600 hover:-translate-y-4 hover:scale-110 hover:z-30 hover:shadow-[0_20px_50px_rgba(139,92,246,0.3)] transition-all duration-500 cursor-pointer relative"
      >
        {/* زر المفضلة - يظهر فوراً */}
        <button
          onClick={toggleFavorite}
          className="absolute top-3 left-3 z-20 w-8 h-8 md:w-10 md:h-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95"
        >
          <span className={`text-lg md:text-xl ${isFavorite ? "text-rose-500" : "text-slate-300"}`}>
            <DynamicIcon
              icon={isFavorite ? icons?.store_favorites : icons?.store_favorites_empty}
              fallback={isFavorite ? "❤️" : "🤍"}
            />
          </span>
        </button>

        {/* حاوية الصورة - تم إلغاء المربع الإجباري لظهور الصورة بحجمها الكامل */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 flex flex-col items-center justify-center border-b border-slate-50">
          {photos[0] ? (
            <>
              <img
                src={photos[0]}
                alt={product.name}
                loading="lazy"
                decoding="async"
                className="w-full h-auto max-h-[250px] object-contain transition-transform duration-700 group-hover:scale-105 relative z-10 p-2"
              />
              {/* التوقيع أسفل الصورة في الكارت */}
              <div className="mt-2 mb-1 px-4 py-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm z-20">
                <span className="text-[9px] font-black bg-gradient-to-r from-slate-600 to-slate-400 dark:from-slate-300 dark:to-slate-500 bg-clip-text text-transparent">خصيب ستور - أبو ألاكبر</span>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center relative z-10 opacity-20 text-3xl md:text-5xl">
              <DynamicIcon icon={icons?.ui_package} fallback="📦" />
            </div>
          )}
        </div>

        {/* محتوى المنتج (الاسم، السعر، السلة) - هذا ما سيظهر فوراً */}
        <div className="p-3 md:p-6 flex-1 flex flex-col relative z-10 bg-white dark:bg-slate-900">
          <div className="flex justify-between items-start mb-1 gap-2">
            <h2 className="text-sm md:text-xl font-black text-slate-900 dark:text-white group-hover:text-violet-600 transition-colors line-clamp-1 flex-1 text-right">
              {product.name}
            </h2>
            <div className="text-xs md:text-lg font-black text-violet-600 dark:text-violet-400 shrink-0">
              {currentPrice.toLocaleString()}
            </div>
          </div>

          <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold mb-3 md:mb-6 line-clamp-2 h-7 md:h-10 text-right">
            {product.description}
          </p>

          <div className="mt-auto">
            {product.hasVariants ? (
              <button className="w-full py-2.5 rounded-xl font-black text-xs md:text-sm bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800 hover:bg-violet-100 transition-all">
                اختر ال{product.variantType}
              </button>
            ) : (
              <AddToCartButton product={productForCart} />
            )}
          </div>
        </div>
      </div>

      {/* مودال التفاصيل (يفتح فقط عند الضغط) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsModalOpen(false);
              }}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg font-bold text-slate-900 dark:text-white hover:bg-white transition-colors"
            >
              ✕
            </button>

            <div className="overflow-y-auto flex-1 pb-10">
              <div className="relative bg-white dark:bg-slate-900 overflow-hidden flex flex-col items-center">
                <div className="relative w-full flex flex-col items-center group/img">
                  <img
                    src={photos[activePhotoIndex]}
                    className="w-full h-auto object-contain relative z-10 p-4"
                    style={{ maxHeight: 'none' }}
                    alt={product.name}
                    decoding="async"
                  />
                  {/* التوقيع - تصميم احترافي تحت الصورة مباشرة */}
                  <div className="mt-4 mb-4 w-full flex justify-center px-4">
                    <div className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 px-8 py-3 rounded-3xl shadow-xl flex items-center gap-3 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse shrink-0 shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
                      <span className="text-xs md:text-base font-black bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-wide">
                        خصيب ستور - أبو ألاكبر للتوصيل - 07733921468
                      </span>
                    </div>
                  </div>
                </div>

                {photos.length > 1 && (
                  <div className="w-full flex justify-center gap-2 px-4 overflow-x-auto py-2 z-20">
                    {photos.map((url: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setActivePhotoIndex(idx)}
                        className={`w-12 h-12 rounded-lg border-2 overflow-hidden shrink-0 transition-all ${
                          activePhotoIndex === idx ? "border-violet-600 scale-110 shadow-lg" : "border-white/50 opacity-70"
                        }`}
                      >
                        <img src={url} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 md:p-10 space-y-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="text-right flex-1">
                    <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white">{product.name}</h2>
                    <p className="text-violet-600 dark:text-violet-400 font-black text-xl md:text-2xl mt-2">
                      {currentPrice.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={toggleFavorite}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-all ${
                      isFavorite ? "bg-rose-50 dark:bg-rose-900/20 text-rose-500" : "bg-slate-50 dark:bg-slate-800 text-slate-300"
                    }`}
                  >
                    <span className="text-2xl">
                      <DynamicIcon
                        icon={isFavorite ? icons?.store_favorites : icons?.store_favorites_empty}
                        fallback={isFavorite ? "❤️" : "🤍"}
                      />
                    </span>
                  </button>
                </div>

                {product.hasVariants && (
                  <div className="space-y-3 text-right">
                    <h3 className="font-black text-slate-900 dark:text-white text-lg">اختر {product.variantType}:</h3>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {product.variants.map((v: any) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariant(v)}
                          className={`px-4 py-2 rounded-xl font-black text-sm transition-all border-2 ${
                            selectedVariant?.id === v.id
                            ? "border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-200"
                            : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-violet-200"
                          }`}
                        >
                          {v.name}
                          <span className="block text-[10px] opacity-80">{Number(v.salePrice).toLocaleString()} </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-right">
                  <h3 className="font-black text-slate-900 dark:text-white flex items-center justify-end gap-2 text-lg">
                    الوصف والتفاصيل
                    <span className="w-1.5 h-6 bg-violet-600 rounded-full"></span>
                  </h3>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <p className="text-slate-600 dark:text-slate-400 font-bold leading-relaxed whitespace-pre-wrap">
                      {product.description || "لا يوجد وصف متوفر لهذا المنتج."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
              <AddToCartButton product={productForCart} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
