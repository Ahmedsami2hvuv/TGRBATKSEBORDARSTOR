"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ALF_PER_DINAR, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { calculateAutoSellPrice } from "@/lib/auto-pricing";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import type { PreparerShoppingPayloadV1 } from "@/lib/preparer-shopping-payload";
import { updatePreparerShoppingOrder, type PreparerActionState } from "../actions";
import { preparerPath } from "@/lib/preparer-portal-nav";

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

  const [selectedPriceIndex, setSelectedPriceIndex] = useState<number | null>(null);
  const [pricingLinesText, setPricingLinesText] = useState("");
  const [pricingErr, setPricingErr] = useState<string | null>(null);

  const shop = shops.find((s) => s.id === shopId) ?? shops[0];
  const regionDeliveryAlf = initialData.customerRegionDeliveryDinar / ALF_PER_DINAR;
  const deliveryAlf = shop ? Math.max(shop.shopDeliveryAlf, regionDeliveryAlf) : regionDeliveryAlf;

  const allPriced = useMemo(() => {
    if (products.length === 0) return false;
    return priceRows.every((r) => {
      const bn = parseFloat(r.buy.replace(/,/g, ".").trim());
      return Number.isFinite(bn) && bn >= 0;
    });
  }, [products.length, priceRows]);

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
      <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-8 text-center shadow-sm">
        <p className="text-4xl" aria-hidden>
          ✓
        </p>
        <h2 className="mt-3 text-xl font-bold text-emerald-800">تم تحديث الطلب #{orderNumber}</h2>
        <p className="mt-2 text-sm text-slate-700">تم حفظ الأسعار الجديدة وتحديث أثرها المالي تلقائياً.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Link href={prepHref} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white">
            العودة إلى تجهيز الطلبات
          </Link>
          <Link href={homeHref} className="rounded-xl border border-sky-300 px-4 py-3 text-sm font-bold text-sky-900">
            الطلبات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="kse-glass-dark rounded-2xl border border-violet-200/90 p-4 shadow-sm">
        <p className="text-xs font-semibold text-amber-900">المجهز: {preparerName.trim() || "—"}</p>
        <h2 className="text-base font-black text-violet-950">تعديل تسعير الطلب #{orderNumber}</h2>
      </section>

      <section className="kse-glass-dark rounded-2xl border border-orange-200/90 p-4 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-800">عنوان المنطقة للفاتورة</span>
          <input value={titleLine} onChange={(e) => setTitleLine(e.target.value)} className={inputClass} />
        </label>
        <p className="mt-2 text-xs text-slate-600">المنطقة: {initialData.customerRegionName}</p>
      </section>

      <section className="kse-glass-dark rounded-2xl border border-sky-200 p-4 shadow-sm">
        <h2 className="text-sm font-black text-sky-950">المنتجات والتسعير</h2>
        <div className="mt-3 flex flex-col gap-2">
          {products.map((line, i) => {
            const row = priceRows[i] ?? { buy: "" };
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
                className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-start hover:border-sky-300"
              >
                <span className="min-w-0 flex-1 text-sm font-bold text-slate-900">{line}</span>
                <span className="font-mono text-sm font-black tabular-nums text-slate-700" dir="ltr">
                  {row.buy.replace(/,/g, ".") || "⋯"}
                </span>
              </button>
            );
          })}
        </div>

        {selectedPriceIndex != null ? (
          <div className="mt-4 rounded-2xl border-2 border-violet-300 bg-violet-50/50 p-4">
            <p className="text-sm font-bold text-slate-900">تعديل سعر: {products[selectedPriceIndex]}</p>
            <textarea
              value={pricingLinesText}
              onChange={(e) => setPricingLinesText(e.target.value)}
              rows={4}
              dir="ltr"
              placeholder={"سطر 1: سعر الشراء فقط"}
              className={`${inputClass} mt-2 font-mono`}
            />
            {pricingErr ? <p className="mt-2 text-xs font-bold text-rose-700">{pricingErr}</p> : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={applyPricingPanel}
                className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white"
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPriceIndex(null);
                  setPricingErr(null);
                  setPricingLinesText("");
                }}
                className="flex-1 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="kse-glass-dark rounded-2xl border border-indigo-200/90 p-4 shadow-sm">
        <h2 className="text-sm font-black text-indigo-950">عدد المحلات</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPlacesCount(n)}
              className={`min-h-[44px] min-w-[44px] rounded-xl border-2 px-2 text-sm font-black ${
                placesCount === n ? "border-indigo-600 bg-indigo-600 text-white" : "border-indigo-200 bg-white text-indigo-950"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {placesCount != null ? (
          <p className="mt-2 text-xs text-slate-700">
            إضافة تجهيز: <strong>{calculateExtraAlfFromPlacesCount(placesCount)} ألف</strong>
          </p>
        ) : null}
        <p className="mt-3 text-xs text-slate-500">
          أسعار البيع لا تظهر للمجهز هنا، ويتم حسابها تلقائياً من سعر الشراء.
        </p>
      </section>

      <section className="kse-glass-dark rounded-2xl border border-sky-200 p-4 shadow-sm">
        <h2 className="text-sm font-black text-sky-950">بيانات الطلب</h2>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">المحل</span>
          <select value={shopId} onChange={(e) => setShopId(e.target.value)} className={inputClass}>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">هاتف الزبون</span>
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">اسم الزبون</span>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">وقت الطلب</span>
          <input value={orderTime} onChange={(e) => setOrderTime(e.target.value)} className={inputClass} />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">أقرب نقطة دالة</span>
          <input value={customerLandmark} onChange={(e) => setCustomerLandmark(e.target.value)} className={inputClass} />
        </label>
      </section>


      <form action={formAction} className="space-y-3">
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

        {state.error ? (
          <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.error}</div>
        ) : null}

        <button
          type="submit"
          disabled={pending || !canSubmit}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 px-4 py-3.5 text-sm font-black text-white disabled:opacity-50"
        >
          {pending ? "جارٍ التحديث..." : "حفظ تحديث الطلب"}
        </button>
      </form>

      <p className="text-center text-xs text-slate-500">
        <Link href={preparerPath("/preparer/preparation", auth)} className="font-bold text-sky-700 hover:underline">
          العودة إلى تجهيز الطلبات
        </Link>
      </p>
    </div>
  );
}

