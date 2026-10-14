"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

interface ShopStoreViewProps {
  shop: any;
  categories: any[];
  branches: any[];
  products: any[];
  slides: any[];
  regions: any[];
}

export function ShopStoreView({
  shop,
  categories,
  branches,
  products,
  slides,
  regions,
}: ShopStoreViewProps) {
  const [selectedCatId, setSelectedCatId] = useState<string>("all");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<Array<{ id: string; name: string; price: number; quantity: number; photoUrl: string }>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // حقول إتمام الطلب
  const [phone, setPhone] = useState("");
  const [regionName, setRegionName] = useState(regions[0]?.name || "");
  const [customRegion, setCustomRegion] = useState("");
  const [receiptTime, setReceiptTime] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // استرجاع السلة المحفوظة للمحل
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`shop_cart_${shop.id}`);
      if (saved) setCart(JSON.parse(saved));
      const savedPhone = localStorage.getItem("kse_user_phone");
      if (savedPhone) setPhone(savedPhone);
    } catch {}
  }, [shop.id]);

  // حفظ السلة
  const updateCart = (newCart: typeof cart) => {
    setCart(newCart);
    try {
      localStorage.setItem(`shop_cart_${shop.id}`, JSON.stringify(newCart));
    } catch {}
  };

  const addToCart = (product: any) => {
    const existingIndex = cart.findIndex((i) => i.id === product.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      updateCart(updated);
    } else {
      updateCart([
        ...cart,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          photoUrl: product.photoUrl || "",
        },
      ]);
    }
  };

  const removeFromCart = (productId: string) => {
    const existingIndex = cart.findIndex((i) => i.id === productId);
    if (existingIndex > -1) {
      const updated = [...cart];
      if (updated[existingIndex].quantity > 1) {
        updated[existingIndex].quantity -= 1;
      } else {
        updated.splice(existingIndex, 1);
      }
      updateCart(updated);
    }
  };

  const getItemQty = (productId: string) => {
    const item = cart.find((i) => i.id === productId);
    return item ? item.quantity : 0;
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const cartItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // تصفية الفروع التابعة للقسم المحدد
  const availableBranches = useMemo(() => {
    if (selectedCatId === "all") return [];
    return branches.filter((b) => b.categoryId === selectedCatId);
  }, [branches, selectedCatId]);

  // تصفية المنتجات
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCatId !== "all" && p.categoryId !== selectedCatId) return false;
      if (selectedBranchId !== "all" && p.branchId !== selectedBranchId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = (p.description || "").toLowerCase().includes(q);
        return matchesName || matchesDesc;
      }
      return true;
    });
  }, [products, selectedCatId, selectedBranchId, searchQuery]);

  // إرسال الطلب
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith("07")) {
      alert("رقم الهاتف يجب أن يكون 11 رقماً ويبدأ بـ 07 (مثال: 07733921468)");
      return;
    }
    const finalRegion = regionName === "أخرى" ? customRegion.trim() : regionName.trim();
    if (!finalRegion) {
      alert("يرجى اختيار أو كتابة منطقتك");
      return;
    }
    if (!receiptTime.trim()) {
      alert("يرجى تحديد وقت استلام الطلب (مثال: بعد ساعة، العصر، الساعة 6 مساءً)");
      return;
    }

    setOrderSubmitting(true);
    try {
      localStorage.setItem("kse_user_phone", cleanPhone);
      const res = await fetch("/api/shop-store/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: shop.id,
          customerPhone: cleanPhone,
          regionName: finalRegion,
          receiptTime: receiptTime.trim(),
          cart,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOrderSuccess(data);
        updateCart([]); // تفريغ السلة بعد نجاح الطلب
        // التحويل المباشر للواتساب
        if (data.whatsappUrl) {
          window.location.href = data.whatsappUrl;
        }
      } else {
        alert(data.error || "فشل إتمام الطلب");
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء إرسال الطلب: " + err.message);
    } finally {
      setOrderSubmitting(false);
    }
  };

  const targetToken = shop.storeToken || shop.id;
  const storeUrl = typeof window !== "undefined"
    ? `${window.location.origin}/shop/${targetToken}`
    : `https://aboakbr.com/shop/${targetToken}`;
  const shareText = `مرحبا الي سالوني عن متجرنه هذا الرابط مالتنه:\n${storeUrl}`;

  const copyShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } else {
      window.prompt("انسخ الرابط:", shareText);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-32" dir="rtl">
      {/* 1. الهيدر العلوي للمتجر الفخم */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
              {shop.storeLogoUrl ? (
                <img src={shop.storeLogoUrl} alt={shop.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">🏪</span>
              )}
            </div>
            <div>
              <h1 className="text-base md:text-lg font-black text-slate-900 leading-tight">
                متجر {shop.name}
              </h1>
              {shop.storeBio ? (
                <p className="text-[12px] text-slate-500 line-clamp-1 mt-0.5">
                  {shop.storeBio}
                </p>
              ) : (
                <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
                  متجر رسمي معتمد
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* زر مشاركة المتجر */}
            <button
              onClick={copyShare}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-blue-200"
              title="مشاركة المتجر"
            >
              <span>🔗</span>
              <span className="hidden sm:inline">{shareCopied ? "تم النسخ!" : "مشاركة المتجر"}</span>
            </button>

            {/* أيقونة السلة */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative bg-emerald-600 hover:bg-emerald-700 text-white p-2 md:px-3.5 md:py-2 rounded-xl text-sm font-black shadow-sm transition flex items-center gap-1.5"
            >
              <span>🛒</span>
              <span className="hidden sm:inline">السلة</span>
              {cartItemsCount > 0 && (
                <span className="bg-amber-400 text-slate-900 text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                  {cartItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* خانة البحث في المتجر */}
        <div className="max-w-6xl mx-auto mt-2.5">
          <div className="relative">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`ابحث في منتجات متجر ${shop.name}...`}
              className="w-full bg-slate-100 hover:bg-slate-200/70 focus:bg-white text-sm rounded-xl py-2 px-9 border border-transparent focus:border-blue-400 focus:outline-none transition"
            />
            <span className="absolute right-3 top-2.5 text-slate-400 text-sm">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 space-y-6">
        {/* 2. سلايدر البانرات الإعلانية الخاص بالمحل إن وجد */}
        {slides.length > 0 && (
          <div className="overflow-x-auto hide-scrollbar flex gap-3 snap-x snap-mandatory rounded-2xl">
            {slides.map((s) => (
              <div
                key={s.id}
                className="min-w-full md:min-w-[600px] h-40 md:h-56 rounded-2xl overflow-hidden bg-slate-200 shrink-0 snap-center relative shadow-xs"
              >
                <img src={s.imageUrl} alt={s.title || "Banner"} className="w-full h-full object-cover" />
                {s.title && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white text-xs md:text-sm font-bold">
                    {s.title}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 3. شريط الأقسام الأفقي السلس المطابق لمتجر وصلي */}
        {categories.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-black text-slate-800 flex items-center justify-between">
              <span>أقسام المتجر</span>
              {selectedCatId !== "all" && (
                <button
                  onClick={() => {
                    setSelectedCatId("all");
                    setSelectedBranchId("all");
                  }}
                  className="text-xs text-blue-600 hover:underline font-bold"
                >
                  عرض جميع الأقسام
                </button>
              )}
            </h2>

            <div className="flex items-start gap-3 overflow-x-auto pb-2 hide-scrollbar">
              {/* خيار الكل */}
              <button
                onClick={() => {
                  setSelectedCatId("all");
                  setSelectedBranchId("all");
                }}
                className={`flex flex-col items-center gap-1.5 min-w-[70px] shrink-0 transition-transform active:scale-95`}
              >
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-xs transition ${
                    selectedCatId === "all"
                      ? "bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2"
                      : "bg-white border border-slate-200 text-slate-600"
                  }`}
                >
                  🏪
                </div>
                <span
                  className={`text-[11px] font-bold text-center ${
                    selectedCatId === "all" ? "text-blue-600 font-black" : "text-slate-700"
                  }`}
                >
                  الكل
                </span>
              </button>

              {/* أقسام المتجر */}
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCatId(cat.id);
                    setSelectedBranchId("all");
                  }}
                  className={`flex flex-col items-center gap-1.5 min-w-[70px] shrink-0 transition-transform active:scale-95`}
                >
                  <div
                    className={`w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center shadow-xs transition ${
                      selectedCatId === cat.id
                        ? "ring-2 ring-blue-600 ring-offset-2 bg-blue-50"
                        : "bg-white border border-slate-200"
                    }`}
                  >
                    {cat.photoUrl ? (
                      <img src={cat.photoUrl} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">📦</span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-bold text-center leading-tight line-clamp-1 ${
                      selectedCatId === cat.id ? "text-blue-600 font-black" : "text-slate-700"
                    }`}
                  >
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. شريط الفروع إن وجد فروع للقسم المحدد */}
        {availableBranches.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            <button
              onClick={() => setSelectedBranchId("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 ${
                selectedBranchId === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              جميع الفروع
            </button>
            {availableBranches.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBranchId(b.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 ${
                  selectedBranchId === b.id
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}

        {/* 5. شبكة عرض المنتجات وكروت المنتجات المطابقة لمتجر وصلي */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-slate-800">
              المنتجات ({filteredProducts.length})
            </h3>
            {searchQuery && (
              <span className="text-xs text-slate-500">نتائج البحث عن &quot;{searchQuery}&quot;</span>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs">
              <span className="text-4xl block mb-2">🛍️</span>
              <p className="text-slate-600 font-bold text-sm">لا توجد منتجات مطابقة حالياً.</p>
              <p className="text-xs text-slate-400 mt-1">جرّب اختيار قسم آخر أو تغيير كلمة البحث.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredProducts.map((prod) => {
                const qty = getItemQty(prod.id);
                return (
                  <div
                    key={prod.id}
                    className="bg-white border border-slate-200 rounded-2xl p-2.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow"
                  >
                    <div>
                      {/* صورة المنتج */}
                      <div className="w-full aspect-square rounded-xl bg-slate-50 overflow-hidden mb-2 relative flex items-center justify-center">
                        {prod.photoUrl ? (
                          <img
                            src={prod.photoUrl}
                            alt={prod.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl">📦</span>
                        )}
                      </div>

                      {/* اسم وسعر المنتج */}
                      <h4 className="font-bold text-slate-800 text-xs md:text-sm line-clamp-2 leading-snug">
                        {prod.name}
                      </h4>
                      {prod.description && (
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {prod.description}
                        </p>
                      )}
                      <p className="text-blue-700 font-black text-xs md:text-sm mt-1">
                        {Number(prod.price).toLocaleString()} د.ع
                      </p>
                    </div>

                    {/* زر الإضافة للسلة أو العداد (+ / -) */}
                    <div className="mt-3">
                      {qty === 0 ? (
                        <button
                          onClick={() => addToCart(prod)}
                          className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-black text-xs py-1.5 rounded-xl transition flex items-center justify-center gap-1 active:scale-95"
                        >
                          <span>+</span>
                          <span>إضافة للسلة</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-blue-600 text-white rounded-xl p-1 shadow-xs">
                          <button
                            onClick={() => removeFromCart(prod.id)}
                            className="w-7 h-7 rounded-lg bg-blue-700 hover:bg-blue-800 flex items-center justify-center font-black text-sm active:scale-90"
                          >
                            -
                          </button>
                          <span className="font-black text-xs px-2">{qty}</span>
                          <button
                            onClick={() => addToCart(prod)}
                            className="w-7 h-7 rounded-lg bg-blue-700 hover:bg-blue-800 flex items-center justify-center font-black text-sm active:scale-90"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* الشريط السفلي العائم لعرض السلة عند وجود منتجات */}
      {cartItemsCount > 0 && !isCartOpen && !isCheckoutOpen && (
        <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40 animate-bounce-short">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between font-black text-sm transition"
          >
            <div className="flex items-center gap-2">
              <span className="bg-white text-emerald-700 w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs">
                {cartItemsCount}
              </span>
              <span>عرض سلة المشتريات</span>
            </div>
            <span>{cartTotal.toLocaleString()} د.ع ←</span>
          </button>
        </div>
      )}

      {/* النافذة المنبثقة لسلة المشتريات */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-slide-up">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                <span>🛒</span>
                سلة مشتريات متجر {shop.name}
              </h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt={item.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xs">
                        📦
                      </div>
                    )}
                    <div className="min-w-0">
                      <h5 className="font-bold text-xs text-slate-800 truncate">{item.name}</h5>
                      <p className="text-[11px] text-blue-600 font-bold">
                        {(item.price * item.quantity).toLocaleString()} د.ع
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 shrink-0">
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-xs font-black text-slate-700"
                    >
                      -
                    </button>
                    <span className="font-bold text-xs px-1.5">{item.quantity}</span>
                    <button
                      onClick={() => addToCart(item)}
                      className="w-6 h-6 rounded-lg bg-white shadow-xs flex items-center justify-center text-xs font-black text-slate-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between font-black text-sm text-slate-900">
                <span>المجموع:</span>
                <span>{cartTotal.toLocaleString()} د.ع</span>
              </div>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl shadow transition"
              >
                متابعة الطلب وإدخال البيانات ←
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إتمام الطلب (Checkout Modal) مع الشروط المطلوبة بدقة */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-slide-up">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-blue-600 text-white">
              <div>
                <h3 className="font-black text-base">إتمام الطلب من متجر {shop.name}</h3>
                <p className="text-[11px] text-blue-100">يرجى كتابة رقم هاتفك ومنطقتك لتأكيد الطلب</p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="p-5 overflow-y-auto space-y-4">
              {/* 1. رقم الهاتف: يجب أن يكون 11 رقم صحيح */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  رقم الهاتف (11 رقم يبدأ بـ 07) <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXXX"
                  maxLength={11}
                  required
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-right font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  أدخل رقم هاتفك الفعال لنتواصل معك وتأكيد الطلب.
                </p>
              </div>

              {/* 2. اسم المنطقة: تظهر له المناطق الموجودة بالموقع نفسها */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  المنطقة <span className="text-red-500">*</span>
                </label>
                <select
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-right text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                >
                  {regions.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                  <option value="أخرى">منطقة أخرى (كتابة يدوية)</option>
                </select>

                {regionName === "أخرى" && (
                  <input
                    type="text"
                    value={customRegion}
                    onChange={(e) => setCustomRegion(e.target.value)}
                    placeholder="اكتب اسم منطقتك هنا..."
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-right text-sm mt-2"
                    required
                  />
                )}
              </div>

              {/* 3. وقت استلام الطلب */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  وقت استلام الطلب <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={receiptTime}
                  onChange={(e) => setReceiptTime(e.target.value)}
                  placeholder="مثال: بعد ساعة، العصر، الساعة 7 مساءً..."
                  required
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-right text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  حدد الوقت المناسب لك لتجهيز واستلام طلبك.
                </p>
              </div>

              {/* ملخص الطلب */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 text-xs">
                <div className="flex justify-between font-bold text-slate-600">
                  <span>عدد المواد:</span>
                  <span>{cartItemsCount} منتج</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 text-sm pt-1 border-t border-slate-200">
                  <span>المجموع الإجمالي:</span>
                  <span className="text-blue-700">{cartTotal.toLocaleString()} د.ع</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={orderSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-black py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                {orderSubmitting ? (
                  <span>جاري تأكيد الطلب...</span>
                ) : (
                  <>
                    <span>📲</span>
                    <span>إرسال الطلب عبر واتساب المتجر</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
