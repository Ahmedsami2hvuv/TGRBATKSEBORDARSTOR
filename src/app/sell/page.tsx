"use client";

import React, { useState, useEffect } from "react";

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
    <div className="min-h-screen bg-slate-900 text-white dir-rtl" style={{ direction: "rtl" }}>
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-30 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="w-9 h-9 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center justify-center text-lg font-bold transition"
                title="الرجوع للأقسام"
              >
                ➔
              </button>
            )}
            <div>
              <h1 className="text-base sm:text-lg font-black text-emerald-400">
                {selectedCategory ? selectedCategory.name : "معرض السلع - أبو الأكبر"}
              </h1>
              <p className="text-[11px] text-slate-400">
                {selectedCategory ? "تصفح السلع والمنتجات المتاحة بهذا القسم" : "اختر القسم لتصفح المنتجات والسلع المعروضة للبيع"}
              </p>
            </div>
          </div>

          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shadow-inner border border-emerald-500/30">
            🛒
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="ابحث عن طابعة، بايسكل، بيت..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition pr-10"
            />
            <span className="absolute left-3 top-3 text-slate-400 text-sm">🔍</span>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-400 text-sm">جاري تحميل المعرض...</p>
          </div>
        ) : !selectedCategory && !searchQuery.trim() ? (
          /* 🟢 1. واجهة الأقسام الرئيسية المطابقة للصورة المرفقة */
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <span>🏷️</span>
                <span>الأقسام المتوفرة:</span>
              </h2>
              <span className="text-xs text-slate-400 font-semibold">{categories.length} قسم</span>
            </div>

            {categories.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
                <div className="text-5xl mb-4">🛒</div>
                <h3 className="text-lg font-bold text-slate-300">لا توجد أقسام مضافة بعد</h3>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat)}
                    className="group bg-slate-800/80 hover:bg-slate-800 border-2 border-emerald-600/40 hover:border-emerald-500 rounded-3xl p-2.5 flex flex-col items-center justify-between text-center transition duration-200 shadow-md hover:shadow-emerald-500/20 active:scale-95"
                  >
                    {/* Category Image Box */}
                    <div className="w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden mb-2 relative border border-slate-700/60 group-hover:border-emerald-500/50 transition">
                      {cat.imageUrl ? (
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-tr from-slate-800 to-slate-900">
                          📦
                        </div>
                      )}
                    </div>

                    {/* Category Name */}
                    <span className="font-bold text-xs sm:text-sm text-slate-100 group-hover:text-emerald-400 line-clamp-1 py-0.5">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          /* 🔵 2. واجهة السلع والمنتجات داخل القسم المختار أو نتائج البحث */
          <section className="space-y-4">
            {/* Header / Back Bar */}
            <div className="flex items-center justify-between bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-md shadow-emerald-600/20"
                >
                  <span>➔</span>
                  <span>رجوع للأقسام</span>
                </button>
                {selectedCategory && (
                  <span className="text-sm font-bold text-white bg-slate-900 px-3 py-1 rounded-xl border border-slate-700">
                    {selectedCategory.name}
                  </span>
                )}
              </div>

              <span className="text-xs text-slate-400 font-semibold">
                السلع: <span className="text-emerald-400 font-bold">{filteredItems.length}</span>
              </span>
            </div>

            {/* Quick Categories Bar for fast switching */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                  !selectedCategory
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                ✨ كل الأقسام
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                    selectedCategory?.id === cat.id
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Items Grid */}
            {filteredItems.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
                <div className="text-5xl mb-4">🛒</div>
                <h3 className="text-lg font-bold text-slate-300">لا توجد سلع متوفرة في هذا القسم حالياً</h3>
                <p className="text-slate-400 text-xs mt-1">اختر قسماً آخر أو تصفح باقي الأقسام</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl overflow-hidden transition duration-200 flex flex-col shadow-lg border ${
                      item.isSold
                        ? "bg-slate-800/60 border-slate-700/50 grayscale opacity-80"
                        : "bg-slate-800 border-slate-700/70 hover:border-emerald-500/50"
                    }`}
                  >
                    {/* Product Image */}
                    <div className="relative h-48 bg-slate-900 flex items-center justify-center overflow-hidden group">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-slate-600">
                          <span className="text-4xl mb-1">📦</span>
                          <span className="text-xs">بدون صورة</span>
                        </div>
                      )}

                      {item.isSold ? (
                        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="bg-slate-800 text-slate-300 font-black text-sm px-4 py-1.5 rounded-full border border-slate-600 shadow-xl tracking-wider">
                            مبيوع 🚫
                          </span>
                        </div>
                      ) : (
                        <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-400 border border-slate-700">
                          {item.category?.name || "عام"}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-base text-white line-clamp-2 mb-2">{item.title}</h3>
                        <div className="space-y-1 text-xs text-slate-300 mb-3">
                          {item.location && (
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <span>📍</span>
                              <span>{item.location}</span>
                            </div>
                          )}
                          {item.price && (
                            <div className={`flex items-center gap-1.5 font-bold text-sm ${item.isSold ? "text-slate-500 line-through" : "text-emerald-400"}`}>
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
                          className="w-full bg-slate-700/80 text-slate-400 text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border border-slate-600/50"
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

      {/* Buyer Info Modal */}
      {selectedItemForChat && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setSelectedItemForChat(null)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white text-xl p-1"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl mx-auto mb-2">
                📲
              </div>
              <h3 className="text-lg font-bold text-white">تواصل مع بائع السلعة</h3>
              <p className="text-xs text-slate-400 mt-1">
                السلعة: <span className="text-cyan-400 font-semibold">{selectedItemForChat.title}</span>
              </p>
            </div>

            {errorMessage && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-xs p-3 rounded-xl mb-4 text-center">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleInquirySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">اسمك الكامل *</label>
                <input
                  type="text"
                  required
                  placeholder="أدخل اسمك الكريم"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">رقم هاتفك (الواتساب) *</label>
                <input
                  type="tel"
                  required
                  placeholder="077xxxxxxxx"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">عنوانك / منطقتك</label>
                <input
                  type="text"
                  placeholder="مثال: بغداد - الكرادة"
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={submittingInquiry}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm mt-2"
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
