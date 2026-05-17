"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { resolvePublicImageSrc } from "@/lib/image-url";
import { ALF_PER_DINAR, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { ClientVoiceNoteField } from "./client-voice-note-field";
import { submitOrder, type ClientOrderState } from "./actions";
import { clientOrderAccountPath } from "@/lib/client-order-portal-nav";
import { withoutReversePickupPrefix, isReversePickupOrderType } from "@/lib/order-type-flags";
import { whatsappMeUrl } from "@/lib/whatsapp";

const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

const inputErrorClass = "border-rose-500 ring-2 ring-rose-200 focus:border-rose-600 focus:ring-rose-300";

type RegionHit = { id: string; name: string; deliveryPrice: string };

const initial: ClientOrderState = {};
const OWNER_WHATSAPP_PHONE = "+9647733921468";

function buildCustomerCheckoutMessage(productsText: string): string {
  const productLines = productsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const orderedProducts =
    productLines.length > 0
      ? productLines.map((line, index) => `${index + 1}- ${line}`).join("\n")
      : "1- (لم يتم إدخال تفاصيل المنتجات)";
  return [
    "مرحبا لقد طلبت من خصيب ستور",
    "منتجاتي هي",
    orderedProducts,
    "",
    "ارجو تجهيز الطلب",
    "شكرا لكم",
  ].join("\n");
}

type PropsInner = {
  e: string;
  exp: string;
  sig: string;
  shopName: string;
  employeeName: string;
  photoUrl: string | null;
  shopRegionName: string;
  shopDeliveryAlf: number;
  viewerName: string;
  botUsername?: string;
  portalUrl?: string;
  initialOrder: {
    orderNumber: number;
    customerPhone: string;
    customerName: string;
    orderType: string;
    orderSubtotal: string;
    alternatePhone: string;
    orderTime: string;
    notes: string;
    customerLocationUrl: string;
    customerLandmark: string;
    prepaidAll: boolean;
    customerRegion: { id: string; name: string; deliveryPrice: string };
  } | null;
  onResetForNewOrder?: () => void;
};

export function ClientOrderForm(props: PropsInner) {
  return <ClientOrderFormInner {...props} />;
}

function ClientOrderFormInner({
  e,
  exp,
  sig,
  shopName,
  employeeName,
  photoUrl,
  shopRegionName,
  shopDeliveryAlf,
  viewerName,
  botUsername,
  portalUrl,
  initialOrder,
  onResetForNewOrder,
}: PropsInner) {
  const [state, formAction, pending] = useActionState(submitOrder, initial);
  const formRef = useRef<HTMLFormElement>(null);

  const orderTypeRef = useRef<HTMLInputElement>(null);
  const orderPriceRef = useRef<HTMLInputElement>(null);
  const customerPhoneRef = useRef<HTMLInputElement>(null);
  const orderTimeRef = useRef<HTMLInputElement>(null);
  const regionSearchRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState(initialOrder?.customerRegion.name ?? "");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [selected, setSelected] = useState<RegionHit | null>(initialOrder?.customerRegion ?? null);
  const latestRegionSearchRequestIdRef = useRef(0);

  const [orderPrice, setOrderPrice] = useState(initialOrder?.orderSubtotal ?? "");
  const [orderType, setOrderType] = useState(
    initialOrder ? withoutReversePickupPrefix(initialOrder.orderType) : ""
  );
  const [customerPhone, setCustomerPhone] = useState(initialOrder?.customerPhone ?? "");
  const [customerName] = useState(initialOrder?.customerName || viewerName || employeeName);
  const [alternatePhone, setAlternatePhone] = useState(initialOrder?.alternatePhone ?? "");
  const [orderTime, setOrderTime] = useState(initialOrder?.orderTime ?? "");
  const [notes, setNotes] = useState(initialOrder?.notes ?? "");
  const [customerLandmark, setCustomerLandmark] = useState(initialOrder?.customerLandmark ?? "");
  const [prepaidAll, setPrepaidAll] = useState(initialOrder?.prepaidAll ?? false);
  const [reversePickup, setReversePickup] = useState(
    initialOrder ? isReversePickupOrderType(initialOrder.orderType) : false
  );
  const [vehiclePreference, setVehiclePreference] = useState("");
  const [deliveryPriceOverride, setDeliveryPriceOverride] = useState<string>("");

  const [extraInfoOpen, setExtraInfoOpen] = useState(false);
  const [showNoPriceConfirm, setShowNoPriceConfirm] = useState(false);
  const [allowNoPriceSubmit, setAllowNoPriceSubmit] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    if (selected && q === selected.name) {
      setHits([]);
      return;
    }

    const requestId = ++latestRegionSearchRequestIdRef.current;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/regions/search?q=${encodeURIComponent(query)}`);
          const j = (await r.json()) as { regions?: RegionHit[] };
          // إذا كانت نتيجة قديمة رجعت بعد ما غيّر المستخدم الكتابة/اختيار المنطقة
          // نمنعها من إعادة فتح القائمة.
          if (requestId !== latestRegionSearchRequestIdRef.current) return;
          setHits(j.regions ?? []);
        } catch {
          if (requestId !== latestRegionSearchRequestIdRef.current) return;
          setHits([]);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [q, selected]);

  // بعد نجاح رفع الطلب الجديد: التحويل التلقائي إلى واتساب مع رسالة جاهزة
  useEffect(() => {
    if (state.ok && !initialOrder && state.waUrl) {
      if (state.waUrl !== "#") {
        window.location.href = state.waUrl;
        return;
      }
    }
  }, [state.ok, initialOrder, state.waUrl]);

  // غلق الصفحة تلقائياً بعد نجاح الإرسال بـ 3 ثواني (كتحويل احتياطي)
  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(() => {
        try {
          window.close();
        } catch (e) {
          console.error("Failed to close window:", e);
        }
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [state.ok]);

  // التركيز التلقائي والتمرير للحقل الناقص عند وجود خطأ
  useEffect(() => {
    if (state.error) {
      const err = state.error;
      let target: HTMLElement | null = null;
      if (err.includes("نوع الطلب")) target = orderTypeRef.current;
      else if (err.includes("وقت الطلب") || err.includes("وقت التوصيل")) target = orderTimeRef.current;
      else if (err.includes("منطقة")) target = regionSearchRef.current;
      else if (err.includes("رقم الزبون")) target = customerPhoneRef.current;
      else if (err.includes("سعر الطلب")) target = orderPriceRef.current;

      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [state.error]);

  const normalizedPrice = orderPrice.replace(/,/g, ".").trim();
  const hasOrderPrice = normalizedPrice.length > 0;
  const parsedPrice = hasOrderPrice ? parseFloat(normalizedPrice) : NaN;
  const subtotal = hasOrderPrice && !Number.isNaN(parsedPrice) ? parsedPrice : null;
  const dPrice = selected ? (parseFloat(selected.deliveryPrice) / ALF_PER_DINAR) : 0;
  const totalPrice = (subtotal || 0) + dPrice;

  const historyHrefNav = `/client/order/history?${new URLSearchParams({ e, exp, s: sig, phone: customerPhone }).toString()}`;
  const accountHrefNav = clientOrderAccountPath(e, exp, sig);

  // تحديد الحقول التي بها خطأ لتمييزها بصرياً
  const err = state.error || "";
  const isOrderTypeErr = err.includes("نوع الطلب");
  const isPhoneErr = err.includes("رقم الزبون");
  const isTimeErr = err.includes("وقت الطلب") || err.includes("وقت التوصيل");
  const isRegionErr = err.includes("منطقة");
  const isPriceErr = err.includes("سعر الطلب");

  if (state.ok) {
    return (
      <div className="mx-auto max-w-lg" role="status" aria-live="polite">
        <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-8 text-center shadow-sm">
          <p className="text-4xl">✓</p>
          <h2 className="mt-3 text-xl font-bold text-emerald-800">
            {initialOrder ? "تم تعديل الطلب بنجاح" : "تم رفع الطلب بنجاح"}
          </h2>
          <p className="mt-2 text-sm text-slate-500 italic">
            {initialOrder
              ? "سيتم غلق هذه الصفحة تلقائياً خلال ثوانٍ..."
              : "سيتم تحويلك تلقائياً إلى واتساب خلال لحظات..."}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={onResetForNewOrder || (() => window.location.reload())}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-200/40 transition hover:bg-emerald-700 active:scale-[0.99]"
            >
              رفع طلب جديد
            </button>
            <Link
              href={historyHrefNav}
              className="flex w-full items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-50 px-4 py-3.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
            >
              سجل الطلبات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  function onFormSubmit(e: FormEvent<HTMLFormElement>) {
    if (allowNoPriceSubmit) {
      setAllowNoPriceSubmit(false);
      return;
    }
    if (normalizedPrice) return;
    e.preventDefault();
    setShowNoPriceConfirm(true);
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="mx-auto max-w-lg text-slate-800">
      <form ref={formRef} action={formAction} onSubmit={onFormSubmit} encType="multipart/form-data" className="space-y-5">
        <input type="hidden" name="e" value={e} />
        <input type="hidden" name="exp" value={exp} />
        <input type="hidden" name="s" value={sig} />
        <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />
        {initialOrder && <input type="hidden" name="editOrderNumber" value={initialOrder.orderNumber} />}

        <header className="kse-glass-dark rounded-3xl border border-sky-200 p-6 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-sky-800/60">أبو الأكبر للتوصيل</p>
          {resolvePublicImageSrc(photoUrl) ? (
            <img src={resolvePublicImageSrc(photoUrl)!} alt="" className="mx-auto mt-4 h-24 w-24 rounded-3xl object-cover ring-4 ring-white shadow-lg border border-sky-100" />
          ) : null}

          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-2 text-2xl font-black text-slate-900">
              <span className="opacity-80">أهلاً بك</span>
              <span className="text-emerald-700 underline decoration-emerald-200 underline-offset-4">{customerName}</span>
              <input type="hidden" name="customerName" value={customerName} />
            </div>
            <p className="text-base font-bold text-slate-400">من محل <span className="text-slate-700">{shopName}</span></p>

            <div className="mt-6 mx-auto max-w-[320px] relative">
              <div className="absolute inset-0 bg-emerald-600 blur-xl opacity-10 animate-pulse"></div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 shadow-xl text-white ring-1 ring-emerald-400">
                <p className="relative z-10 text-center text-sm font-black italic tracking-wide">
                  "خدمتكم تسعدنا وطلباتكم أمانة لدينا"
                </p>
              </div>
            </div>
            <p className="mt-4 text-[10px] font-black text-slate-300 tracking-[0.2em] uppercase">{shopRegionName}</p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <Link href={accountHrefNav} className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-emerald-100 py-3.5 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50 active:scale-95">
              <span>📊</span> إحصائياتك
            </Link>
            <Link href={historyHrefNav} className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-sky-100 py-3.5 text-sm font-black text-sky-700 shadow-sm transition hover:bg-sky-50 active:scale-95">
              <span>📜</span> السجل
            </Link>
          </div>

          {botUsername && portalUrl && (
            <div className="mt-4">
              <a
                href={`https://t.me/${botUsername}?text=${encodeURIComponent(portalUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0088cc] py-4 text-sm font-black text-white shadow-lg shadow-sky-200 transition-all hover:bg-[#0077b5] active:scale-95 animate-pulse"
              >
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.51-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.03-.78 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.2z" />
                </svg>
                إرسال الرابط للبوت (تفعيل الحساب)
              </a>
              <p className="mt-2 text-[10px] font-bold text-slate-400">
                سيقوم الزر بكتابة الرابط تلقائياً، فقط اضغط "إرسال" داخل التليجرام.
              </p>
            </div>
          )}
        </header>

        <section className="kse-glass-dark rounded-3xl border border-sky-100 p-6 shadow-sm">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2 mb-6">
            <span className="h-3 w-3 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]"></span>
            {initialOrder ? "تعديل تفاصيل الطلب" : "بيانات الطلبية الجديدة"}
          </h2>

          <div className="space-y-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-slate-600 px-1">نوع الطلب *</span>
              <input ref={orderTypeRef} name="orderType" required autoFocus={!initialOrder} value={orderType} onChange={(e) => setOrderType(e.target.value)} className={`${inputClass} ${isOrderTypeErr ? inputErrorClass : ""}`} placeholder="مثال: بضاعة، طعام، …" />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-slate-600 px-1">سعر الطلب </span>
              <input ref={orderPriceRef} name="orderSubtotal" inputMode="decimal" value={orderPrice} onChange={(e) => setOrderPrice(e.target.value)} className={`${inputClass} font-mono tabular-nums text-lg font-black animate-placeholder ${isPriceErr ? inputErrorClass : ""}`} placeholder="اكتب السعر هنا" />
            </label>

            <div className="relative">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-slate-600 px-1">منطقة الزبون *</span>
                <input ref={regionSearchRef} value={q} onChange={(e) => setQ(e.target.value)} className={`${inputClass} ${isRegionErr ? inputErrorClass : ""}`} placeholder="ابحث عن المنطقة..." required />
              </label>

              {hits.length > 0 && !(selected && q === selected.name) && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-100">
                  {hits.map((h) => (
                    <button key={h.id} type="button" onClick={() => { setSelected(h); setQ(h.name); setHits([]); }} className="flex w-full flex-col px-4 py-3 text-right transition hover:bg-sky-50 border-b border-slate-50 last:border-0">
                      <span className="text-sm font-black text-slate-900">{h.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-slate-600 px-1">نوع المركبة (اختياري)</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "", label: "تلقائي", icon: "✨" },
                  { id: "bike", label: "دراجة", icon: "🏍️" },
                  { id: "car", label: "سيارة", icon: "🚗" },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVehiclePreference(v.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${
                      vehiclePreference === v.id
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm"
                        : "border-slate-100 bg-white text-slate-400 hover:border-slate-200"
                    }`}
                  >
                    <span className="text-xl">{v.icon}</span>
                    <span className="text-[10px] font-black">{v.label}</span>
                  </button>
                ))}
              </div>
              <input type="hidden" name="vehiclePreference" value={vehiclePreference} />
            </label>

            <div className="flex flex-col gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-[11px] font-black text-slate-700 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <span>سعر الطلب:</span>
                  <span className="text-slate-900">{subtotal ?? 0}</span>
                </div>
                <div className="flex gap-1">
                  <span>التوصيل الأساسي:</span>
                  <span className="text-slate-900">{dPrice}</span>
                </div>
              </div>

              {selected && (
                <div className="mt-1 pt-2 border-t border-slate-200/50">
                  <span className="block mb-3 text-[11px] font-black text-sky-800 bg-sky-50 w-fit px-2 py-0.5 rounded-full shadow-sm">يمكنك رفع اجرة التوصيل ان اردت):</span>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        const current = deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice;
                        if (current > dPrice) {
                          setDeliveryPriceOverride((current - 1).toString());
                        }
                      }}
                      className="flex h-12 w-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-2xl font-bold text-slate-400 shadow-sm transition active:scale-95 hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50"
                    >
                      −
                    </button>

                    <div className="flex-1 relative">
                      <input
                        name="deliveryPrice"
                        type="hidden"
                        value={deliveryPriceOverride || dPrice.toFixed(0)}
                      />
                      <div dir="ltr" className="w-full rounded-2xl border-2 border-sky-200 bg-white py-2.5 text-center font-mono text-2xl font-black text-sky-900 shadow-inner ring-4 ring-sky-50/50">
                        {deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const current = deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice;
                        setDeliveryPriceOverride((current + 1).toString());
                      }}
                      className="flex h-12 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-black text-white shadow-[0_4px_0_0_rgba(5,150,105,1)] transition-all active:translate-y-1 active:shadow-none hover:bg-emerald-500"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-1 pt-2 border-t border-slate-200 flex items-center justify-between text-emerald-700">
                <span>السعر الكلي:</span>
                <span dir="ltr" className="text-xl font-black font-mono">
                  {(subtotal || 0) + (deliveryPriceOverride ? parseFloat(deliveryPriceOverride) : dPrice)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="group relative flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-rose-50 bg-white p-4 transition-all hover:border-rose-200 hover:bg-rose-50 shadow-sm">
                <div className="mt-1 relative flex items-center justify-center">
                  <input type="checkbox" name="prepaidAll" checked={prepaidAll} onChange={(e) => setPrepaidAll(e.target.checked)} className="peer h-6 w-6 rounded-lg border-2 border-rose-300 text-rose-600 focus:ring-0" />
                  <svg className="absolute h-4 w-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div className="flex-1 text-sm font-black text-rose-950">كل شي واصل</div>
              </label>

              <label className="group relative flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-amber-50 bg-white p-4 transition-all hover:border-amber-200 hover:bg-amber-50 shadow-sm">
                <div className="mt-1 relative flex items-center justify-center">
                  <input type="checkbox" name="reversePickup" checked={reversePickup} onChange={(e) => setReversePickup(e.target.checked)} className="peer h-5 w-5 rounded border-amber-300 text-amber-600 focus:ring-0" />
                  <svg className="absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div className="flex-1 text-sm font-black text-amber-950">طلب عكسي</div>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-slate-600 px-1">رقم الزبون *</span>
              <input ref={customerPhoneRef} name="customerPhone" required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} inputMode="numeric" className={`${inputClass} font-mono tabular-nums text-lg font-black ${isPhoneErr ? inputErrorClass : ""}`} placeholder="07XXXXXXXXX" />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-slate-600 px-1">وقت التوصيل المفضل *</span>
              <input ref={orderTimeRef} name="orderTime" required value={orderTime} onChange={(e) => setOrderTime(e.target.value)} className={`${inputClass} ${isTimeErr ? inputErrorClass : ""}`} placeholder="مثال: بعد الظهر، الساعة 4، …" />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-slate-600 px-1">ملاحظات وقائمة الطلب</span>
              <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className={`${inputClass} min-h-[100px] resize-none`} placeholder="اكتب تفاصيل المواد المطلوبة أو أي ملاحظات أخرى للمندوب..." />
            </label>

            <div className="pt-2">
              <span className="text-sm font-bold text-slate-600 px-1 block mb-3">صورة الطلب (اختياري)</span>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/50 py-4 transition hover:bg-sky-50 hover:border-sky-300 group"
                >
                  <span className="text-2xl group-active:scale-125 transition">📸</span>
                  <span className="text-xs font-black text-sky-800">الكاميرا</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/50 py-4 transition hover:bg-sky-50 hover:border-sky-300 group"
                >
                  <span className="text-2xl group-active:scale-125 transition">🖼️</span>
                  <span className="text-xs font-black text-sky-800">المعرض</span>
                </button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                name="orderImage"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageChange}
              />
              <input
                ref={galleryInputRef}
                type="file"
                name="orderImage"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />

              {imagePreview && (
                <div className="mt-4 relative group">
                  <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-2xl border-2 border-sky-100 shadow-sm" />
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      if (cameraInputRef.current) cameraInputRef.current.value = "";
                      if (galleryInputRef.current) galleryInputRef.current.value = "";
                    }}
                    className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-rose-500 text-white shadow-lg flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2">
              <span className="text-sm font-bold text-slate-600 px-1 block mb-2">ملاحظة صوتية (اختياري)</span>
              <ClientVoiceNoteField fieldName="voiceNote" />
            </div>
          </div>
        </section>

        <section className="kse-glass-dark rounded-3xl border border-sky-100 p-6 shadow-sm">
          <button type="button" onClick={() => setExtraInfoOpen(!extraInfoOpen)} className="w-full flex items-center justify-between group">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
              البيانات الإضافية
            </h2>
            <span className={`text-sky-600 transition-transform duration-300 ${extraInfoOpen ? "rotate-180" : ""}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </span>
          </button>

          {extraInfoOpen && (
            <div className="mt-6 space-y-5 animate-in slide-in-from-top-4 duration-300">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-slate-600 px-1">رقم ثاني للزبون (اختياري)</span>
                <input name="alternatePhone" value={alternatePhone} onChange={(e) => setAlternatePhone(e.target.value)} inputMode="numeric" className={`${inputClass} font-mono tabular-nums`} placeholder="07XXXXXXXXX" />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-slate-600 px-1">أقرب نقطة دالة</span>
                <input name="customerLandmark" value={customerLandmark} onChange={(e) => setCustomerLandmark(e.target.value)} className={inputClass} placeholder="مثال: خلف جامع البركة، قرب مدرسة …" />
              </label>
            </div>
          )}
        </section>


        {state.error ? (
          <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 text-center text-sm font-black text-rose-800 animate-shake">
            ⚠️ {state.error}
          </div>
        ) : null}

        <button type="submit" disabled={pending} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 py-4 text-lg font-black text-white shadow-xl shadow-emerald-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
          {pending ? "جارٍ إرسال الطلب..." : initialOrder ? "تحديث الطلبية الآن" : "إرسال الطلب للاداره"}
        </button>
      </form>

      {showNoPriceConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-lg font-black text-slate-900">بدون سعر طلب؟</h3>
              <p className="mt-2 text-sm font-medium text-slate-500 leading-relaxed">
                لم تقم بإدخال سعر للطلب. هل تود الإرسال وترك السعر للمندوب؟
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button type="button" onClick={() => { setAllowNoPriceSubmit(true); setTimeout(() => formRef.current?.requestSubmit(), 0); setShowNoPriceConfirm(false); }} className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white shadow-md transition hover:bg-emerald-700">
                نعم، إرسال الطلب
              </button>
              <button type="button" onClick={() => { setShowNoPriceConfirm(false); orderPriceRef.current?.focus(); }} className="w-full rounded-2xl bg-slate-100 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200">
                تراجع، سأكتب السعر
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
