"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { submitStoreOrder } from "../actions";
import { normalizeRegionNameForMatch } from "@/lib/region-name-normalize";

type RegionHit = { id: string; name: string; deliveryPrice?: string };

const fmtAlf = (val: number) =>
  val.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export default function CheckoutPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [state, action] = useFormState(submitStoreOrder, {});
  const hasRedirectedToWhatsappRef = useRef(false);
  const regionInputRef = useRef<HTMLInputElement>(null);

  const [regionQuery, setRegionQuery] = useState("");
  const [landmark, setLandmark] = useState("");
  const [regionHits, setRegionHits] = useState<RegionHit[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<RegionHit | null>(null);
  const [deliveryPrice, setDeliveryPrice] = useState<number>(0);
  const [baseDeliveryPrice, setBaseDeliveryPrice] = useState<number>(0);
  const [vehiclePreference, setVehiclePreference] = useState("");
  const [regionFieldError, setRegionFieldError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    setCart(JSON.parse(localStorage.getItem("kse_cart") || "[]"));
  }, []);

  useEffect(() => {
    if (!state.ok || hasRedirectedToWhatsappRef.current) return;
    hasRedirectedToWhatsappRef.current = true;

    const whatsappPhone = "9647733921468";
    const orderNo = state.orderNumber ? String(state.orderNumber) : "غير متوفر";
    const fallbackMessage = `لقد قمت بالطلب من خصيب ستور ارجو تجهيز طلبي\nرقم طلبي هو: ${orderNo}`;
    const whatsappMessage = state.whatsappMessage || fallbackMessage;
    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}`;

    window.location.href = whatsappUrl;
  }, [state.ok, state.orderNumber, state.whatsappMessage]);

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

  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0),
    [cart]
  );

  const regionErrMsg =
    regionFieldError ??
    (typeof state.error === "string" && state.error.includes("منطقة") ? state.error : null);

  if (!mounted) return null;

  if (state.ok) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("kse_cart");
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
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-black text-slate-900 mb-8">إتمام الطلب</h1>

      <form
        action={action}
        className="grid grid-cols-1 lg:grid-cols-2 gap-12"
        onSubmit={(e) => {
          if (!selectedRegion?.id) {
            e.preventDefault();
            setRegionFieldError("اختر منطقتك من الاقتراحات بعد كتابة الاسم.");
            regionInputRef.current?.focus();
            return;
          }
          setRegionFieldError(null);
        }}
      >
        <input type="hidden" name="cart" value={JSON.stringify(cart)} />
        <input type="hidden" name="regionId" value={selectedRegion?.id ?? ""} />
        <input type="hidden" name="vehiclePreference" value={vehiclePreference} />

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center text-sm">1</span>
              معلومات الاتصال
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">رقم الهاتف</label>
                <input
                  name="phone"
                  type="tel"
                  required
                  className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition"
                  placeholder="07XXXXXXXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-slate-700 mb-4">هل تحتاج وسيلة نقل محددة؟ (اختياري)</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "", label: "لا يهم", icon: "any" },
                    { id: "bike", label: "دراجة", icon: "🏍️" },
                    { id: "car", label: "سيارة", icon: "🚗" },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVehiclePreference(v.id)}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                        vehiclePreference === v.id
                          ? "border-violet-600 bg-violet-50 text-violet-700 shadow-md"
                          : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                      }`}
                    >
                      <span className="text-2xl mb-1">{v.icon === "any" ? "✨" : v.icon}</span>
                      <span className="text-xs font-black">{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center text-sm">2</span>
              العنوان والتوصيل
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">منطقتك</label>
                <p className="text-xs font-bold text-slate-500 mb-2">
                  اكتب اسم المنطقة؛ سيُقترح عليك إن وُجدت عدة مناطق مطابقة للكلمات.
                </p>
                <input
                  ref={regionInputRef}
                  type="text"
                  value={regionQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRegionQuery(v);
                    setRegionFieldError(null);
                    if (
                      selectedRegion &&
                      normalizeRegionNameForMatch(v) !== normalizeRegionNameForMatch(selectedRegion.name)
                    ) {
                      setSelectedRegion(null);
                      setDeliveryPrice(0);
                      setBaseDeliveryPrice(0);
                    }
                  }}
                  autoComplete="off"
                  required
                  className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition"
                  placeholder="مثال: حمدان البز أو جيكور حزبه قرب الجامع"
                />
                {selectedRegion ? (
                  <p className="mt-2 text-xs font-bold text-emerald-700">
                    تم الاختيار: <span className="font-black">{selectedRegion.name}</span>
                  </p>
                ) : null}
                {regionErrMsg ? (
                  <p className="mt-2 text-xs font-bold text-rose-600" role="alert">
                    {regionErrMsg}
                  </p>
                ) : null}

                {regionHits.length > 0 && !selectedRegion ? (
                  <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
                    <p className="text-xs font-black text-violet-900 mb-2">هل تقصد إحدى هذه المناطق؟</p>
                    <ul className="max-h-52 overflow-auto space-y-1">
                      {regionHits.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            className="w-full rounded-xl px-3 py-2.5 text-end text-sm font-bold text-slate-800 hover:bg-white border border-transparent hover:border-violet-300 transition"
                            onClick={() => {
                              const currentInput = regionQuery;
                              setSelectedRegion(h);
                              const price = Number(h.deliveryPrice || 0);
                              setDeliveryPrice(price);
                              setBaseDeliveryPrice(price);
                              setRegionQuery(h.name);
                              setRegionHits([]);
                              setRegionFieldError(null);

                              // Extract the remaining text to put it in landmark
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
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">أقرب نقطة دالة</label>
                <textarea
                  name="landmark"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition"
                  placeholder="مثال: قرب مدرسة ... أو خلف جامع ..."
                  rows={2}
                />
              </div>

              {selectedRegion && (
                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-sm font-black text-slate-700 mb-2">سعر التوصيل (يمكنك زيادته لسرعة وصول الطلب)</label>
                  <div className="relative">
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
                      className="w-full px-6 py-4 rounded-2xl border-2 border-violet-100 bg-violet-50/30 outline-none focus:bg-white focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition font-black text-lg text-violet-700"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ألف دينار
                    </div>
                  </div>
                  {deliveryPrice > baseDeliveryPrice && (
                    <p className="mt-2 text-[10px] font-bold text-emerald-600">
                      شكراً لك! زيادة سعر التوصيل تساهم في سرعة استجابة المناديب لطلبك.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 h-fit">
          <div className="bg-slate-900 text-white p-10 rounded-[4rem] shadow-2xl shadow-violet-200/20">
            <h2 className="text-2xl font-black mb-8">ملخص الطلب</h2>

            <div className="space-y-4 mb-8">
              {cart.map((item) => {
                const itemTotal = item.price * item.quantity;
                return (
                  <div key={item.id} className="flex justify-between items-center text-slate-400">
                    <span className="font-bold">{item.name} × {item.quantity}</span>
                    <span className="font-black text-white">{fmtAlf(itemTotal)}</span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-800 pt-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-black text-violet-400">مجموع المنتجات</span>
                <span className="text-2xl font-black text-white tabular-nums">{fmtAlf(subtotal)}</span>
              </div>
              {deliveryPrice > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-lg font-black text-violet-400">سعر التوصيل</span>
                  <span className="text-2xl font-black text-white tabular-nums">{fmtAlf(deliveryPrice)}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-slate-800 pt-4 mt-2">
                <span className="text-xl font-black text-white">المجموع الكلي</span>
                <span className="text-3xl font-black text-violet-400 tabular-nums">{fmtAlf(subtotal + deliveryPrice)}</span>
              </div>
              <p className="text-center text-sm font-bold text-slate-400 leading-relaxed">
                {deliveryPrice > 0 ? "السعر النهائي شامل التوصيل" : "السعر الكلي بدون التجهيز والتوصيل"}
              </p>
            </div>

            {typeof state.error === "string" && !state.error.includes("منطقة") ? (
              <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm font-bold text-center">
                {state.error}
              </div>
            ) : null}

            <button
              type="submit"
              className="w-full mt-10 py-5 bg-violet-600 text-white rounded-[2rem] font-black text-xl hover:bg-violet-500 transition-all transform active:scale-95 shadow-xl shadow-violet-900/40"
            >
              تأكيد وإرسال الطلب
            </button>
            <p className="text-center text-[10px] text-slate-500 mt-6 font-bold">بالنقر على تأكيد الطلب، فإنك توافق على شروط الخدمة وسياسة الخصوصية.</p>
          </div>
        </div>
      </form>
    </div>
  );
}
