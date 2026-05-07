"use client";

import { useEffect, useRef, useState } from "react";
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
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const hasPushedHistoryRef = useRef(false);
  const ignoreNextPopRef = useRef(false);

  const openModal = () => {
    setActivePhotoIndex(0);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);

    // عند الغلق يدوياً نزيل entry الخاص بنا من history
    // حتى لا يصبح زر الرجوع "مضلِّل" أو يخرج المستخدم بعد الغلق.
    if (hasPushedHistoryRef.current) {
      ignoreNextPopRef.current = true;
      hasPushedHistoryRef.current = false;
      window.history.back();
    }
  };

  useEffect(() => {
    const favorites = JSON.parse(localStorage.getItem("kse_favorites") || "[]");
    setIsFavorite(favorites.includes(product.id));

    if (product.hasVariants && product.variants?.length > 0) {
      setSelectedVariant(product.variants[0]);
    }
  }, [product.id, product.hasVariants, product.variants]);

  // دعم زر الرجوع من الهاتف:
  // - إذا كانت النافذة مفتوحة: زر الرجوع يغلقها فقط.
  // - إذا كانت النافذة غير مفتوحة: زر الرجوع يخرج المستخدم من صفحة الفرع بشكل طبيعي.
  useEffect(() => {
    if (!isModalOpen) return;

    ignoreNextPopRef.current = false;

    if (!hasPushedHistoryRef.current) {
      hasPushedHistoryRef.current = true;
      window.history.pushState(
        { kse_modal_product: true, productId: product.id },
        ""
      );
    }

    const handlePopState = () => {
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }
      hasPushedHistoryRef.current = false;
      setIsModalOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      setIsModalOpen(false);
      if (hasPushedHistoryRef.current) {
        ignoreNextPopRef.current = true;
        hasPushedHistoryRef.current = false;
        window.history.back();
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen, product.id]);

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
  const photos = product.photoUrls && product.photoUrls.length > 0 ? product.photoUrls : [""];
  const normalizedBgOpacity = Number.isFinite(Number(bgOpacityPercent))
    ? Math.min(1, Math.max(0, Number(bgOpacityPercent) / 100))
    : 0.4;

  return (
    <>
      <div
        onClick={openModal}
        className="group bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-lg shadow-slate-200/40 dark:shadow-none overflow-hidden flex flex-col hover:border-violet-400 dark:hover:border-violet-600 hover:-translate-y-4 hover:scale-110 hover:z-30 hover:shadow-[0_20px_50px_rgba(139,92,246,0.3)] transition-all duration-500 relative cursor-pointer"
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
        <button
          onClick={openModal}
          className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800/50 text-right"
        >
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
        </button>

        {/* معلومات المنتج - تظهر فوراً وتكون قابلة للتفاعل حتى قبل تحميل الصور */}
        <div className="p-3 md:p-6 flex-1 flex flex-col relative z-10 bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800">
          <div className="flex justify-between items-start mb-1 gap-2">
            <button
              onClick={openModal}
              className="text-sm md:text-xl font-black text-slate-900 dark:text-white group-hover:text-violet-600 transition-colors line-clamp-1 flex-1 text-right hover:text-violet-600"
            >
              {product.name}
            </button>
            <div className="text-xs md:text-lg font-black text-violet-600 dark:text-violet-400 shrink-0">
              {(currentPrice / 1000).toLocaleString()} 
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

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={closeModal}
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
                closeModal();
              }}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg font-bold text-slate-900 dark:text-white hover:bg-white transition-colors"
            >
              ✕
            </button>

            <div className="overflow-y-auto flex-1 pb-10">
              <div className="relative aspect-square md:aspect-video bg-slate-100 dark:bg-slate-800/50 overflow-hidden">
                {bgUrl && (
                  <img
                    src={bgUrl}
                    className="absolute inset-0 w-full h-full object-cover z-0"
                    style={{ opacity: normalizedBgOpacity }}
                    alt=""
                  />
                )}
                {photos[activePhotoIndex] ? (
                  <img
                    src={photos[activePhotoIndex]}
                    className="w-full h-full object-contain relative z-10 p-4"
                    alt={product.name}
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20 text-5xl relative z-10">📦</div>
                )}

                {photos.length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto py-2 z-20">
                    {photos.map((url: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setActivePhotoIndex(idx)}
                        className={`w-12 h-12 rounded-lg border-2 overflow-hidden shrink-0 transition-all ${
                          activePhotoIndex === idx ? "border-violet-600 scale-110 shadow-lg" : "border-white/50 opacity-70"
                        }`}
                      >
                        <img src={url} className="w-full h-full object-cover" alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 md:p-10 space-y-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="text-right flex-1">
                    <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white">{currentName}</h2>
                    <p className="text-violet-600 dark:text-violet-400 font-black text-xl md:text-2xl mt-2">
                      {(currentPrice / 1000).toLocaleString()} 
                    </p>
                  </div>
                  <button
                    onClick={toggleFavorite}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-all ${
                      isFavorite ? "bg-rose-50 dark:bg-rose-900/20 text-rose-500" : "bg-slate-50 dark:bg-slate-800 text-slate-300"
                    }`}
                  >
                    <span className="text-2xl">{isFavorite ? "❤️" : "🤍"}</span>
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
                          <span className="block text-[10px] opacity-80">{(Number(v.salePrice) / 1000).toLocaleString()} </span>
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