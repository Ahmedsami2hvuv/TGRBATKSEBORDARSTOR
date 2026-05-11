"use client";

import { useState, useEffect } from "react";

export function CustomProductRequest() {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (text.length > 1) {
      fetch(`/api/store/search-suggestions?q=${encodeURIComponent(text)}`)
        .then(res => res.json())
        .then(data => setSuggestions(data.slice(0, 5)))
        .catch(() => {});
    } else {
      setSuggestions([]);
    }
  }, [text]);

  function addCustomToCart() {
    if (!text.trim()) return;

    const cart = JSON.parse(localStorage.getItem("kse_cart") || "[]");
    const newItem = {
      id: "custom-" + Date.now(),
      name: `طلب خاص: ${text}`,
      price: 0, // Admin will price it
      photo: "",
      quantity: 1,
      isCustom: true
    };

    cart.push(newItem);
    localStorage.setItem("kse_cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("cart-updated"));
    finishAdding();
  }

  function addProductToCart(product: any) {
    const cart = JSON.parse(localStorage.getItem("kse_cart") || "[]");

    // Check if exists
    const existing = cart.find((item: any) => item.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: Number(product.salePrice),
        photo: product.photoUrls?.[0] || "",
        quantity: 1,
        isCustom: false
      });
    }

    localStorage.setItem("kse_cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("cart-updated"));
    finishAdding();
  }

  function finishAdding() {
    setAdded(true);
    setTimeout(() => {
        setAdded(false);
        setIsOpen(false);
        setText("");
    }, 1000);
  }

  return (
    <div className="w-full">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full py-4 bg-amber-50 border-2 border-dashed border-amber-200 rounded-3xl text-amber-700 font-black flex items-center justify-center gap-2 hover:bg-amber-100 transition-all"
        >
          <span>🔍</span>
          لم تجد منتجك؟ انقر هنا لكتابته مع الطلبية
        </button>
      ) : (
        <div className="bg-white p-6 rounded-[2rem] border-2 border-amber-200 shadow-xl animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-slate-900">ما هو المنتج الذي تبحث عنه؟</h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 font-bold">إغلاق ✕</button>
          </div>

          <div className="relative">
            <input
              autoFocus
              maxLength={20}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="مثلاً: كيكة عيد ميلاد..."
              className="w-full px-5 py-3 rounded-2xl border-2 border-slate-100 focus:border-violet-500 outline-none font-bold"
            />
            <div className="mt-1 text-[10px] text-slate-400 text-left font-bold">{text.length}/20 حرف</div>

            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-slate-100 shadow-xl rounded-2xl overflow-hidden">
                <p className="p-2 text-[10px] font-black text-slate-400 bg-slate-50">هل تقصد أحد هذه المنتجات؟</p>
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                        addProductToCart(s);
                        setSuggestions([]);
                    }}
                    className="w-full text-right px-4 py-2 hover:bg-violet-50 text-sm font-bold border-t border-slate-50 transition-colors flex justify-between items-center"
                  >
                    <span>{s.name}</span>
                    <span className="text-[10px] text-violet-600">{Number(s.salePrice).toLocaleString()} </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => addCustomToCart()}
            disabled={!text.trim() || added}
            className={`mt-4 w-full py-3 rounded-2xl font-black transition-all ${
              added ? "bg-emerald-500 text-white" : "bg-slate-900 text-white hover:bg-violet-600"
            }`}
          >
            {added ? "✅ تمت الإضافة لطلبك" : "إضافة للطلب كـ منتج خاص"}
          </button>
          <p className="mt-2 text-[10px] text-slate-400 text-center font-bold">سيقوم الموظف بتسعير هذا المنتج عند تجهيز الطلب</p>
        </div>
      )}
    </div>
  );
}
