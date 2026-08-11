"use client";

import { useState, useEffect } from "react";
import { AddToCartButton } from "./add-to-cart-button";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { SuggestedProducts } from "./_components/suggested-products";

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

  const [zoomLevel, setZoomLevel] = useState(1);
  const [initialDistance, setInitialDistance] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialDistance(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const zoom = dist / initialDistance;
      setZoomLevel(prev => Math.min(Math.max(1, prev * zoom), 3));
      setInitialDistance(dist);
    }
  };

  const handleTouchEnd = () => {
    setInitialDistance(null);
    if (zoomLevel < 1.1) setZoomLevel(1);
  };

  const handleDoubleClick = () => {
    setZoomLevel(prev => prev > 1 ? 1 : 2);
  };

  useEffect(() => {
    getGlobalIcons().then(setIcons);
    const favorites = JSON.parse(localStorage.getItem("kse_favorites") || "[]");
    setIsFavorite(favorites.includes(product.id));

    if (product.hasVariants && product.variants?.length > 0) {
      setSelectedVariant(product.variants[0]);
    }
  }, [product.id, product.hasVariants, product.variants]);

  useEffect(() => {
    if (isModalOpen) {
      // Create a dummy history entry so the phone's back button can be intercepted
      window.history.pushState({ modalOpen: true, id: product.id }, "", window.location.href);

      const handlePopState = (e: PopStateEvent) => {
        setIsModalOpen(false);
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [isModalOpen, product.id]);

  const closeModal = () => {
    setIsModalOpen(false);
    // Go back to remove the dummy history entry we added when opening
    window.history.back();
  };

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    const favorites = JSON.parse(localStorage.getItem("kse_favorites") || "[]");
    let newFavorites;
    if (favorites.includes(product.id)) {
      newFavorites = favorites.filter((id: string) => id !== product.id);
      setIsFavorite(false);
      window.dispatchEvent(new CustomEvent("kse:show-toast", { detail: { message: "تمت الإزالة من المفضلة", type: "error" } }));
    } else {
      newFavorites = [...favorites, product.id];
      setIsFavorite(true);
      window.dispatchEvent(new CustomEvent("kse:show-toast", { detail: { message: "تمت الإضافة للمفضلة بنجاح ❤️", type: "success" } }));
    }
    localStorage.setItem("kse_favorites", JSON.stringify(newFavorites));
    window.dispatchEvent(new Event("favorites-updated"));
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `تفقد هذا المنتج: ${product.name}`,
          url: window.location.href,
        });
      }
    } catch (err) {
      console.log('Share ignored', err);
    }
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
        className="group bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:border-green-400 hover:shadow-md transition-all duration-300 cursor-pointer relative"
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
        <div className="relative w-full h-32 bg-white flex items-center justify-center pt-2">
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
        <div className="px-3 pb-3 pt-1 flex-1 flex flex-col justify-between bg-white relative z-10 gap-1">
          <div>
            <h2 className="text-xs font-bold text-slate-800 line-clamp-2 text-right">
              {currentName}
            </h2>
          </div>
          
          <div className="flex items-end justify-between mt-1">
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
          onClick={closeModal}
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
                 <button onClick={handleShare}>
                   <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                   </svg>
                 </button>
               </div>
               <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-800 hover:bg-slate-200">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
            </div>

            <div className="overflow-y-auto flex-1 pb-0">
              <div className="relative bg-white overflow-hidden flex flex-col items-center py-6">
                <div className="relative w-full flex flex-col items-center">
                  <div 
                    className="w-full flex items-center justify-center overflow-auto touch-pan-x touch-pan-y" 
                    style={{ touchAction: "pan-x pan-y pinch-zoom" }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onDoubleClick={handleDoubleClick}
                  >
                    <img
                      src={photos[activePhotoIndex]}
                      decoding="async"
                      className="w-[250px] h-[250px] md:w-[300px] md:h-[300px] object-contain relative z-10 transition-transform duration-75"
                      style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
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

              <div className="px-6 pb-2 text-center">
                <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-1">{product.name}</h2>
                {product.description && (
                  <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap leading-relaxed">{product.description}</p>
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

              {/* قسم المنتجات المكملة */}
              <SuggestedProducts excludeId={product.id} />
            </div>

            {/* شريط السعر والإضافة للسلة في الأسفل */}
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <AddToCartButton product={productForCart} variant="default" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

