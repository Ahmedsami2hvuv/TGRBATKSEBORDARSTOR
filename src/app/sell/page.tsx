"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  imageUrl: string;
}

interface Item {
  id: string;
  title: string;
  categoryId: string;
  imageUrl: string;
  location: string;
  price: string;
  sellerPhone: string;
  sellerName: string;
  viewsCount: number;
  inquiriesCount: number;
  isSold: boolean;
  category: Category;
}

function getImageUrl(rawUrl: string): string {
  if (!rawUrl || !rawUrl.trim()) return "";
  let url = rawUrl.trim();
  if (url.includes(".r2.dev/")) {
    const parts = url.split(".r2.dev/");
    if (parts.length > 1) {
      return `/uploads/${parts[1]}`;
    }
  }
  return url;
}

export default function SellPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State for Chat Inquiry
  const [selectedItemForChat, setSelectedItemForChat] = useState<Item | null>(null);
  const [buyerName, setBuyerName] = useState<string>("");
  const [buyerPhone, setBuyerPhone] = useState<string>("");
  const [buyerAddress, setBuyerAddress] = useState<string>("");
  const [submittingInquiry, setSubmittingInquiry] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    fetchMarketData();
  }, []);

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sell");
      const data = await res.json();

      if (data.success) {
        setCategories(data.categories || []);
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Error fetching sell data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory ? item.categoryId === selectedCategory.id : true;
    const matchesSearch = searchQuery.trim()
      ? item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.price.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesCategory && matchesSearch;
  });

  const openChatModal = async (item: Item) => {
    if (item.isSold) return;

    setSelectedItemForChat(item);
    setErrorMessage("");
    setBuyerName("");
    setBuyerPhone("");
    setBuyerAddress("");

    try {
      fetch(`/api/sell?itemId=${item.id}`);
    } catch (e) {}
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !buyerPhone.trim()) {
      setErrorMessage("الرجاء كتابة اسمك ورقم هاتفك للمتابعة");
      return;
    }

    if (!selectedItemForChat) return;

    setSubmittingInquiry(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItemForChat.id,
          buyerName: buyerName.trim(),
          buyerPhone: buyerPhone.trim(),
          buyerAddress: buyerAddress.trim()
        })
      });

      const data = await res.json();
      if (data.success && data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank");
        setSelectedItemForChat(null);
        fetchMarketData();
      } else {
        setErrorMessage(data.error || "حدث خطأ أثناء الإرسال، يرجى المحاولة لاحقاً");
      }
    } catch (err: any) {
      setErrorMessage("فشل الاتصال بالسيرفر");
    } finally {
      setSubmittingInquiry(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 dir-rtl" style={{ direction: "rtl" }}>
      {/* Header - Light Theme */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center text-lg font-bold transition border border-slate-300"
                title="الرجوع للأقسام"
              >
                ➔
              </button>
            )}
            <div>
              <h1 className="text-base sm:text-lg font-black text-emerald-600">
                {selectedCategory ? selectedCategory.name : "معرض السلع - أبو الأكبر"}
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                {selectedCategory ? "تصفح السلع والمنتجات المتاحة بهذا القسم" : "اختر القسم لتصفح المنتجات والسلع المعروضة للبيع"}
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black px-3.5 py-2 rounded-2xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition active:scale-95 border border-emerald-500/30"
          >
            <span>🛍️</span>
            <span>زيارة متجرنا الرئيسي ➔</span>
          </Link>
        </div>

        {/* Search Input Bar - Light */}
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="ابحث عن طابعة، بايسكل، بيت..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition pr-10 shadow-inner"
            />
            <span className="absolute left-3 top-3 text-slate-400 text-sm">🔍</span>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Promotional Main Store Banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-4 sm:p-5 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-500/30 relative overflow-hidden">
          <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center gap-3.5 z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl flex-shrink-0 border border-white/20">
              🏬
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg">متجر أبو الأكبر الرئيسي 🛍️</h2>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">
                تصفح مئات المنتجات والأجهزة الإلكترونية والخصومات الحصرية في متجرنا الرسمي!
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="z-10 bg-white hover:bg-slate-100 text-emerald-800 text-xs sm:text-sm font-black px-5 py-2.5 rounded-2xl shadow-lg transition whitespace-nowrap active:scale-95"
          >
            تصفح المتجر الآن 🚀
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 text-sm font-semibold">جاري تحميل المعرض...</p>
          </div>
        ) : !selectedCategory && !searchQuery.trim() ? (
          /* 🟢 1. واجهة الأقسام الرئيسية بالوضع النهاري الأنيق */
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>🏷️</span>
                <span>الأقسام المتوفرة:</span>
              </h2>
              <span className="text-xs text-slate-500 font-bold bg-white px-2.5 py-1 rounded-full border border-slate-200">
                {categories.length} قسم
              </span>
            </div>

            {categories.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                <div className="text-5xl mb-4">🛒</div>
                <h3 className="text-lg font-bold text-slate-700">لا توجد أقسام مضافة بعد</h3>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat)}
                    className="group bg-white hover:bg-emerald-50/50 border-2 border-emerald-500/40 hover:border-emerald-500 rounded-3xl p-2.5 flex flex-col items-center justify-between text-center transition duration-200 shadow-sm hover:shadow-md hover:shadow-emerald-500/10 active:scale-95"
                  >
                    {/* Category Image Box */}
                    <div className="w-full aspect-square bg-slate-100 rounded-2xl overflow-hidden mb-2 relative border border-slate-200 group-hover:border-emerald-500/50 transition">
                      {cat.imageUrl ? (
                        <img
                          src={getImageUrl(cat.imageUrl)}
                          alt={cat.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-tr from-slate-100 to-slate-200">
                          📦
                        </div>
                      )}
                    </div>

                    {/* Category Name */}
                    <span className="font-bold text-xs sm:text-sm text-slate-800 group-hover:text-emerald-700 line-clamp-1 py-0.5">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          /* 🔵 2. واجهة السلع والمنتجات بالوضع النهاري */
          <section className="space-y-4">
            {/* Header / Back Bar */}
            <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition flex items-center gap-1 shadow-sm"
                >
                  <span>➔</span>
                  <span>رجوع للأقسام</span>
                </button>
                {selectedCategory && (
                  <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                    {selectedCategory.name}
                  </span>
                )}
              </div>

              <span className="text-xs text-slate-500 font-semibold">
                السلع: <span className="text-emerald-600 font-bold">{filteredItems.length}</span>
              </span>
            </div>

            {/* Quick Categories Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  !selectedCategory
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                ✨ كل الأقسام
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                    selectedCategory?.id === cat.id
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Items Grid - Light */}
            {filteredItems.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                <div className="text-5xl mb-4">🛒</div>
                <h3 className="text-lg font-bold text-slate-700">لا توجد سلع متوفرة في هذا القسم حالياً</h3>
                <p className="text-slate-400 text-xs mt-1">اختر قسماً آخر أو تصفح باقي الأقسام</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl overflow-hidden transition duration-200 flex flex-col shadow-sm border ${
                      item.isSold
                        ? "bg-slate-200/80 border-slate-300 grayscale opacity-75"
                        : "bg-white border-slate-200 hover:border-emerald-400 hover:shadow-md"
                    }`}
                  >
                    {/* Product Image */}
                    <div className="relative h-48 bg-slate-100 flex items-center justify-center overflow-hidden group">
                      {item.imageUrl ? (
                        <img
                          src={getImageUrl(item.imageUrl)}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-slate-400">
                          <span className="text-4xl mb-1">📦</span>
                          <span className="text-xs font-semibold">بدون صورة</span>
                        </div>
                      )}

                      {item.isSold ? (
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="bg-slate-800 text-slate-100 font-black text-sm px-4 py-1.5 rounded-full border border-slate-600 shadow-xl tracking-wider">
                            مبيوع 🚫
                          </span>
                        </div>
                      ) : (
                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 border border-slate-200 shadow-sm">
                          {item.category?.name || "عام"}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-base text-slate-800 line-clamp-2 mb-2">{item.title}</h3>
                        <div className="space-y-1 text-xs text-slate-600 mb-3">
                          {item.location && (
                            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                              <span>📍</span>
                              <span>{item.location}</span>
                            </div>
                          )}
                          {item.price && (
                            <div className={`flex items-center gap-1.5 font-black text-base ${item.isSold ? "text-slate-400 line-through" : "text-emerald-600"}`}>
                              <span>💰</span>
                              <span>{item.price}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      {item.isSold ? (
                        <button
                          disabled
                          className="w-full bg-slate-300 text-slate-600 text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border border-slate-300"
                        >
                          <span>🚫</span>
                          <span>السلعة مبيوعة بالكامل</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => openChatModal(item)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95"
                        >
                          <span>💬</span>
                          <span>مراسلة البائع واتساب</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Buyer Info Modal - Light Theme */}
      {selectedItemForChat && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-slate-800">
            <button
              onClick={() => setSelectedItemForChat(null)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 text-xl p-1"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mx-auto mb-2 border border-emerald-200">
                📲
              </div>
              <h3 className="text-lg font-bold text-slate-800">تواصل مع بائع السلعة</h3>
              <p className="text-xs text-slate-500 mt-1">
                السلعة: <span className="text-emerald-600 font-bold">{selectedItemForChat.title}</span>
              </p>
            </div>

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-xl mb-4 text-center font-semibold">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleInquirySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسمك الكامل *</label>
                <input
                  type="text"
                  required
                  placeholder="أدخل اسمك الكريم"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم هاتفك (الواتساب) *</label>
                <input
                  type="tel"
                  required
                  placeholder="077xxxxxxxx"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عنوانك / منطقتك</label>
                <input
                  type="text"
                  placeholder="مثال: بغداد - الكرادة"
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submittingInquiry}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 text-sm mt-2"
              >
                {submittingInquiry ? (
                  <span>جاري التحويل للواتساب...</span>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>إرسال وفتح الواتساب مباشرة</span>
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
