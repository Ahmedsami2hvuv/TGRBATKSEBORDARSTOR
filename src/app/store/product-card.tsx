"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AddToCartButton } from "./add-to-cart-button";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function ProductCard({
  product,
}: {
  product: any,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const [mounted, setMounted] = useState(false);

  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  const [zoomLevel, setZoomLevel] = useState(1);
  const [initialDistance, setInitialDistance] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("product") === product.id) {
        setIsModalOpen(true);
      }
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

  const getProductShareDetails = () => {
    const bId = product.branchId || product.branch?.id;
    const cId = product.categoryId || product.branch?.categoryId || product.category?.id;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://aboakbr.com";
    
    let shareUrl = `${origin}/store/product/${product.id}`;
    if (cId && bId) {
      shareUrl = `${origin}/store/c/${cId}?b=${bId}&product=${product.id}`;
    } else if (bId) {
      shareUrl = `${origin}/store/b/${bId}?product=${product.id}`;
    }

    const shareMessage = `تعال شوف:\n${product.name}\nالموجود بخصيب ستور — أبو الأكبر للتوصيل 🛒\n${shareUrl}`;

    return { shareUrl, shareMessage };
  };

  const copyShareLinkOnly = async () => {
    const { shareUrl } = getProductShareDetails();
    try {
      await navigator.clipboard.writeText(shareUrl);
      window.dispatchEvent(new CustomEvent("kse:show-toast", { detail: { message: "تم نسخ رابط المنتج بنجاح 📋", type: "success" } }));
      setShowShareModal(false);
    } catch (err) {
      console.error("Clipboard copy error:", err);
    }
  };

  const shareToAppsDirectly = async () => {
    const { shareUrl, shareMessage } = getProductShareDetails();
    try {
      if (navigator.share && typeof navigator.share === "function") {
        await navigator.share({
          title: product.name,
          text: shareMessage,
          url: shareUrl,
        });
        window.dispatchEvent(new CustomEvent("kse:show-toast", { detail: { message: "تمت المشاركة بنجاح 📲", type: "success" } }));
      } else {
        await navigator.clipboard.writeText(shareMessage);
        window.dispatchEvent(new CustomEvent("kse:show-toast", { detail: { message: "تم نسخ نص ورابط المشاركة 📋", type: "success" } }));
      }
      setShowShareModal(false);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(shareMessage);
          window.dispatchEvent(new CustomEvent("kse:show-toast", { detail: { message: "تم نسخ نص ورابط المشاركة 📋", type: "success" } }));
        } catch (clipErr) {
          console.error("Clipboard error:", clipErr);
        }
      }
      setShowShareModal(false);
    }
  };

  const photos = product.photoUrls && product.photoUrls.length > 0 ? product.photoUrls : [""];
  const currentPrice = selectedVariant ? Number(selectedVariant.salePrice) : Number(product.salePrice);
  const currentName = selectedVariant ? `${product.name} (${selectedVariant.name})` : product.name;

  const branchId = product.branchId || product.branch?.id;
  const categoryId = product.categoryId || product.branch?.categoryId || product.category?.id;
  const targetBranchOrCategoryUrl = branchId
    ? `/store/b/${branchId}`
    : (categoryId ? `/store/c/${categoryId}` : null);

  useEffect(() => {
    if (isModalOpen && branchId) {
      setLoadingSimilar(true);
      fetch(`/api/store/products?branchId=${branchId}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const filtered = data.filter((p: any) => p.id !== product.id).slice(0, 10);
            setSimilarProducts(filtered);
          }
        })
        .catch((err) => console.error(err))
        .finally(() => setLoadingSimilar(false));
    }
  }, [isModalOpen, branchId, product.id]);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "contain";
    } else {
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
    };
  }, [isModalOpen]);

  const productForCart = {
    ...product,
    productId: product.id,
    id: selectedVariant ? `${product.id}-${selectedVariant.id}` : product.id,
    name: currentName,
    salePrice: currentPrice,
    price: currentPrice,
    supplierId: product.supplierId || null,
  };

  const shouldHidePrice = useMemo(() => {
    const category = product.category || product.branch?.category;
    const branch = product.branch;

    // 1. القسم يملك الأولوية العليا: إذا كان القسم مخفي الأسعار (true)، ينخفي السعر لجميع أفرعه ومنتجاته
    if (category?.hidePrices === true) {
      return true;
    }

    // 2. إذا كان القسم مسموح بإظهار أسعاره (false)، نحتكم لحالة الفرع
    if (category?.hidePrices === false) {
      // الفرع الذي لديه إخفاء أسعار (true) ينخفي السعر عنه
      if (branch?.hidePrices === true) {
        return true;
      }
      // الفرع الذي لديه إظهار أسعار (false) يظهر السعر عنده
      if (branch?.hidePrices === false) {
        return false;
      }
      // إذا لم يحدد الفرع حالة خاصة، يتبع القسم (إظهار)
      return false;
    }

    // 3. إذا لم يحدد القسم شيئاً، نعتمد على الفرع مباشرة
    if (branch?.hidePrices === true) {
      return true;
    }
    if (branch?.hidePrices === false) {
      return false;
    }

    return true;
  }, [product]);

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="group bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:border-green-400 hover:shadow-md transition-all duration-300 cursor-pointer relative"
      >
        <button
          onClick={toggleFavorite}
          className="absolute top-2.5 left-2.5 z-20 w-8 h-8 rounded-full bg-white/80 backdrop-blur-md shadow-sm flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${isFavorite ? "text-rose-500 fill-rose-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        <div className="relative w-full aspect-square bg-slate-50 overflow-hidden flex items-center justify-center">
          {!shouldHidePrice && currentPrice > 0 && (
            <div className="absolute bottom-1.5 right-1.5 z-20 bg-emerald-600 text-white font-black text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-lg shadow-md flex items-center gap-0.5 border border-emerald-400/30 pointer-events-none">
              <span>{currentPrice.toLocaleString("en-US")}</span>
              <span className="text-[9px] text-emerald-100 font-extrabold">د.ع</span>
            </div>
          )}

          {photos[0] ? (
            <img
              src={photos[0]}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
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

        <div className="p-3 flex items-center justify-between gap-2 bg-white relative z-10">
          <div className="flex-1 text-right">
            <h2 className="text-xs font-black text-slate-800 line-clamp-2 leading-tight">
              {currentName}
            </h2>
          </div>
          
          <div className="shrink-0 relative z-30 flex items-center justify-center">
             {product.hasVariants ? (
              <button className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-600 text-white font-black text-sm shadow-md active:scale-95 transition-transform">
                +
              </button>
             ) : (
                <AddToCartButton product={productForCart} variant="compact" />
             )}
          </div>
        </div>
      </div>

      {mounted && isModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={closeModal}
        >
          <div
            className="bg-white w-full md:max-w-xl rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 flex flex-col max-h-[96dvh] md:max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* الهيدر العلوي العائم فوق الصورة */}
            <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="w-10 h-10 rounded-full bg-white/85 backdrop-blur-md shadow-md flex items-center justify-center text-slate-700 hover:bg-white transition active:scale-90"
                  title="مشاركة"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                <button
                  onClick={toggleFavorite}
                  className="w-10 h-10 rounded-full bg-white/85 backdrop-blur-md shadow-md flex items-center justify-center hover:bg-white transition active:scale-90"
                  title="المفضلة"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${isFavorite ? "text-rose-500 fill-rose-500" : "text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>

              <button
                onClick={closeModal}
                className="w-10 h-10 rounded-full bg-white/85 backdrop-blur-md shadow-md flex items-center justify-center text-slate-800 hover:bg-white transition active:scale-90 pointer-events-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* الجزء القابل للتمرير المستقل بالكامل */}
            <div 
              className="overflow-y-auto overscroll-contain flex-1 pb-6 space-y-6 touch-pan-y" 
              style={{ overscrollBehaviorY: "contain", overscrollBehavior: "contain" }}
            >
              {/* 1. صورة المنتج العلوية الكبيرة */}
              <div className="relative bg-white w-full rounded-b-[2.5rem] overflow-hidden flex flex-col items-center justify-center pt-10 pb-6 border-b border-slate-100">
                <div 
                  className="w-full flex items-center justify-center overflow-auto touch-pan-x touch-pan-y min-h-[260px] max-h-[360px]" 
                  style={{ touchAction: "pan-x pan-y pinch-zoom" }}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onDoubleClick={handleDoubleClick}
                >
                  <img
                    src={photos[activePhotoIndex]}
                    decoding="async"
                    className="max-h-[320px] w-auto object-contain transition-transform duration-75 drop-shadow-sm"
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

                {photos.length > 1 && (
                  <div className="flex justify-center gap-2 px-4 overflow-x-auto py-2 z-20">
                    {photos.map((url: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setActivePhotoIndex(idx)}
                        className={`w-10 h-10 rounded-xl border-2 overflow-hidden shrink-0 transition-all ${
                          activePhotoIndex === idx ? "border-emerald-500 scale-110 shadow-sm" : "border-slate-200 opacity-70"
                        }`}
                      >
                        <img src={url} className="w-full h-full object-cover" alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. التفاصيل والمعلومات */}
              <div className="px-6 space-y-5 bg-white">
                {/* اسم المنتج وتصنيفه والسعر */}
                <div>
                  <h2 className="text-2xl font-black text-slate-900 leading-snug">{currentName}</h2>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs font-bold text-slate-400">
                      {product.branch?.name || product.category?.name || "متوفر لدينا"}
                    </p>
                    {!shouldHidePrice && (
                      <p className="text-xl font-black text-emerald-600">
                        {currentPrice > 0 ? `${currentPrice.toLocaleString("en-US")} د.ع` : "حسب الاختيار"}
                      </p>
                    )}
                  </div>
                </div>

                {/* وصف المنتج إن وجد */}
                {product.description && (
                  <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 mb-1">وصف المنتج:</h4>
                    <p className="text-sm font-bold text-slate-700 whitespace-pre-line leading-relaxed">
                      {product.description}
                    </p>
                  </div>
                )}

                {/* خيارات الأنواع إن وجدت */}
                {product.hasVariants && product.variants?.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 block">
                      اختر {product.variantType || "النوع"}:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((v: any) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariant(v)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                            selectedVariant?.id === v.id
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-md scale-105"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {v.name} {!shouldHidePrice && `- ${Number(v.salePrice).toLocaleString("en-US")} د.ع`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* قسم منتجات مشابهة من نفس الفرع */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900">منتجات مشابهة</h3>
                    {targetBranchOrCategoryUrl && (
                      <Link
                        href={targetBranchOrCategoryUrl}
                        onClick={() => setIsModalOpen(false)}
                        className="text-xs font-black text-emerald-600 hover:underline"
                      >
                        عرض الكل
                      </Link>
                    )}
                  </div>

                  {loadingSimilar ? (
                    <div className="flex gap-3 overflow-x-auto py-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="w-28 h-36 bg-slate-100 rounded-2xl animate-pulse shrink-0"></div>
                      ))}
                    </div>
                  ) : similarProducts.length > 0 ? (
                    <div className="flex gap-3 overflow-x-auto pb-2 pt-1 snap-x scrollbar-none">
                      {similarProducts.map((simProd: any) => {
                        const simPhoto = simProd.photoUrls?.[0] || simProd.photo || "";
                        const simPrice = Number(simProd.salePrice || 0);
                        return (
                          <div
                            key={simProd.id}
                            onClick={() => {
                              setIsModalOpen(false);
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent("kse:open-product-modal", { detail: { product: simProd } }));
                              }, 100);
                            }}
                            className="w-28 sm:w-32 bg-white rounded-2xl border border-slate-100 p-2 shadow-sm shrink-0 snap-start cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between"
                          >
                            <div className="w-full aspect-square bg-slate-50 rounded-xl overflow-hidden mb-2 relative">
                              {simPhoto ? (
                                <img src={simPhoto} alt={simProd.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">لا صورة</div>
                              )}
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 line-clamp-1 leading-tight">{simProd.name}</h4>
                            
                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/80">
                              {!shouldHidePrice && simPrice > 0 ? (
                                <p className="text-[11px] font-black text-emerald-600">
                                  {simPrice.toLocaleString("en-US")} <span className="text-[9px] font-bold text-slate-400">د.ع</span>
                                </p>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold">عرض</span>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const cart = JSON.parse(localStorage.getItem("kse_cart") || "[]");
                                  const existingIndex = cart.findIndex((item: any) => item.id === simProd.id);
                                  if (existingIndex > -1) {
                                    cart[existingIndex].quantity += 1;
                                  } else {
                                    cart.push({
                                      id: simProd.id,
                                      productId: simProd.id,
                                      name: simProd.name,
                                      price: simPrice,
                                      photo: simPhoto,
                                      quantity: 1
                                    });
                                  }
                                  localStorage.setItem("kse_cart", JSON.stringify(cart));
                                  window.dispatchEvent(new Event("cart-updated"));
                                  window.dispatchEvent(new Event("storage"));
                                  window.dispatchEvent(new CustomEvent("kse:store-cart-changed", { detail: { cart } }));
                                  window.dispatchEvent(new CustomEvent("kse:show-toast", { detail: { message: "تمت إضافته للسلة 🛒", type: "success" } }));
                                }}
                                className="w-6 h-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center shadow-sm active:scale-90 transition-all shrink-0"
                                title="أضف للسلة"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-400">لا توجد منتجات إضافية بهذا الفرع حالياً.</p>
                  )}
                </div>
              </div>
            </div>

            {/* الشريط السفلي الملتصق لزر أضف للسلة */}
            <div className="p-4 border-t border-slate-100 bg-white/95 backdrop-blur-md shadow-lg sticky bottom-0 z-40 rounded-t-3xl">
              <AddToCartButton product={productForCart} variant="default" />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

