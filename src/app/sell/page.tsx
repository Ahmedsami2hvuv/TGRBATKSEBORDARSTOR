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
  category: Category;
}

export default function SellPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State
  const [selectedItemForChat, setSelectedItemForChat] = useState<Item | null>(null);
  const [buyerName, setBuyerName] = useState<string>("");
  const [buyerPhone, setBuyerPhone] = useState<string>("");
  const [buyerAddress, setBuyerAddress] = useState<string>("");
  const [submittingInquiry, setSubmittingInquiry] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    fetchMarketData();
  }, [selectedCategory]);

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      let url = "/api/sell";
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "all") {
        params.append("categoryId", selectedCategory);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
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
    fetchMarketData();
  };

  const openChatModal = async (item: Item) => {
    setSelectedItemForChat(item);
    setErrorMessage("");
    setBuyerName("");
    setBuyerPhone("");
    setBuyerAddress("");

    // تسجيل زيادة المشاهدات
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
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/30">
              🏷️
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                معرض المبيعات والسلع - أبو الأكبر
              </h1>
              <p className="text-xs text-slate-400">تصفح وتواصل مباشرة مع البائعين بضغط واحدة</p>
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="w-full md:w-auto flex items-center gap-2">
            <div className="relative flex-1 md:w-80">
              <input
                type="text"
                placeholder="ابحث عن طابعة، بايسكل، بيت..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
            <button
              type="submit"
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-md shadow-cyan-600/20"
            >
              بحث
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Categories Bar */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-400 mb-3">الأقسام المتاحة:</h2>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                selectedCategory === "all"
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              ✨ كل الأقسام
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap flex items-center gap-2 ${
                  selectedCategory === cat.id
                    ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {cat.imageUrl && (
                  <img src={cat.imageUrl} alt={cat.name} className="w-4 h-4 rounded object-cover" />
                )}
                {cat.name}
              </button>
            ))}
          </div>
        </section>

        {/* Items Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-400 text-sm">جاري تحميل السلع والمنتجات...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">🛒</div>
            <h3 className="text-lg font-bold text-slate-300">لا توجد سلع معروضة حالياً</h3>
            <p className="text-slate-400 text-sm mt-1">جرب تغيير القسم أو تصفح باقي الأقسام</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-slate-800 border border-slate-700/70 rounded-2xl overflow-hidden hover:border-cyan-500/50 transition duration-200 flex flex-col shadow-lg"
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
                  <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-semibold text-cyan-400 border border-slate-700">
                    {item.category?.name || "عام"}
                  </div>
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
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                          <span>💰</span>
                          <span>{item.price}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => openChatModal(item)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95"
                  >
                    <span>💬</span>
                    <span>مراسلة البائع واتساب</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
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
