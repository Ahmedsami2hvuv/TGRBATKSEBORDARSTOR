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
    const orderNo = state.orderNumber || activeAddId || "غير متوفر";

    let finalWhatsappMessage = "";

    // إذا كانت العملية إضافة منتجات لطلب سابق، ننشئ الرسالة المخصصة المطلوب نصها تماماً بحرفيتها
    if (activeAddId || (state.whatsappMessage && state.whatsappMessage.includes("إضافة"))) {
      const addedProductLines = cart.map((item: any) => `- ${item.name} × ${item.quantity || 1}`);
      finalWhatsappMessage = [
        `لقد قمت بإضافة منتجات إلى طلبيتي من خصيب ستور، رقم طلبي هو: ${orderNo}`,
        "المنتجات المضافة هي:",
        ...addedProductLines
      ].join("\n");
      
      if (typeof window !== "undefined") {
        localStorage.removeItem("kse_add_to_order_id");
        window.dispatchEvent(new Event("kse:add-to-order-changed"));
      }
    } else {
      const productLines = cart.map((item: any) => `- ${item.name} × ${item.quantity || 1}`);
      finalWhatsappMessage = [
        `لقد قمت بالطلب من خصيب ستور ارجو تجهيز طلبي`,
        `رقم طلبي هو: ${orderNo}`,
        `المنتجات:`,
        ...productLines
      ].join("\n");
    }

    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(finalWhatsappMessage)}`;

    window.location.href = whatsappUrl;
  }, [state.ok, state.orderNumber, state.whatsappMessage, cart, addToOrderId]);

  // Effect for Region Autocomplete
  useEffect(() => {
    const q = regionQuery.trim();
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (q.length < 2) {
      setRegionHits([]);
      return;
    }

    searchTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/regions/search?q=${encodeURIComponent(q)}`);
          const j = (await r.json()) as { regions?: RegionHit[] };
          setRegionHits(j.regions ?? []);
        } catch {
          setRegionHits([]);
        }
      })();
    }, 280);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [regionQuery]);


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
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <h1 className="text-2xl font-black text-slate-900 px-2">سلة التسوق</h1>

      {cart.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
          <div className="text-6xl mb-4">🛒</div>
          <p className="text-slate-500 font-bold mb-6">سلتك فارغة حالياً</p>
          <Link href="/store" className="inline-flex px-8 py-3 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition">
            ابدأ التسوق الآن
          </Link>
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
              if (!selectedRegion?.id) {
                e.preventDefault();
                setRegionFieldError("اختر منطقتك من الاقتراحات بعد كتابة الاسم.");
                regionInputRef.current?.focus();
                return;
              }
              setRegionFieldError(null);

              if (selectedRegion?.id) {
                 localStorage.setItem("kse_user_profile", JSON.stringify({
                   phone: phone,
                   regionName: selectedRegion.name,
                   regionId: selectedRegion.id,
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
            <input type="hidden" name="regionId" value={selectedRegion?.id ?? ""} />
            <input type="hidden" name="regionName" value={selectedRegion?.name || regionQuery} />
            {addToOrderId && <input type="hidden" name="addToOrderId" value={addToOrderId} />}

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
                        onChange={(e) => {
                          const v = e.target.value;
                          setRegionQuery(v);
                          setRegionFieldError(null);
                        }}
                        autoComplete="off"
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 transition"
                        placeholder="ابحث عن منطقتك (مثل: حمدان البز...)"
                      />
                      {regionErrMsg && (
                        <p className="mt-2 text-xs font-bold text-rose-600" role="alert">
                          {regionErrMsg}
                        </p>
                      )}
                    </>
                  )}

                  {regionHits.length > 0 && !selectedRegion && (
                    <div className="mt-2 rounded-xl border border-green-200 bg-green-50/50 p-2">
                      <ul className="max-h-40 overflow-auto space-y-1">
                        {regionHits.map((h) => (
                          <li key={h.id}>
                            <button
                              type="button"
                              className="w-full rounded-lg px-3 py-2 text-end text-sm font-bold text-slate-800 hover:bg-white transition"
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
                              {h.name}
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
    </div>
  );
}
