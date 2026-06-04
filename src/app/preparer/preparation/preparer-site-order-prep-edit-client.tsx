"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { ALF_PER_DINAR, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { calculateAutoSellPrice } from "@/lib/auto-pricing";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import type { PreparerShoppingPayloadV1 } from "@/lib/preparer-shopping-payload";
import { updatePreparerShoppingOrder, type PreparerActionState } from "../actions";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";

const initial: PreparerActionState = {};

const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

type ShopOpt = {
  id: string;
  name: string;
  shopRegionName: string;
  shopDeliveryAlf: number;
};

type Props = {
  auth: { p: string; exp: string; s: string };
  orderId: string;
  orderNumber: number;
  preparerName: string;
  shops: ShopOpt[];
  homeHref: string;
  prepHref: string;
  initialData: {
    titleLine: string;
    products: { line: string; buyAlf: number; sellAlf: number }[];
    placesCount: number;
    rawListText?: string;
    shopId: string;
    customerRegionId: string;
    customerRegionName: string;
    customerRegionDeliveryDinar: number;
    customerPhone: string;
    customerName: string;
    orderTime: string;
    customerLandmark: string;
    vehiclePreference?: string | null;
    deliveryPriceOverride?: number | null;
  };
};

export function PreparerSiteOrderPrepEditClient({
  auth,
  orderId,
  orderNumber,
  preparerName,
  shops,
  homeHref,
  prepHref,
  initialData,
}: Props) {
  const [state, formAction, pending] = useActionState(updatePreparerShoppingOrder, initial);

  const [titleLine, setTitleLine] = useState(initialData.titleLine);
  const [products, setProducts] = useState(initialData.products.map((p) => p.line));
  const [priceRows, setPriceRows] = useState(
    initialData.products.map((p) => ({ buy: String(p.buyAlf) })),
  );
  const [placesCount, setPlacesCount] = useState<number | null>(initialData.placesCount);
  const [customerPhone, setCustomerPhone] = useState(initialData.customerPhone);
  const [customerName, setCustomerName] = useState(initialData.customerName);
  const [orderTime, setOrderTime] = useState(initialData.orderTime);
  const [customerLandmark, setCustomerLandmark] = useState(initialData.customerLandmark);
  const [shopId, setShopId] = useState(initialData.shopId);
  const [vehiclePreference, setVehiclePreference] = useState<string | null>(initialData.vehiclePreference || null);
  const [deliveryPriceOverride, setDeliveryPriceOverride] = useState<string>(initialData.deliveryPriceOverride ? String(initialData.deliveryPriceOverride) : "");

  const [selectedPriceIndex, setSelectedPriceIndex] = useState<number | null>(null);
  const [pricingLinesText, setPricingLinesText] = useState("");
  const [pricingErr, setPricingErr] = useState<string | null>(null);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const shop = shops.find((s) => s.id === shopId) ?? shops[0];
  const regionDeliveryAlf = initialData.customerRegionDeliveryDinar / ALF_PER_DINAR;

  const overrideNum = parseFloat(deliveryPriceOverride.replace(/,/g, ".").trim());
  const effectiveBaseDeliveryAlf = (Number.isFinite(overrideNum) && overrideNum > 0)
    ? overrideNum
    : regionDeliveryAlf;

  const deliveryAlf = shop ? Math.max(shop.shopDeliveryAlf, effectiveBaseDeliveryAlf) : effectiveBaseDeliveryAlf;

  const allPriced = useMemo(() => {
    if (products.length === 0) return false;
    return priceRows.every((r) => {
      const bn = parseFloat(r.buy.replace(/,/g, ".").trim());
      return Number.isFinite(bn) && bn >= 0;
    });
  }, [products.length, priceRows]);

  const orderedProducts = useMemo(() => {
    const list = products.map((line, idx) => {
      const row = priceRows[idx] ?? { buy: "" };
      const priced = row.buy.trim().length > 0;
      return {
        line,
        originalIndex: idx,
        row,
        priced,
      };
    });

    return list.sort((a, b) => {
      if (a.priced && !b.priced) return -1;
      if (!a.priced && b.priced) return 1;
      return a.originalIndex - b.originalIndex;
    });
  }, [products, priceRows]);


  const previewPayload: PreparerShoppingPayloadV1 | null = useMemo(() => {
    if (!titleLine.trim() || products.length === 0 || !allPriced || placesCount == null) return null;
    return {
      version: 1,
      titleLine: titleLine.trim(),
      placesCount,
      rawListText: initialData.rawListText?.trim() || undefined,
      products: products.map((line, i) => {
        const row = priceRows[i]!;
        const buyAlf = parseFloat(row.buy.replace(/,/g, ".").trim());
        return {
          line,
          buyAlf,
          sellAlf: calculateAutoSellPrice(line, buyAlf),
        };
      }),
    };
  }, [allPriced, initialData.rawListText, placesCount, priceRows, products, titleLine]);

  const canSubmit =
    previewPayload != null &&
    customerPhone.trim().length > 0 &&
    orderTime.trim().length > 0 &&
    initialData.customerRegionId.length > 0;

  function applyPricingPanel() {
    setPricingErr(null);
    if (selectedPriceIndex == null) return;
    const lines = pricingLinesText
      .split(/\r?\n/)
      .map((x) => x.replace(/,/g, ".").trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setPricingErr("اكتب سعر الشراء.");
      return;
    }
    const buy = lines[0]!;
    const bn = parseFloat(buy);
    if (!Number.isFinite(bn) || bn < 0) {
      setPricingErr("تأكد أن سعر الشراء رقم صحيح.");
      return;
    }
    setPriceRows((prev) => {
      const next = [...prev];
      next[selectedPriceIndex] = { buy };
      return next;
    });
    setSelectedPriceIndex(null);
    setPricingLinesText("");
  }

  if (state.ok) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="kse-glass-dark overflow-hidden border border-emerald-300 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70 p-8 text-center">
          <div className="flex justify-center">
            <DynamicIcon
              iconKey="ui_success"
              config={icons}
              className="h-12 w-12 text-emerald-600"
              fallback={<span className="text-4xl">✓</span>}
            />
          </div>
          <h2 className="mt-4 text-xl font-black text-emerald-800 dark:text-emerald-400">تم تحديث الطلب #{orderNumber}</h2>
          <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-400">تم حفظ الأسعار الجديدة وتحديث أثرها المالي تلقائياً.</p>
          <div className="mt-8 flex flex-col gap-3">
            <Link href={prepHref} className="flex h-12 items-center justify-center rounded-2xl bg-violet-600 text-sm font-black text-white shadow-lg transition hover:bg-violet-700">
              العودة إلى تجهيز الطلبات
            </Link>
            <Link href={homeHref} className="flex h-12 items-center justify-center rounded-2xl border-2 border-sky-200 text-sm font-bold text-sky-900 dark:border-white/10 dark:text-sky-400">
              سجل الطلبات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-24">
      <section className="kse-glass-dark overflow-hidden border border-violet-200/50 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70">
        <div className="bg-violet-600/5 px-4 py-3 border-b border-violet-100 dark:border-white/5 flex items-center justify-between">
           <h2 className="text-sm font-black text-violet-950 dark:text-violet-200">تعديل طلب #{orderNumber}</h2>
           <p className="text-[10px] font-bold text-violet-600/70 dark:text-violet-400/70">المجهز: {preparerName.trim() || "—"}</p>
        </div>
        <div className="p-4 space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">عنوان المنطقة (للفاتورة)</span>
            <input value={titleLine} onChange={(e) => setTitleLine(e.target.value)} className={`${inputClass} dark:bg-slate-950/50 dark:border-white/10 dark:text-white`} />
          </label>
          <div className="rounded-xl bg-violet-50/50 p-2.5 dark:bg-white/5">
             <p className="text-[10px] font-black text-violet-800 dark:text-violet-400">المنطقة المسجلة:</p>
             <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{initialData.customerRegionName}</p>
          </div>
        </div>
      </section>

      <section className="kse-glass-dark overflow-hidden border border-sky-200/50 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70">
        <div className="bg-sky-500/5 px-4 py-3 border-b border-sky-100 dark:border-white/5">
           <h2 className="text-sm font-black text-sky-950 dark:text-sky-200">المنتجات والتسعير</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 gap-2.5">
            {orderedProducts.map(({ line, originalIndex: i, row, priced }) => {
              return (
                <button
                  key={`${i}-${line.slice(0, 18)}`}
                  type="button"
                  onClick={() => {
                    const b = row.buy.trim().replace(/,/g, ".");
                    setSelectedPriceIndex(i);
                    setPricingErr(null);
                    setPricingLinesText(b);
                  }}
                  className={`group relative flex min-h-[56px] w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border-2 px-4 py-3 text-start transition-all active:scale-[0.98] ${
                    selectedPriceIndex === i
                      ? "border-sky-500 bg-sky-50 shadow-md ring-4 ring-sky-500/10 dark:bg-sky-500/10"
                      : priced
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-100 bg-white/50 hover:border-sky-200 dark:border-white/5 dark:bg-slate-950/40"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                     {priced ? (
                       <span className="shrink-0 text-white pr-1">✅</span>
                     ) : (
                       <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${priced ? "bg-white" : "bg-slate-300 group-hover:bg-sky-400 dark:bg-slate-700"}`} />
                     )}
                     <span className={`truncate text-sm font-bold ${priced ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>{line}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`font-mono text-sm font-black tabular-nums ${priced ? "text-white" : "text-slate-500 dark:text-slate-400"}`} dir="ltr">
                      {row.buy.replace(/,/g, ".") || "⋯"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedPriceIndex != null && (
            <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300">
               <div className="mx-auto max-w-lg">
                 <div className="kse-glass-dark m-4 overflow-hidden border border-sky-200 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/90">
                    <div className="bg-sky-600 px-4 py-3 text-white">
                       <p className="text-xs font-bold opacity-80">تعديل سعر:</p>
                       <p className="truncate text-sm font-black">{products[selectedPriceIndex]}</p>
                    </div>
                    <div className="p-5">
                       <textarea
                         value={pricingLinesText}
                         onChange={(e) => setPricingLinesText(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === "Enter") {
                              e.preventDefault();
                              applyPricingPanel();
                           }
                         }}
                         rows={2}
                         dir="ltr"
                         placeholder="سعر الشراء"
                         className="w-full rounded-2xl border-2 border-sky-100 bg-slate-50 px-4 py-4 text-center font-mono text-2xl font-black tabular-nums text-sky-950 outline-none transition focus:border-sky-500 focus:bg-white dark:border-white/5 dark:bg-black/20 dark:text-white"
                         inputMode="decimal"
                         autoFocus
                       />
                       {pricingErr && <p className="mt-2 text-center text-xs font-bold text-rose-600">{pricingErr}</p>}
                       <div className="mt-5 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedPriceIndex(null)}
                            className="rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-white/5 dark:bg-white/5 dark:text-slate-300"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={applyPricingPanel}
                            className="rounded-2xl bg-sky-600 py-3.5 text-sm font-black text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 active:scale-95 dark:shadow-none"
                          >
                            حفظ
                          </button>
                       </div>
                    </div>
                 </div>
               </div>
            </div>
          )}
        </div>
      </section>

      <section className="kse-glass-dark overflow-hidden border border-indigo-200/50 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70">
        <div className="bg-indigo-500/5 px-4 py-3 border-b border-indigo-100 dark:border-white/5">
           <h2 className="text-sm font-black text-indigo-950 dark:text-indigo-200">عدد المحلات</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPlacesCount(n)}
                className={`flex h-12 items-center justify-center rounded-xl border-2 text-sm font-black transition-all ${
                  placesCount === n
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-lg dark:border-indigo-500 dark:bg-indigo-500"
                    : "border-slate-100 bg-white/50 text-slate-400 hover:border-indigo-200 hover:text-indigo-600 dark:border-white/5 dark:bg-slate-950/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {placesCount != null && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
              <span>إضافة تجهيز:</span>
              <span className="font-mono tabular-nums">+{calculateExtraAlfFromPlacesCount(placesCount)}</span>
            </div>
          )}
        </div>
      </section>

      <section className="kse-glass-dark overflow-hidden border border-emerald-200/50 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70">
        <div className="bg-emerald-500/5 px-4 py-3 border-b border-emerald-100 dark:border-white/5">
           <h2 className="text-sm font-black text-emerald-950 dark:text-emerald-200">بيانات الشحن والمركبة</h2>
        </div>
        <div className="p-4 space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">المحل *</span>
            <select value={shopId} onChange={(e) => setShopId(e.target.value)} className={`${inputClass} dark:bg-slate-950/50 dark:border-white/10 dark:text-white`}>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3">
             <label className="flex flex-col gap-1.5">
               <span className="text-xs font-bold text-slate-600 dark:text-slate-400">اسم الزبون</span>
               <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={`${inputClass} dark:bg-slate-950/50 dark:border-white/10`} />
             </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <label className="flex flex-col gap-1.5">
               <span className="text-xs font-bold text-slate-600 dark:text-slate-400">وقت الطلب</span>
               <input value={orderTime} onChange={(e) => setOrderTime(e.target.value)} className={`${inputClass} dark:bg-slate-950/50 dark:border-white/10`} />
             </label>
             <label className="flex flex-col gap-1.5">
               <span className="text-xs font-bold text-slate-600 dark:text-slate-400">أقرب نقطة دالة</span>
               <input value={customerLandmark} onChange={(e) => setCustomerLandmark(e.target.value)} className={`${inputClass} dark:bg-slate-950/50 dark:border-white/10`} />
             </label>
          </div>

          <div className="pt-2">
            <p className="mb-2 text-xs font-black text-slate-500 dark:text-slate-400">تفضيل المركبة:</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVehiclePreference("bike")}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 py-3 transition ${
                  vehiclePreference === "bike" ? "border-sky-600 bg-sky-50 text-sky-900 dark:bg-sky-500/20 dark:text-sky-300" : "border-slate-100 bg-white/50 text-slate-400 dark:border-white/5 dark:bg-slate-950/40"
                }`}
              >
                <span className="text-2xl">🏍️</span>
                <span className="text-[10px] font-black uppercase tracking-wider">دراجة</span>
              </button>
              <button
                type="button"
                onClick={() => setVehiclePreference("car")}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 py-3 transition ${
                  vehiclePreference === "car" ? "border-sky-600 bg-sky-50 text-sky-900 dark:bg-sky-500/20 dark:text-sky-300" : "border-slate-100 bg-white/50 text-slate-400 dark:border-white/5 dark:bg-slate-950/40"
                }`}
              >
                <span className="text-2xl">🚗</span>
                <span className="text-[10px] font-black uppercase tracking-wider">سيارة</span>
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">تعديل التوصيل الأساسي (اختياري)</span>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={deliveryPriceOverride}
                onChange={(e) => setDeliveryPriceOverride(e.target.value)}
                placeholder={`الحالي: ${regionDeliveryAlf}`}
                className={`${inputClass} font-mono dark:bg-slate-950/50 dark:border-white/10`}
              />
              <span className="absolute inset-y-0 left-3 flex items-center text-[10px] font-bold text-slate-400">ألف</span>
            </div>
          </label>
        </div>
      </section>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 animate-in slide-in-from-bottom duration-300">
         <div className="kse-glass-dark mx-auto max-w-lg rounded-t-3xl border-t border-sky-200 bg-white/80 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/90">
            <form action={formAction} className="flex gap-3">
              <input type="hidden" name="p" value={auth.p} />
              <input type="hidden" name="exp" value={auth.exp} />
              <input type="hidden" name="s" value={auth.s} />
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="shopId" value={shopId} />
              <input type="hidden" name="customerRegionId" value={initialData.customerRegionId} />
              <input type="hidden" name="shoppingPayload" value={previewPayload ? JSON.stringify(previewPayload) : ""} />
              <input type="hidden" name="customerPhone" value={customerPhone} />
              <input type="hidden" name="customerName" value={customerName} />
              <input type="hidden" name="orderTime" value={orderTime} />
              <input type="hidden" name="customerLandmark" value={customerLandmark} />
              <input type="hidden" name="vehiclePreference" value={vehiclePreference || ""} />
              <input type="hidden" name="deliveryPriceOverride" value={deliveryPriceOverride} />

              <Link href={preparerPath("/preparer/preparation", auth)} className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                 <span className="text-xl">🔙</span>
              </Link>

              <button
                type="submit"
                disabled={pending || !canSubmit}
                className="flex h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 px-6 text-sm font-black text-white shadow-xl shadow-emerald-200/50 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 dark:shadow-none"
              >
                <span>{pending ? "جارٍ التحديث..." : "حفظ التعديلات"}</span>
                {!pending && <DynamicIcon iconKey="ui_flash" config={icons} className="h-5 w-5" fallback={null} />}
              </button>
            </form>
         </div>
      </div>

      {state.error && (
        <div className="fixed bottom-24 left-4 right-4 z-30">
           <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800 shadow-xl dark:border-rose-500/30 dark:bg-rose-950/90 dark:text-rose-200">
              {state.error}
           </div>
        </div>
      )}
    </div>
  );
}

