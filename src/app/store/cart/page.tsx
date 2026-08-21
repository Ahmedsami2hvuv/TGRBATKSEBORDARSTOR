"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { submitStoreOrder } from "../actions";
import { normalizeRegionNameForMatch } from "@/lib/region-name-normalize";

type RegionHit = { id: string; name: string; deliveryPrice?: string };

export default function CartPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  // Form State
  const [state, action] = useFormState(submitStoreOrder, {});
  const hasRedirectedToWhatsappRef = useRef(false);
  const regionInputRef = useRef<HTMLInputElement>(null);

  const [regionQuery, setRegionQuery] = useState("");
  const [landmark, setLandmark] = useState("");
  const [phone, setPhone] = useState("");
  const [regionHits, setRegionHits] = useState<RegionHit[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<RegionHit | null>(null);
  const [deliveryPrice, setDeliveryPrice] = useState<number>(0);
  const [baseDeliveryPrice, setBaseDeliveryPrice] = useState<number>(0);
  const [regionFieldError, setRegionFieldError] = useState<string | null>(null);
  const [addToOrderId, setAddToOrderId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // External Product Modal State
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [externalItemName, setExternalItemName] = useState("");
  const [externalQty, setExternalQty] = useState<number>(1);

  useEffect(() => {
    setMounted(true);
    setCart(JSON.parse(localStorage.getItem("kse_cart") || "[]"));
    const profile = JSON.parse(localStorage.getItem("kse_user_profile") || "null");
    if (profile) {
      setPhone(profile.phone || "");
      if (profile.landmark) setLandmark(profile.landmark);
      if (profile.regionName) {
        setRegionQuery(profile.regionName);
        if (profile.regionId) {
          setSelectedRegion({ id: profile.regionId, name: profile.regionName, deliveryPrice: String(profile.deliveryPrice || 0) });
          setBaseDeliveryPrice(Number(profile.deliveryPrice || 0));
          setDeliveryPrice(Number(profile.deliveryPrice || 0));
        }
      }
    }
    
    const editingOrderId = localStorage.getItem("kse_add_to_order_id");
    if (editingOrderId) {
      setAddToOrderId(editingOrderId);
    }
  }, []);

  function updateQty(id: string, delta: number) {
    const next = cart.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    });
    setCart(next);
    localStorage.setItem("kse_cart", JSON.stringify(next));
    window.dispatchEvent(new Event("cart-updated"));
  }

  function removeItem(id: string) {
    const next = cart.filter(item => item.id !== id);
    setCart(next);
    localStorage.setItem("kse_cart", JSON.stringify(next));
    window.dispatchEvent(new Event("cart-updated"));
  }

  const handleAddExternalProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalItemName.trim()) return;

    const newItem = {
      id: `ext-${Date.now()}`,
      productId: `ext-${Date.now()}`,
      name: `[منتج خارجي] ${externalItemName.trim()}`,
      price: 0,
      salePrice: 0,
      quantity: Math.max(1, Number(externalQty || 1)),
      photo: null,
      isExternal: true
    };

    const nextCart = [...cart, newItem];
    setCart(nextCart);
    localStorage.setItem("kse_cart", JSON.stringify(nextCart));
    window.dispatchEvent(new Event("cart-updated"));

    setExternalItemName("");
    setExternalQty(1);
    setShowExternalModal(false);
  };

  // Effect for Whatsapp redirection
  useEffect(() => {
    if (!state.ok || hasRedirectedToWhatsappRef.current) return;
    hasRedirectedToWhatsappRef.current = true;

    try {
      const orders = JSON.parse(localStorage.getItem("kse_orders") || "[]");
      const targetId = addToOrderId || state.orderNumber;
      
      const existingOrderIndex = orders.findIndex((o: any) => 
        String(o.orderNumber) === String(targetId) || 
        String(o.id) === String(targetId) ||
        String(o.draftId) === String(targetId)
      );

      if (existingOrderIndex > -1) {
        // دمج المنتجات الجديدة مباشرة بداخل الطلب القديم
        const existingItems = orders[existingOrderIndex].items || [];
        orders[existingOrderIndex].items = [...existingItems, ...cart];
        orders[existingOrderIndex].date = new Date().toISOString();
      } else {
        orders.push({
          id: state.draftId,
          orderNumber: state.orderNumber,
          date: new Date().toISOString(),
          items: cart
        });
      }
      localStorage.setItem("kse_orders", JSON.stringify(orders));
    } catch(e) {}

    const whatsappPhone = "9647733921468";
    const activeAddId = typeof window !== "undefined" ? localStorage.getItem("kse_add_to_order_id") : addToOrderId;
    const orderNo = activeAddId || state.orderNumber || "غير متوفر";

    let finalWhatsappMessage = "";

    // إذا كانت العملية إضافة منتجات لطلب سابق، ننشئ الرسالة المخصصة المطلوب نصها تماماً بحرفيتها
    if (activeAddId || (state.whatsappMessage && (state.whatsappMessage.includes("أضفت") || state.whatsappMessage.includes("إضافة")))) {
      const addedProductLines = cart.map((item: any) => `- ${item.name} × ${item.quantity || 1}`);
      finalWhatsappMessage = [
        `لقد أضفت منتجات من خصيب ستور لطلبي المرقم ${orderNo}`,
        "المنتجات المضافة هي:",
        ...addedProductLines
      ].join("\n");
      
      if (typeof window !== "undefined") {
        localStorage.removeItem("kse_add_to_order_id");
        localStorage.removeItem("kse_cart");
        window.dispatchEvent(new Event("kse:add-to-order-changed"));
        window.dispatchEvent(new Event("cart-updated"));
      }
      setCart([]);
        setAddToOrderId(null);
        hasRedirectedToWhatsappRef.current = false;

    } else {
      const productLines = cart.map((item: any) => `- ${item.name} × ${item.quantity || 1}`);
      finalWhatsappMessage = [
        `لقد قمت بالطلب من خصيب ستور ارجو تجهيز طلبي`,
        `رقم طلبي هو: ${orderNo}`,
        `المنتجات:`,
        ...productLines
      ].join("\n");

      if (typeof window !== "undefined") {
        localStorage.removeItem("kse_add_to_order_id");
        localStorage.removeItem("kse_cart");
        window.dispatchEvent(new Event("kse:add-to-order-changed"));
        window.dispatchEvent(new Event("cart-updated"));
      }
      setCart([]);
        setAddToOrderId(null);
        hasRedirectedToWhatsappRef.current = false;

    }

    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(finalWhatsappMessage)}`;

    window.location.href = whatsappUrl;
  }, [state.ok, state.orderNumber, state.whatsappMessage, cart, addToOrderId]);

  // Effect for Region Autocomplete & Initial Load
  const [allRegions, setAllRegions] = useState<RegionHit[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/regions/search?q=all");
        const j = (await r.json()) as { regions?: RegionHit[] };
        if (j.regions) {
          setAllRegions(j.regions);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const q = regionQuery.trim();
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!q) {
      setRegionHits(allRegions.slice(0, 15));
      return;
    }

    searchTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/regions/search?q=${encodeURIComponent(q)}`);
          const j = (await r.json()) as { regions?: RegionHit[] };
          const serverHits = j.regions ?? [];
          
          // إذا لم يجد السيرفر، نفصل البحث المحلي
          if (serverHits.length === 0 && allRegions.length > 0) {
            const localHits = allRegions.filter(reg => reg.name.toLowerCase().includes(q.toLowerCase()));
            setRegionHits(localHits.slice(0, 15));
          } else {
            setRegionHits(serverHits);
          }
        } catch {
          const localHits = allRegions.filter(reg => reg.name.toLowerCase().includes(q.toLowerCase()));
          setRegionHits(localHits.slice(0, 15));
        }
      })();
    }, 150);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [regionQuery, allRegions]);


  const regionErrMsg =
    regionFieldError ??
    (typeof state.error === "string" && state.error.includes("منطقة") ? state.error : null);

  if (!mounted) return null;

  if (state.ok) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("kse_cart");
      localStorage.removeItem("kse_active_shared_cart_id");
      localStorage.removeItem("kse_shared_user_name");
      localStorage.removeItem("kse_add_to_order_id");
      window.dispatchEvent(new Event("cart-updated"));
    }
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-6">
        <div className="text-8xl animate-bounce">🎉</div>
        <h1 className="text-4xl font-black text-slate-900">شكراً لطلبك!</h1>
        <p className="text-xl text-slate-600 font-bold">رقم طلبك هو: <span className="text-violet-600">#{state.orderNumber}</span></p>
        <p className="text-slate-500 font-bold">جارٍ تحويلك تلقائياً إلى واتساب...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
        <h1 className="text-2xl font-black text-slate-900">سلة التسوق</h1>
        <button
          type="button"
          onClick={() => setShowExternalModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs md:text-sm font-black rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <span className="text-base">📝</span>
          <span>إضافة منتج من خارج المتجر</span>
        </button>
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-[3rem] border border-dashed border-slate-200 space-y-6">
          <div className="text-6xl animate-bounce">🛒</div>
          <div>
            <p className="text-slate-700 font-black text-lg mb-1">سلتك فارغة حالياً</p>
            <p className="text-slate-400 text-xs font-bold">يمكنك التسوق من أفرع المتجر أو إضافة أي منتج خاص من خارج المتجر مباشرة!</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowExternalModal(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-amber-500 text-white font-black rounded-2xl hover:bg-amber-600 shadow-md transition active:scale-95 flex items-center justify-center gap-2 text-sm"
            >
              <span>📝</span>
              <span>إضافة منتج من خارج المتجر</span>
            </button>
            <Link href="/store" className="w-full sm:w-auto px-6 py-3.5 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition flex items-center justify-center gap-2 text-sm">
              <span>🛍️</span>
              <span>تصفح أفرع المتجر</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
            {cart.map((item) => (
              <div key={item.id} className="p-4 flex items-center gap-4">
                {/* أزرار زيادة ونقصان الكمية (عمودية) - تم نقلها للأمام */}
                <div className="flex flex-col items-center justify-center bg-white p-1 rounded-2xl shrink-0 shadow-inner">
                  <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm font-bold text-green-600 active:scale-95 transition-transform">+</button>
                  <span className="font-black text-sm my-1 w-8 text-center text-slate-800">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm font-bold text-rose-500 active:scale-95 transition-transform">-</button>
                </div>

                {/* الصورة */}
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white shrink-0">
                  {item.photo ? <img src={item.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
                </div>
                
                {/* الاسم */}
                <div className="flex-1">
                  <h3 className="font-black text-slate-900 leading-tight">{item.name}</h3>
                </div>
                
                {/* زر الحذف */}
                <button onClick={() => removeItem(item.id)} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <form
            action={action}
            className="space-y-6 mt-8"
            onSubmit={(e) => {
              let activeRegion = selectedRegion;
              
              // إذا كتب المستخدم المنطقة ولم يضغط الاقتراح، نعتمد المنطقة التي كتبها تلقائياً
              if (!activeRegion && regionQuery.trim()) {
                activeRegion = {
                  id: `custom_${Date.now()}`,
                  name: regionQuery.trim(),
                  deliveryPrice: "0"
                };
                setSelectedRegion(activeRegion);
              }

              if (!activeRegion?.name && !regionQuery.trim()) {
                e.preventDefault();
                setRegionFieldError("يرجى كتابة منطقتك لاكمال الطلب.");
                regionInputRef.current?.focus();
                return;
              }
              setRegionFieldError(null);

              if (activeRegion) {
                 localStorage.setItem("kse_user_profile", JSON.stringify({
                   phone: phone,
                   regionName: activeRegion.name,
                   regionId: activeRegion.id,
                   deliveryPrice: deliveryPrice,
                   landmark: landmark
                 }));
              }
            }}
          >
            {addToOrderId && (
              <div className="bg-sky-50 text-sky-800 p-4 rounded-xl border border-sky-200 text-sm font-bold flex items-center justify-between">
                <span>أنت تقوم بإضافة منتجات لطلبية سابقة. (لن يتم احتساب تكلفة توصيل إضافية).</span>
                <button 
                  type="button" 
                  onClick={() => {
                    localStorage.removeItem("kse_add_to_order_id");
                    setAddToOrderId(null);
                  }}
                  className="text-xs bg-white text-sky-600 px-3 py-1 rounded-full shadow-sm hover:bg-sky-100"
                >
                  إلغاء
                </button>
              </div>
            )}
            
            <input type="hidden" name="cart" value={JSON.stringify(cart)} />
            <input type="hidden" name="regionId" value={selectedRegion?.id || `custom_region`} />
            <input type="hidden" name="regionName" value={selectedRegion?.name || regionQuery || "منطقة عامة"} />
            <input 
              type="hidden" 
              name="addToOrderId" 
              value={addToOrderId || (typeof window !== "undefined" ? (localStorage.getItem("kse_add_to_order_id") || "") : "")} 
            />

            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
              <h2 className="text-lg font-black text-slate-900 mb-4">معلومات التوصيل والاتصال</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">رقم الهاتف</label>
                  <input
                    name="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 transition"
                    placeholder="07XXXXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">منطقتك</label>
                  {selectedRegion ? (
                    <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-green-800">المنطقة المختارة:</span>
                        <span className="text-lg font-black text-green-900">{selectedRegion.name}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          setSelectedRegion(null);
                          setRegionQuery("");
                          setDeliveryPrice(0);
                          setBaseDeliveryPrice(0);
                          setTimeout(() => regionInputRef.current?.focus(), 100);
                        }}
                        className="text-xs font-bold text-green-700 underline hover:text-green-800 bg-white px-3 py-1 rounded-full shadow-sm"
                      >
                        تغيير
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        ref={regionInputRef}
                        type="text"
                        value={regionQuery}
                        onFocus={() => {
                          if (regionHits.length === 0 && allRegions.length > 0) {
                            setRegionHits(allRegions.slice(0, 15));
                          }
                        }}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRegionQuery(v);
                          setRegionFieldError(null);
                        }}
                        autoComplete="off"
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 transition font-bold"
                        placeholder="ابحث عن منطقتك أو اكتب اسمها (مثل: جيكور، حمدان...)"
                      />
                      {regionErrMsg && (
                        <p className="mt-2 text-xs font-bold text-rose-600" role="alert">
                          {regionErrMsg}
                        </p>
                      )}
                    </>
                  )}

                  {!selectedRegion && (regionHits.length > 0 || regionQuery.trim().length > 0) && (
                    <div className="mt-2 rounded-xl border border-green-200 bg-green-50/50 p-2 shadow-lg">
                      <ul className="max-h-48 overflow-auto space-y-1">
                        {regionQuery.trim() && !regionHits.some(h => h.name.trim() === regionQuery.trim()) && (
                          <li>
                            <button
                              type="button"
                              className="w-full rounded-lg px-3 py-2 text-end text-sm font-black text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition border border-emerald-300 flex items-center justify-between"
                              onClick={() => {
                                const customRegion = {
                                  id: `custom_${Date.now()}`,
                                  name: regionQuery.trim(),
                                  deliveryPrice: "0"
                                };
                                setSelectedRegion(customRegion);
                                setDeliveryPrice(0);
                                setBaseDeliveryPrice(0);
                                setRegionHits([]);
                                setRegionFieldError(null);
                              }}
                            >
                              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">اختيار مخصص</span>
                              <span>📍 اعتماد "{regionQuery.trim()}" كمنطقتك</span>
                            </button>
                          </li>
                        )}
                        {regionHits.map((h) => (
                          <li key={h.id}>
                            <button
                              type="button"
                              className="w-full rounded-lg px-3 py-2 text-end text-sm font-bold text-slate-800 hover:bg-white hover:text-emerald-700 transition flex items-center justify-between"
                              onClick={() => {
                                const currentInput = regionQuery;
                                setSelectedRegion(h);
                                const price = Number(h.deliveryPrice || 0);
                                setDeliveryPrice(price);
                                setBaseDeliveryPrice(price);
                                setRegionQuery(h.name);
                                setRegionHits([]);
                                setRegionFieldError(null);

                                const remainder = currentInput.replace(h.name, "").trim();
                                if (remainder) {
                                  const cleanedRemainder = remainder.replace(/^[،, \-ـ]+/, "");
                                  if (cleanedRemainder) {
                                    setLandmark((prev) =>
                                      prev ? `${prev} ${cleanedRemainder}` : cleanedRemainder
                                    );
                                  }
                                }
                              }}
                            >
                              <span className="text-[11px] font-bold text-slate-400">
                                {Number(h.deliveryPrice) > 0 ? `${Number(h.deliveryPrice).toLocaleString("en-US")} د.ع` : "توصيل مجاني"}
                              </span>
                              <span>{h.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">أقرب نقطة دالة</label>
                  <textarea
                    name="landmark"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 transition"
                    placeholder="مثال: قرب مدرسة ... أو خلف جامع ..."
                    rows={2}
                  />
                </div>

                {selectedRegion && (
                  <div className="pt-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">سعر التوصيل المتوقع (ألف دينار)</label>
                    <input
                      name="deliveryPrice"
                      type="number"
                      value={deliveryPrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= baseDeliveryPrice) {
                          setDeliveryPrice(val);
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl border-2 border-green-100 bg-green-50 outline-none focus:bg-white focus:ring-2 focus:ring-green-200 transition font-black text-green-700"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl space-y-4">
              <p className="text-center text-sm font-bold text-slate-300 leading-relaxed">
                يتم تحديد السعر الكلي للمنتجات والتوصيل عند التجهيز بواسطة المندوب.
              </p>

              {typeof state.error === "string" && !state.error.includes("منطقة") ? (
                <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-300 text-sm font-bold text-center">
                  {state.error}
                </div>
              ) : null}

              <button
                type="submit"
                className="w-full py-4 bg-green-600 text-white rounded-xl font-black text-lg hover:bg-green-500 transition-all active:scale-95 shadow-lg"
              >
                {addToOrderId ? `تأكيد وإضافة المنتجات للطلب #${addToOrderId}` : "تأكيد وإرسال الطلب"}
              </button>
            </div>
          </form>
        </>
      )}

      {/* مودال إضافة منتج من خارج المتجر */}
      {showExternalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 border border-slate-100 relative">
            <button
              onClick={() => setShowExternalModal(false)}
              className="absolute top-5 left-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition"
            >
              ✕
            </button>

            <div className="text-center space-y-2 pt-2">
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
                📝
              </div>
              <h2 className="text-xl font-black text-slate-900">إضافة منتج من خارج المتجر</h2>
              <p className="text-xs text-slate-500 font-bold leading-relaxed px-4">
                اكتب اسم المنتج أو الطلب الخاص الذي تريده من خارج المتجر وسيقوم المندوب بتسليمه وتجهيزه لك.
              </p>
            </div>

            <form onSubmit={handleAddExternalProduct} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المنتج أو الملاحظة *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={externalItemName}
                  onChange={(e) => setExternalItemName(e.target.value)}
                  placeholder="مثال: مناديل فاخرة / خبز عراقي حار 5 أرغفة..."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 font-bold text-sm text-slate-800 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الكمية المطلوبة</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExternalQty(Math.max(1, externalQty - 1))}
                    className="w-10 h-10 bg-slate-100 rounded-xl font-black text-slate-700 hover:bg-slate-200 transition font-mono"
                  >
                    -
                  </button>
                  <span className="font-black text-base w-8 text-center text-slate-800">{externalQty}</span>
                  <button
                    type="button"
                    onClick={() => setExternalQty(externalQty + 1)}
                    className="w-10 h-10 bg-slate-100 rounded-xl font-black text-slate-700 hover:bg-slate-200 transition font-mono"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition"
                >
                  إضافة المنتج للسلة 🛍️
                </button>
                <button
                  type="button"
                  onClick={() => setShowExternalModal(false)}
                  className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-sm transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
