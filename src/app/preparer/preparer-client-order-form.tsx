"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import { resolvePublicImageSrc } from "@/lib/image-url";
import { ALF_PER_DINAR, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { ClientVoiceNoteField } from "@/app/client/order/client-voice-note-field";
import { submitPreparerOrder, type PreparerActionState } from "./actions";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { ShopSearchPicker } from "@/components/shop-search-picker";

const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

type RegionHit = { id: string; name: string; deliveryPrice: string };

const initial: PreparerActionState = {};

type ShopOpt = {
  id: string;
  name: string;
  photoUrl: string;
  shopRegionName: string;
  shopDeliveryAlf: number;
};

type PropsInner = {
  auth: { p: string; exp: string; s: string };
  preparerName: string;
  shops: ShopOpt[];
  ordersHref: string;
  onResetForNewOrder: () => void;
};

function ClientOrderFormInner({
  auth,
  preparerName,
  shops,
  ordersHref,
  onResetForNewOrder,
}: PropsInner) {
  const [state, formAction, pending] = useActionState(submitPreparerOrder, initial);
  const formRef = useRef<HTMLFormElement>(null);

  const orderPriceRef = useRef<HTMLInputElement>(null);
  const regionSearchRef = useRef<HTMLInputElement>(null);

  // الحالة الافتراضية للمحل
  const [shopId, setShopId] = useState(shops[0]?.id ?? "");
  const shop = shops.find((s) => s.id === shopId) ?? shops[0];

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [selected, setSelected] = useState<RegionHit | null>(null);

  const [orderPrice, setOrderPrice] = useState("");
  const [orderType, setOrderType] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [orderTime, setOrderTime] = useState("");
  const [notes, setNotes] = useState("");
  const [customerLocationUrl, setCustomerLocationUrl] = useState("");
  const [customerLandmark, setCustomerLandmark] = useState("");

  const [extraInfoOpen, setExtraInfoOpen] = useState(false);
  const [showNoPriceConfirm, setShowNoPriceConfirm] = useState(false);
  const [allowNoPriceSubmit, setAllowNoPriceSubmit] = useState(false);

  const orderImageMainRef = useRef<HTMLInputElement>(null);
  const orderImageCamRef = useRef<HTMLInputElement>(null);
  const orderImageGalRef = useRef<HTMLInputElement>(null);
  const [orderImagePreview, setOrderImagePreview] = useState<string | null>(null);

  const shopDoorPhotoMainRef = useRef<HTMLInputElement>(null);
  const shopDoorPhotoCamRef = useRef<HTMLInputElement>(null);
  const shopDoorPhotoGalRef = useRef<HTMLInputElement>(null);
  const [shopDoorPhotoPreview, setShopDoorPhotoPreview] = useState<string | null>(null);

  async function syncOrderImageToMain(from: HTMLInputElement) {
    const file = from.files?.[0];
    const main = orderImageMainRef.current;
    if (!file || !main) {
      from.value = "";
      return;
    }
    let toUse = file;
    try {
      toUse = await compressImageFileForUpload(file);
    } catch {
      toUse = file;
    }
    const dt = new DataTransfer();
    dt.items.add(toUse);
    main.files = dt.files;
    if (orderImagePreview) URL.revokeObjectURL(orderImagePreview);
    setOrderImagePreview(URL.createObjectURL(toUse));
    from.value = "";
  }

  async function syncShopDoorPhotoToMain(from: HTMLInputElement) {
    const file = from.files?.[0];
    const main = shopDoorPhotoMainRef.current;
    if (!file || !main) {
      from.value = "";
      return;
    }
    let toUse = file;
    try {
      toUse = await compressImageFileForUpload(file);
    } catch {
      toUse = file;
    }
    const dt = new DataTransfer();
    dt.items.add(toUse);
    main.files = dt.files;
    if (shopDoorPhotoPreview) URL.revokeObjectURL(shopDoorPhotoPreview);
    setShopDoorPhotoPreview(URL.createObjectURL(toUse));
    from.value = "";
  }

  function clearOrderImage() {
    const main = orderImageMainRef.current;
    if (main) {
      const dt = new DataTransfer();
      main.files = dt.files;
    }
    if (orderImagePreview) URL.revokeObjectURL(orderImagePreview);
    setOrderImagePreview(null);
  }

  function clearShopDoorPhoto() {
    const main = shopDoorPhotoMainRef.current;
    if (main) {
      const dt = new DataTransfer();
      main.files = dt.files;
    }
    if (shopDoorPhotoPreview) URL.revokeObjectURL(shopDoorPhotoPreview);
    setShopDoorPhotoPreview(null);
  }

  useEffect(() => {
    return () => {
      if (orderImagePreview) URL.revokeObjectURL(orderImagePreview);
      if (shopDoorPhotoPreview) URL.revokeObjectURL(shopDoorPhotoPreview);
    };
  }, [orderImagePreview, shopDoorPhotoPreview]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/regions/search?q=${encodeURIComponent(q.trim())}`);
          const j = (await r.json()) as { regions?: RegionHit[] };
          setHits(j.regions ?? []);
        } catch {
          setHits([]);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  // غلق الصفحة تلقائياً بعد نجاح الإرسال بـ 3 ثواني
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

  useEffect(() => {
    const err = state.error?.trim();
    if (!err) return;
    const focusTarget = (el: HTMLInputElement | null) => {
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => el.focus(), 120);
    };
    if (err.includes("منطقة الزبون")) {
      focusTarget(regionSearchRef.current);
      return;
    }
    if (err.includes("سعر الطلب")) {
      focusTarget(orderPriceRef.current);
    }
  }, [state.error]);

  const custDelAlf = selected ? Number(selected.deliveryPrice) / ALF_PER_DINAR : NaN;
  const normalizedPrice = orderPrice.replace(/,/g, ".").trim();
  const hasOrderPrice = normalizedPrice.length > 0;
  const parsedPrice = hasOrderPrice ? parseFloat(normalizedPrice) : NaN;

  const delivery =
    selected && !Number.isNaN(custDelAlf) ? Math.max(shop.shopDeliveryAlf, custDelAlf) : null;
  const total =
    delivery != null && hasOrderPrice && !Number.isNaN(parsedPrice)
      ? parsedPrice + delivery
      : null;

  const expLabel =
    auth.exp && !Number.isNaN(parseInt(auth.exp, 10))
      ? new Date(parseInt(auth.exp, 10) * 1000).toLocaleString("ar-IQ-u-nu-latn", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

  const accountHrefNav = ordersHref;
  const historyHrefNav = ordersHref;

  if (state.ok) {
    return (
      <div className="mx-auto max-w-lg" role="status" aria-live="polite">
        <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-8 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            ✓
          </p>
          <h2 className="mt-3 text-xl font-bold text-emerald-800">تم رفع الطلب بنجاح</h2>
          <p className="mt-2 text-sm text-slate-500 italic">سيتم غلق هذه الصفحة تلقائياً خلال ثوانٍ...</p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={onResetForNewOrder}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-200/40 transition hover:bg-emerald-700 active:scale-[0.99]"
            >
              طلب جديد
            </button>
            <Link
              href={historyHrefNav}
              className="flex w-full items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-50 px-4 py-3.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
            >
              سجل الطلبات
            </Link>
            <Link
              href={accountHrefNav}
              className="flex w-full items-center justify-center rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3.5 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
            >
              إحصائيات طلباتك
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

  return (
    <div className="mx-auto max-w-lg">
      <form
        ref={formRef}
        action={formAction}
        onSubmit={onFormSubmit}
        encType="multipart/form-data"
        className="space-y-5"
      >
        <input type="hidden" name="p" value={auth.p} />
        <input type="hidden" name="exp" value={auth.exp} />
        <input type="hidden" name="s" value={auth.s} />

        <section className="kse-glass-dark rounded-2xl border border-sky-200 p-5">
          <ShopSearchPicker
            label="المحل *"
            shops={shops}
            fieldName="shopId"
            value={shopId}
            onValueChange={(id) => setShopId(id)}
            required
          />
        </section>

        <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />

        <header className="kse-glass-dark rounded-2xl border border-sky-200 p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-800">أبو الأكبر للتوصيل</p>
          {resolvePublicImageSrc(shop.photoUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvePublicImageSrc(shop.photoUrl)!}
              alt=""
              className="mx-auto mt-3 h-20 w-20 rounded-2xl object-cover ring-2 ring-sky-300"
            />
          ) : null}

          <h1 className="mt-4 text-2xl font-bold leading-snug text-slate-900">
            أهلاً بك <span className="text-sky-800">{preparerName.trim() || "مجهز"}</span>
            {" "}من <span className="text-emerald-900">{shop.name}</span>
          </h1>
          <p className="mt-2 text-sm text-slate-600">{shop.shopRegionName}</p>

          {expLabel ? (
            <p className="mt-2 text-xs text-slate-500 tabular-nums">صلاحية الرابط حتى: {expLabel}</p>
          ) : null}

          <div className="mt-4 border-t border-sky-100 pt-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link
                href={accountHrefNav}
                className="block w-full rounded-xl border-2 border-emerald-400 bg-emerald-50/90 px-3 py-2.5 text-center text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
              >
                إحصائيات طلباتك
              </Link>
              <Link
                href={historyHrefNav}
                className="block w-full rounded-xl border border-sky-300 bg-white px-3 py-2.5 text-center text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-50"
              >
                سجل الطلبات
              </Link>
            </div>
          </div>
        </header>

        <section className="kse-glass-dark mt-6 rounded-2xl border border-sky-200 p-5">
          <h2 className="text-sm font-bold text-sky-900">ادخل تفاصيل طلبيتكم</h2>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-800">نوع الطلب *</span>
            <input
              name="orderType"
              required
              autoFocus
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
              className={inputClass}
              placeholder="مثال: بضاعة، طعام، …"
            />
          </label>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-800">سعر الطلب  - اختياري</span>
            <input
              ref={orderPriceRef}
              name="orderSubtotal"
              inputMode="decimal"
              value={orderPrice}
              onChange={(e) => setOrderPrice(e.target.value)}
              className={`${inputClass} font-mono tabular-nums animate-placeholder`}
              placeholder="اكتب السعر هنا"
            />
            <span className="text-xs text-slate-500">
              يمكنك تركه فارغاً؛ سيظهر تنبيه تأكيد قبل الإرسال بدون سعر.
            </span>
          </label>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50/85 p-3 text-sm text-slate-800 shadow-sm">
            <input
              type="checkbox"
              name="prepaidAll"
              value="on"
              className="mt-1 h-5 w-5 shrink-0 rounded border-red-400 text-red-600 accent-red-600"
            />
            <span>
              <span className="font-bold text-red-950">كل شي واصل</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-700">
                الطلب مدفوع مسبقاً أو إلكترونياً — المندوب لا يستلم نقداً من الزبون (بما فيه التوصيل).
                يُميّز الطلب بلون مختلف في لوحة المندوب.
              </span>
            </span>
          </label>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-800">رقم الزبون *</span>
            <span className="text-xs text-slate-500">أي صيغة: 07… أو +964… أو مع مسافات — يُحوَّل تلقائياً.</span>
            <input
              name="customerPhone"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              inputMode="numeric"
              className={`${inputClass} font-mono tabular-nums`}
              placeholder="+964 777 363 0152 أو 07773630152"
              autoComplete="tel"
            />
          </label>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-800">رقم ثانٍ للزبون (اختياري)</span>
            <input
              name="alternatePhone"
              value={alternatePhone}
              onChange={(e) => setAlternatePhone(e.target.value)}
              inputMode="numeric"
              className={`${inputClass} font-mono tabular-nums`}
              placeholder="اتركه فارغاً إن لم يوجد"
              autoComplete="tel"
            />
          </label>

          <div className="mt-4">
            <span className="text-sm font-medium text-slate-800">منطقة الزبون * (ابحث واختر)</span>
            <input
              ref={regionSearchRef}
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSelected(null);
              }}
              className={`${inputClass} mt-1.5`}
              placeholder="اكتب حرفين على الأقل للبحث…"
              autoComplete="off"
            />

            {hits.length > 0 && !selected ? (
              <ul
                className="mt-2 max-h-40 overflow-auto rounded-xl border border-sky-200 bg-white text-sm shadow-md"
                role="listbox"
              >
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2.5 text-end text-slate-800 hover:bg-sky-50"
                      onClick={() => {
                        setSelected(h);
                        setQ(h.name);
                        setHits([]);
                      }}
                    >
                      {h.name}{" "}
                      <span className="text-xs text-slate-500 tabular-nums">
                        (توصيل {formatDinarAsAlfWithUnit(h.deliveryPrice)})
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {selected ? <p className="mt-2 text-xs font-medium text-emerald-800">تم الاختيار: {selected.name}</p> : null}

            {delivery != null ? (
              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-slate-800">
                <div className="flex items-center justify-between">
                  <span>سعر التوصيل:</span>
                  <strong className="tabular-nums text-sky-800">{delivery.toFixed(2)}</strong>
                </div>
                <div className="mt-2 pt-2 border-t border-sky-200 flex items-center justify-between">
                  <span className="font-bold">المجموع الكلي:</span>
                  <strong className="tabular-nums text-emerald-800 text-lg">
                    {total != null && !Number.isNaN(total) ? total.toFixed(2) : "—"}
                  </strong>
                </div>
                {!hasOrderPrice ? (
                  <p className="mt-1 text-xs font-semibold text-amber-800">السعر غير مكتوب حالياً. يمكنك الإرسال بدون سعر بعد التأكيد.</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-800">اختر منطقة الزبون لحساب التوصيل.</p>
            )}
          </div>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-800">وقت الطلب (إجباري)</span>
            <input
              name="orderTime"
              value={orderTime}
              onChange={(e) => setOrderTime(e.target.value)}
              required
              className={inputClass}
              placeholder="مثال: بعد المغرب، 6 مساءً"
            />
          </label>

          <label className="mt-4 flex flex-col gap-1.5">
            <span
              className={`text-sm font-medium ${notes.trim() ? "font-bold text-rose-800" : "text-slate-800"}`}
            >
              ملاحظات (اختياري)
            </span>
            <textarea
              name="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputClass} min-h-[5rem] resize-y ${
                notes.trim()
                  ? "border-rose-400 bg-rose-50/90 ring-2 ring-rose-200 focus:border-rose-500 focus:ring-rose-300"
                  : ""
              }`}
              placeholder="أي تفاصيل إضافية، عنوان تقريبي، …"
            />
          </label>

          <ClientVoiceNoteField />

          <div className="mt-4">
            <span className="text-sm font-medium text-slate-800">إضافة صورة (اختياري)</span>
            <p className="mt-1 text-xs text-slate-500">
              اختر <strong className="text-slate-700">كاميرا</strong> للتقاط صورة، أو{" "}
              <strong className="text-slate-700">معرض</strong> لاختيار صورة من الجهاز.
            </p>

            <input
              ref={orderImageMainRef}
              name="orderImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
            <input
              ref={orderImageCamRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={() => {
                void (async () => {
                  if (orderImageCamRef.current) await syncOrderImageToMain(orderImageCamRef.current);
                })();
              }}
            />
            <input
              ref={orderImageGalRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={() => {
                void (async () => {
                  if (orderImageGalRef.current) await syncOrderImageToMain(orderImageGalRef.current);
                })();
              }}
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => orderImageCamRef.current?.click()}
                aria-label="التقاط صورة للطلب بالكاميرا"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-sky-400 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
              >
                <span className="text-lg" aria-hidden>
                  📷
                </span>
                التقاط صورة
              </button>
              <button
                type="button"
                onClick={() => orderImageGalRef.current?.click()}
                aria-label="اختيار صورة الطلب من معرض الصور"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-sky-50"
              >
                <span className="text-lg" aria-hidden>
                  🖼
                </span>
                من المعرض
              </button>
            </div>

            {orderImagePreview ? (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={orderImagePreview}
                  alt="معاينة صورة الطلب"
                  className="h-20 w-20 shrink-0 rounded-lg border border-sky-200 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-emerald-900">تم اختيار صورة</p>
                  <button
                    type="button"
                    onClick={clearOrderImage}
                    className="mt-2 text-xs font-bold text-rose-700 underline hover:text-rose-900"
                  >
                    إزالة الصورة
                  </button>
                </div>
              </div>
            ) : null}
            <p className="mt-2 text-xs leading-relaxed text-slate-500">JPG أو PNG أو Webp — حتى 10 ميجابايت.</p>
          </div>

          <div className="mt-4">
            <span className="text-sm font-medium text-slate-800">صورة باب المحل (اختياري)</span>
            <p className="mt-1 text-xs text-slate-500">
              لتوثيق مكان استلام الطلب من داخل المحل.
            </p>

            <input
              ref={shopDoorPhotoMainRef}
              name="shopDoorPhoto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
            <input
              ref={shopDoorPhotoCamRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={() => {
                void (async () => {
                  if (shopDoorPhotoCamRef.current) await syncShopDoorPhotoToMain(shopDoorPhotoCamRef.current);
                })();
              }}
            />
            <input
              ref={shopDoorPhotoGalRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={() => {
                void (async () => {
                  if (shopDoorPhotoGalRef.current) await syncShopDoorPhotoToMain(shopDoorPhotoGalRef.current);
                })();
              }}
            />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => shopDoorPhotoCamRef.current?.click()}
                aria-label="التقاط صورة باب المحل بالكاميرا"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-sky-400 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
              >
                <span className="text-lg" aria-hidden>
                  📷
                </span>
                التقاط باب المحل
              </button>
              <button
                type="button"
                onClick={() => shopDoorPhotoGalRef.current?.click()}
                aria-label="اختيار صورة باب المحل من المعرض"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-sky-50"
              >
                <span className="text-lg" aria-hidden>
                  🖼
                </span>
                من المعرض
              </button>
            </div>

            {shopDoorPhotoPreview ? (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shopDoorPhotoPreview}
                  alt="معاينة صورة باب المحل"
                  className="h-20 w-20 shrink-0 rounded-lg border border-sky-200 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-emerald-900">تم اختيار صورة</p>
                  <button
                    type="button"
                    onClick={clearShopDoorPhoto}
                    className="mt-2 text-xs font-bold text-rose-700 underline hover:text-rose-900"
                  >
                    إزالة الصورة
                  </button>
                </div>
              </div>
            ) : null}
            <p className="mt-2 text-xs leading-relaxed text-slate-500">JPG أو PNG أو Webp — حتى 10 ميجابايت.</p>
          </div>
        </section>

        <div className="kse-glass-dark rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4">
          <button
            type="button"
            id="extra-info-toggle"
            aria-expanded={extraInfoOpen}
            aria-controls="extra-info-panel"
            onClick={() => setExtraInfoOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-start text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-50"
          >
            <span>معلومات إضافية (موقع الزبون، أقرب نقطة دالة)</span>
            <span className="text-sky-600 tabular-nums" aria-hidden>
              {extraInfoOpen ? "−" : "+"}
            </span>
          </button>
          <div
            id="extra-info-panel"
            role="region"
            aria-hidden={!extraInfoOpen}
            aria-labelledby="extra-info-toggle"
            className={extraInfoOpen ? "mt-4 space-y-4" : "hidden"}
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-800">موقع الزبون (رابط خرائط / لوكيشن) — اختياري</span>
              <input
                name="customerLocationUrl"
                value={customerLocationUrl}
                onChange={(e) => setCustomerLocationUrl(e.target.value)}
                className={inputClass}
                placeholder="الصق رابط خرائط Google أو غيره"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-800">أقرب نقطة دالة — اختياري</span>
              <input
                name="customerLandmark"
                value={customerLandmark}
                onChange={(e) => setCustomerLandmark(e.target.value)}
                className={inputClass}
                placeholder="مثال: قرب مدخل السوق، بجانب …"
              />
            </label>
          </div>
        </div>

        {state.error ? (
          <div
            className="space-y-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            role="alert"
          >
            <p className="font-semibold">{state.error}</p>
            <p className="text-xs leading-relaxed text-rose-900/90">
              لم نمسح ما كتبته؛ صحّح الحقل المشار إليه وأعد الإرسال. إن اخترت صورة قد تحتاج لإعادة
              اختيارها (قيود المتصفح).
            </p>
          </div>
        ) : null}

        {showNoPriceConfirm ? (
          <div
            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900"
            role="alertdialog"
            aria-live="assertive"
          >
            <p className="font-bold">الطلب بدون سعر.</p>
            <p className="mt-1 text-xs">
              هل أنت متأكد من إرسال الطلب بدون سعر؟ يمكنك المتابعة أو تعديل السعر أولاً.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-emerald-500 bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                onClick={() => {
                  setShowNoPriceConfirm(false);
                  setAllowNoPriceSubmit(true);
                  formRef.current?.requestSubmit();
                }}
              >
                موافق
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setShowNoPriceConfirm(false);
                  orderPriceRef.current?.focus();
                }}
              >
                تعديل
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-sky-200 ring-1 ring-sky-400/30 transition hover:from-sky-700 hover:to-cyan-700 active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? "جارٍ الإرسال…" : "رفع الطلب"}
        </button>

        {pending ? (
          <p className="text-center text-xs leading-relaxed text-slate-500">
            قد يستغرق الإرسال وقتاً أطول مع صورة أو تسجيل صوتي؛ انتظر ولا تغلق الصفحة.
          </p>
        ) : null}
      </form>
    </div>
  );
}

export function PreparerClientOrderForm(props: Omit<PropsInner, "onResetForNewOrder">) {
  const [sessionKey, setSessionKey] = useState(0);
  return (
    <ClientOrderFormInner
      key={sessionKey}
      {...props}
      onResetForNewOrder={() => setSessionKey((k) => k + 1)}
    />
  );
}
