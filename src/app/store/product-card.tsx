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

  // دالة تنسيق السعر
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US');
  };

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="group bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:border-green-400 hover:shadow-md transition-all duration-300 cursor-pointer relative h-[240px] md:h-[280px]"
      >
        {/* زر المفضلة - أعلى اليسار */}
        <button
          onClick={toggleFavorite}
          className="absolute top-3 left-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${isFavorite ? "text-rose-500 fill-rose-500" : "text-slate-300"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* حاوية الصورة */}
        <div className="relative w-full h-32 md:h-40 bg-white flex items-center justify-center pt-4">
          {photos[0] ? (
            <img
              src={photos[0]}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105 p-2"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                if (target.src.includes('?')) {
                  target.src = target.src.split('?')[0];
                }
              }}
            />
          ) : (
            <div className="text-3xl opacity-20">📦</div>
          )}
        </div>

        {/* محتوى المنتج */}
        <div className="p-3 md:p-4 flex-1 flex flex-col justify-between bg-white relative z-10">
          <div>
            <h2 className="text-sm font-bold text-slate-800 line-clamp-2 text-right">
              {currentName}
            </h2>
          </div>
          
          <div className="flex items-end justify-between mt-2">
            <div className="mr-auto relative z-30 w-full flex justify-end">
               {product.hasVariants ? (
                <button className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 font-bold text-sm">
                  +
                </button>
               ) : (
                 <AddToCartButton product={productForCart} variant="compact" />
               )}
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white w-full md:max-w-2xl md:rounded-[2rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col h-full md:h-auto md:max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
               <div className="flex items-center gap-4">
                 <button onClick={toggleFavorite}>
                   <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 ${isFavorite ? "text-rose-500 fill-rose-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                   </svg>
                 </button>
                 <button>
                   <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                   </svg>
                 </button>
               </div>
               <button onClick={() => setIsModalOpen(false)}>
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                 </svg>
               </button>
            </div>

            <div className="overflow-y-auto flex-1 pb-0">
              <div className="relative bg-white overflow-hidden flex flex-col items-center py-6">
                <div className="relative w-full flex flex-col items-center">
                  <img
                    src={photos[activePhotoIndex]}
                    decoding="async"
                    className="w-[250px] h-[250px] md:w-[300px] md:h-[300px] object-contain relative z-10"
                    alt={product.name}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      if (target.src.includes('?')) {
                        target.src = target.src.split('?')[0];
                      }
                    }}
                  />
                </div>

                {photos.length > 1 && (
                  <div className="w-full flex justify-center gap-2 px-4 overflow-x-auto py-4 z-20">
                    {photos.map((url: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setActivePhotoIndex(idx)}
                        className={`w-12 h-12 rounded-lg border-2 overflow-hidden shrink-0 transition-all ${
                          activePhotoIndex === idx ? "border-green-500 scale-110 shadow-sm" : "border-slate-100 opacity-70"
                        }`}
                      >
                        <img src={url} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 pb-6 text-center">
                <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-1">{product.name}</h2>
                {product.description && (
                  <p className="text-sm text-slate-400 mt-2">{product.description}</p>
                )}
              </div>
              
              {product.hasVariants && (
                <div className="px-6 pb-6">
                   <div className="flex flex-wrap gap-2 justify-center">
                     {product.variants.map((v: any) => (
                       <button
                         key={v.id}
                         onClick={() => setSelectedVariant(v)}
                         className={`px-4 py-2 rounded-xl font-bold text-sm transition-all border ${
                           selectedVariant?.id === v.id
                           ? "border-green-500 bg-green-50 text-green-600"
                           : "border-slate-200 text-slate-600 hover:border-green-200"
                         }`}
                       >
                         {v.name}
                       </button>
                     ))}
                   </div>
                </div>
              )}
            </div>

            {/* شريط السعر والإضافة للسلة في الأسفل */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                 <div className="flex items-center gap-2">
                   <span className="text-sm text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded text-[10px]">متوفر في المخزن</span>
                 </div>
              </div>
              
              <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-slate-100 mb-2">
                <div className="flex items-center gap-2 text-green-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-right flex-1 mr-3">
                  <div className="text-[10px] text-slate-400">توصيل سريع</div>
                  <div className="text-sm font-bold text-slate-700">خلال 15-30 دقيقة</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
              </div>

              <AddToCartButton product={productForCart} variant="default" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

