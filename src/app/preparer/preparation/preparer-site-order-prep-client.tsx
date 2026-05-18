"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ALF_PER_DINAR, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { submitPreparerShoppingOrder, type PreparerActionState } from "../actions";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { parseFlexibleOrderLines } from "@/lib/flexible-order-parse";
import {
  extractPhoneNumberFromText,
  parseSiteOrderMessage,
} from "@/lib/site-order-parse";
import { buildCustomerInvoiceText } from "@/lib/preparation-invoice";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import type { PreparerShoppingPayloadV1 } from "@/lib/preparer-shopping-payload";
import { normalizeRegionNameForMatch } from "@/lib/region-name-normalize";
import { calculateAutoSellPrice } from "@/lib/auto-pricing";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";

/** سطر واحد = شراء فقط (الموقع يحسب البيع)؛ سطران = شراء ثم بيع يدوي. */
function parseTwoLinePricing(line: string, raw: string): { buy: string; sell: string } | null {
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/,/g, ".").trim());
  const nonEmpty = lines.filter((l) => l.length > 0);
  if (nonEmpty.length === 0) return null;

  const buyNum = parseFloat(nonEmpty[0]!);
  if (!Number.isFinite(buyNum)) return null;

  if (nonEmpty.length === 1) {
    // تسعير تلقائي
    const sellAuto = calculateAutoSellPrice(line, buyNum);
    return { buy: nonEmpty[0]!, sell: sellAuto.toString() };
  }

  return { buy: nonEmpty[0]!, sell: nonEmpty[1]! };
}

/** هل يوجد سعر صالح في السطر الأول (على الأقل). */
function hasCompletePriceLines(text: string): boolean {
  const nonEmpty = text
    .split(/\r?\n/)
    .map((l) => l.replace(/,/g, ".").trim())
    .filter((l) => l.length > 0);
  if (nonEmpty.length < 1) return false;
  const bn = parseFloat(nonEmpty[0]!);
  return Number.isFinite(bn) && bn >= 0;
}

const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

type RegionHit = { id: string; name: string; deliveryPrice: string };

const initial: PreparerActionState = {};

type ShopOpt = {
  id: string;
  name: string;
  shopRegionName: string;
  shopDeliveryAlf: number;
};

type Props = {
  auth: { p: string; exp: string; s: string };
  preparerName: string;
  shops: ShopOpt[];
  homeHref: string;
};

const PASTE_HELP = `مثال (واتساب — أي ترتيب للأسطر طالما في عنوان واضح ورقم ومنتجات):

شيخ ابراهيم
07718285825
٢ كيلو بطاطا
٢ كيلو طماطة
خبز`;

export function PreparerSiteOrderPrepClient({ auth, preparerName, shops, homeHref }: Props) {
  const [state, formAction, pending] = useActionState(submitPreparerShoppingOrder, initial);
  const regionSearchRef = useRef<HTMLInputElement>(null);

  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [titleLine, setTitleLine] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [rawListText, setRawListText] = useState("");

  const [shopId, setShopId] = useState(shops[0]?.id ?? "");
  const shop = shops.find((s) => s.id === shopId) ?? shops[0];

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [selected, setSelected] = useState<RegionHit | null>(null);

  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderTime, setOrderTime] = useState("فوري");
  const [customerLandmark, setCustomerLandmark] = useState("");

  const [blockedPhone, setBlockedPhone] = useState<string | null>(null);

  const [priceRows, setPriceRows] = useState<{ buy: string; sell: string }[]>([]);
  const [placesCount, setPlacesCount] = useState<number | null>(null);

  const [selectedPriceIndex, setSelectedPriceIndex] = useState<number | null>(null);
  const [pricingLinesText, setPricingLinesText] = useState("");
  const [pricingErr, setPricingErr] = useState<string | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [bulkAddText, setBulkAddText] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  /** idle → بعد التحليل؛ need_pick → يجب اختيار المنطقة قبل عرض المنتجات؛ ready → يمكن التسعير */
  const [regionGate, setRegionGate] = useState<"idle" | "need_pick" | "ready">("idle");
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

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

  useEffect(() => {
    setPriceRows((prev) => {
      const next = products.map((_, i) => prev[i] ?? { buy: "", sell: "" });
      return next.slice(0, products.length);
    });
  }, [products.length]);

  useEffect(() => {
    const err = state.error?.trim();
    if (!err) return;
    if (err.includes("منطقة")) {
      regionSearchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [state.error]);

  async function resolveRegionAfterParse(title: string) {
    const qq = title.trim();
    if (qq.length < 2) {
      setRegionGate("need_pick");
      return;
    }
    try {
      const r = await fetch(`/api/regions/search?q=${encodeURIComponent(qq)}`);
      const j = (await r.json()) as { regions?: RegionHit[] };
      const list = j.regions ?? [];
      const normTitle = normalizeRegionNameForMatch(qq);
      if (list.length === 0) {
        setQ(qq);
        setSelected(null);
        setRegionGate("need_pick");
        return;
      }
      if (list.length === 1) {
        setSelected(list[0]!);
        setQ(list[0]!.name);
        setRegionGate("ready");
        return;
      }
      const exact = list.find((x) => normalizeRegionNameForMatch(x.name) === normTitle);
      if (exact) {
        setSelected(exact);
        setQ(exact.name);
        setRegionGate("ready");
        return;
      }
      setQ(qq);
      setSelected(null);
      setRegionGate("need_pick");
    } catch {
      setRegionGate("need_pick");
    }
  }

  async function runParse() {
    setParseError(null);
    setRegionGate("idle");
    const t = pasteText.trim();
    if (!t) {
      setParseError("الصق نص القائمة أولاً.");
      return;
    }

    let phone = "";
    let flex = parseFlexibleOrderLines(t);
    let site = null;

    if (flex) {
      phone = flex.phone;
    } else {
      site = parseSiteOrderMessage(t);
      if (site && site.items.length > 0) {
        phone = extractPhoneNumberFromText(t) ?? "";
      }
    }

    if (phone) {
      try {
        const check = await fetch(`/api/check-block?phone=${encodeURIComponent(phone)}`);
        const blockRes = await check.json();
        if (blockRes.blocked) {
          setBlockedPhone(blockRes.phone);
          return;
        }
      } catch (e) {
        console.error("Block check failed", e);
      }
    }

    if (flex) {
      setTitleLine(flex.title);
      setProducts([...flex.products]);
      setCustomerPhone(flex.phone);
      setRawListText(t);
      setQ(flex.title);
      setSelected(null);
      void resolveRegionAfterParse(flex.title);
      return;
    }

    if (site && site.items.length > 0) {
      const title = (site.address || site.landmark || "طلب موقع").trim();
      const prods = site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim());
      setTitleLine(title);
      setProducts(prods);
      setCustomerPhone(phone);
      setCustomerName(site.customerName.trim());
      setCustomerLandmark(site.landmark.trim());
      setRawListText(t);
      setQ(title);
      setSelected(null);
      void resolveRegionAfterParse(title);
      return;
    }
    setParseError(
      "لم أستطع فهم القائمة. تأكد من وجود سطر عنوان، ورقم موبايل عراقي، ومنتجات (سطر لكل منتج). يمكنك تجربة تنسيق «اسم الزبون / العنوان» من الموقع.",
    );
  }

  function addProductsFromTextarea(extra: string) {
    const lines = extra
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setProducts((p) => [...p, ...lines]);
    setShowAddProduct(false);
    setBulkAddText("");
  }

  function removeProduct(i: number) {
    setSelectedPriceIndex((sel) => {
      if (sel === null) return null;
      if (sel === i) return null;
      if (sel > i) return sel - 1;
      return sel;
    });
    setProducts((p) => p.filter((_, j) => j !== i));
  }

  function isRowPriced(i: number): boolean {
    const row = priceRows[i];
    if (!row) return false;
    const b = row.buy.replace(/,/g, ".").trim();
    const s = row.sell.replace(/,/g, ".").trim();
    if (!b || !s) return false;
    const bn = parseFloat(b);
    const sn = parseFloat(s);
    return Number.isFinite(bn) && Number.isFinite(sn) && bn >= 0 && sn >= 0;
  }

  function handleProductButton(i: number) {
    if (deleteMode) {
      removeProduct(i);
      return;
    }
    setShowAddProduct(false);
    setPricingErr(null);
    const row = priceRows[i];
    if (row?.buy?.trim()) {
      setPricingLinesText(row.buy.trim());
    } else {
      setPricingLinesText("");
    }
    setSelectedPriceIndex(i);
  }

  function applyPricingPanel() {
    setPricingErr(null);
    if (selectedPriceIndex === null) return;
    const line = products[selectedPriceIndex]!;
    const parsed = parseTwoLinePricing(line, pricingLinesText);
    if (!parsed) {
      setPricingErr("اكتب سعر الشراء .");
      return;
    }
    const bn = parseFloat(parsed.buy.replace(/,/g, "."));
    const sn = parseFloat(parsed.sell.replace(/,/g, "."));
    if (!Number.isFinite(bn) || !Number.isFinite(sn) || bn < 0 || sn < 0) {
      setPricingErr("تأكد أن الأرقام صالحة .");
      return;
    }
    const i = selectedPriceIndex;
    setPriceRows((rows) => {
      const next = [...rows];
      next[i] = { buy: parsed.buy, sell: parsed.sell };
      return next;
    });
    setSelectedPriceIndex(null);
    setPricingLinesText("");
  }

  function cancelPricingPanel() {
    setSelectedPriceIndex(null);
    setPricingLinesText("");
    setPricingErr(null);
  }

  const custDelAlf = selected ? Number(selected.deliveryPrice) / ALF_PER_DINAR : NaN;
  const deliveryAlf =
    shop && selected && !Number.isNaN(custDelAlf) ? Math.max(shop.shopDeliveryAlf, custDelAlf) : null;

  const allPriced = useMemo(() => {
    if (products.length === 0) return false;
    for (let i = 0; i < products.length; i++) {
      if (!isRowPriced(i)) return false;
    }
    return true;
  }, [products, priceRows]);

  /** المنتجات المسعّرة تُعرض أولاً. */
  const sortedProductIndices = useMemo(() => {
    return products.map((_, i) => i).sort((a, b) => {
      const pa = isRowPriced(a) ? 1 : 0;
      const pb = isRowPriced(b) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return a - b;
    });
  }, [products, priceRows]);

  const previewPayload: PreparerShoppingPayloadV1 | null = useMemo(() => {
    if (!titleLine.trim() || products.length === 0 || !allPriced || placesCount == null) return null;
    return {
      version: 1,
      titleLine: titleLine.trim(),
      placesCount,
      rawListText: rawListText.trim() || undefined,
      products: products.map((line, i) => {
        const row = priceRows[i]!;
        const buyAlf = parseFloat(row.buy.replace(/,/g, ".").trim());
        const sellAlf = parseFloat(row.sell.replace(/,/g, ".").trim());
        return { line, buyAlf, sellAlf };
      }),
    };
  }, [titleLine, products, priceRows, allPriced, placesCount, rawListText]);

  const previewInvoice =
    previewPayload && deliveryAlf != null
      ? buildCustomerInvoiceText({
          brandLabel: "أبو الأكبر للتوصيل",
          orderNumberLabel: "مسودة",
          regionTitle: previewPayload.titleLine,
          phone: customerPhone.trim() || "—",
          lines: previewPayload.products.map((p) => ({
            line: p.line,
            buyAlf: p.buyAlf,
            sellAlf: p.sellAlf,
          })),
          placesCount: previewPayload.placesCount,
          deliveryAlf,
        })
      : null;

  const shoppingPayloadJson = previewPayload ? JSON.stringify(previewPayload) : "";

  const canSubmit =
    previewPayload &&
    selected &&
    customerPhone.trim() &&
    orderTime.trim() &&
    shoppingPayloadJson.length > 0;

  const showMainFlow = products.length > 0 && selected !== null && regionGate === "ready";

  if (state.ok && state.orderNumber != null) {
    return (
      <div className="mx-auto max-w-lg" role="status" aria-live="polite">
        <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-8 text-center shadow-sm">
          <div className="flex justify-center">
            <DynamicIcon
              iconKey="ui_success"
              config={icons}
              className="h-12 w-12 text-emerald-600"
              fallback={<span className="text-4xl">✓</span>}
            />
          </div>
          <h2 className="mt-3 text-xl font-bold text-emerald-800">تم رفع طلب التجهيز</h2>
          <p className="mt-2 text-lg font-black text-slate-900">رقم الطلب: #{state.orderNumber}</p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href={preparerPath("/preparer/preparation", auth)}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-center text-sm font-bold text-white shadow-md hover:bg-emerald-700"
            >
              تجهيز طلب جديد
            </Link>
            <Link
              href={homeHref}
              className="flex w-full items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-50 px-4 py-3.5 text-sm font-bold text-sky-900 hover:bg-sky-100"
            >
              سجل الطلبات
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <section className="kse-glass-dark rounded-2xl border border-violet-200/90 p-4 shadow-sm">
        <p className="text-xs font-semibold text-amber-900">المجهز: {preparerName.trim() || "—"}</p>
        <h2 className="text-base font-black text-violet-950">1) الصق قائمة الواتساب (أو الموقع)</h2>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={8}
          dir="rtl"
          placeholder={PASTE_HELP}
          className={`${inputClass} mt-3 min-h-[10rem] resize-y font-mono text-sm leading-relaxed`}
        />
        <button
          type="button"
          onClick={runParse}
          className="mt-3 w-full rounded-xl border-2 border-violet-500 bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-violet-700"
        >
          تحليل القائمة
        </button>
        {parseError ? (
          <p className="mt-2 text-sm font-semibold text-rose-700" role="alert">
            {parseError}
          </p>
        ) : null}
      </section>

      {products.length > 0 && regionGate === "need_pick" && !selected ? (
        <section className="kse-glass-dark rounded-2xl border border-amber-200/90 p-4 shadow-sm">
          <h2 className="text-sm font-black text-amber-950">اختر منطقة الزبون أولاً</h2>
          <label className="mt-3 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-800">بحث عن المنطقة *</span>
            <input
              ref={regionSearchRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={inputClass}
              placeholder="ابحث واختر…"
              autoComplete="off"
            />
          </label>
          {hits.length > 0 ? (
            <ul className="mt-2 max-h-48 overflow-auto rounded-xl border border-sky-200 bg-white text-sm shadow-md">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-end text-slate-800 hover:bg-sky-50"
                    onClick={() => {
                      setSelected(h);
                      setQ(h.name);
                      setHits([]);
                      setRegionGate("ready");
                    }}
                  >
                    {h.name}{" "}
                    <span className="text-xs text-slate-500">
                      ({formatDinarAsAlfWithUnit(h.deliveryPrice)})
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {showMainFlow ? (
        <>
          <section className="kse-glass-dark rounded-2xl border border-orange-200/90 bg-gradient-to-br from-orange-50/90 to-amber-50/60 p-4 shadow-sm">
            <div className="inline-block rounded-lg bg-orange-500 px-3 py-1 text-sm font-black text-white shadow-sm">
              طلبات
            </div>
            <p className="mt-3 text-sm font-bold text-slate-900">أبو الأكبر للتوصيل</p>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-800" dir="ltr">
              {customerPhone.trim() ? "محمي" : "—"}
            </p>
            <div className="mt-3 rounded-xl border border-orange-200/70 bg-white/85 px-3 py-2.5 text-sm shadow-sm">
              <p>
                <span className="text-slate-600">طلب:</span>{" "}
                <span className="font-bold text-slate-900">{titleLine.trim() || "—"}</span>
              </p>
              <p className="mt-1">
                <span className="text-slate-600">(عدد المنتجات:</span>{" "}
                <span className="font-black text-slate-900">{products.length}</span>
                <span className="text-slate-600">)</span>
              </p>
            </div>
            <label className="mt-3 flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-800">تعديل عنوان المنطقة (يُعرض للزبون)</span>
              <input
                value={titleLine}
                onChange={(e) => setTitleLine(e.target.value)}
                className={inputClass}
              />
            </label>
          </section>

          <section className="kse-glass-dark rounded-2xl border border-sky-200 p-4 shadow-sm">
            <h2 className="text-sm font-black text-sky-950">2) تسعير الطلب</h2>
            <p className="mt-2 text-sm font-bold leading-snug text-slate-900 text-center">
              📝 اختر منتجاً لكتابة سعر الشراء
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddProduct((v) => !v);
                  setDeleteMode(false);
                  cancelPricingPanel();
                }}
                className="min-h-[44px] flex-1 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-black text-emerald-950 shadow-sm transition hover:bg-emerald-100"
              >
                <div className="flex items-center justify-center gap-2">
                  <DynamicIcon
                    iconKey="ui_add"
                    config={icons}
                    className="h-4 w-4"
                    fallback={<span>➕</span>}
                  />
                  <span>إضافة قائمة منتجات</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteMode((v) => !v);
                  setShowAddProduct(false);
                  cancelPricingPanel();
                }}
                className={`min-h-[44px] flex-1 rounded-2xl border-2 px-3 py-2.5 text-sm font-black shadow-sm transition ${
                  deleteMode
                    ? "border-rose-600 bg-rose-600 text-white animate-pulse"
                    : "border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <DynamicIcon
                    iconKey="ui_delete"
                    config={icons}
                    className="h-4 w-4"
                    fallback={<span>🗑️</span>}
                  />
                  <span>مسح منتج</span>
                </div>
              </button>
            </div>
            {deleteMode ? (
              <p className="mt-2 text-xs font-bold text-rose-700 text-center">اضغط على المنتج المراد حذفه.</p>
            ) : null}
            {showAddProduct ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <label className="text-xs font-semibold text-emerald-900">الصق رسالة المنتجات — ثم انقر خارج المربع للإضافة</label>
                <textarea
                  rows={4}
                  value={bulkAddText}
                  onChange={(e) => setBulkAddText(e.target.value)}
                  dir="rtl"
                  placeholder="طماطة 2 كيلو&#10;خبز 2&#10;خيار"
                  className={`${inputClass} mt-1 font-mono text-sm`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v) addProductsFromTextarea(v);
                  }}
                />
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2">
              {sortedProductIndices.map((i) => {
                const line = products[i]!;
                const priced = isRowPriced(i);
                const sellShow = priceRows[i]?.sell?.replace(/,/g, ".").trim();
                return (
                  <button
                    key={`${i}-${line.slice(0, 24)}`}
                    type="button"
                    onClick={() => handleProductButton(i)}
                    className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-start shadow-sm transition active:scale-[0.99] ${
                      selectedPriceIndex === i
                        ? "border-sky-600 bg-sky-50 ring-2 ring-sky-200"
                        : deleteMode
                          ? "border-rose-400 bg-rose-50/80"
                          : priced
                            ? "border-emerald-800 bg-emerald-900 text-white shadow-md"
                            : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/40"
                    }`}
                  >
                    <span className={`min-w-0 flex-1 text-sm font-bold leading-snug ${priced ? "text-emerald-50" : "text-slate-900"}`}>
                      {priced && (
                        <DynamicIcon
                          iconKey="ui_success"
                          config={icons}
                          className="me-1 inline-block h-4 w-4 text-emerald-300"
                          fallback={<span>✅ </span>}
                        />
                      )}
                      {line}
                    </span>
                    {priced && sellShow ? (
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-[10px] font-bold text-emerald-300" dir="ltr">
                          شراء: {priceRows[i]?.buy}
                        </span>
                        <span className="font-mono text-sm font-black tabular-nums text-white" dir="ltr">
                          بيع: {sellShow}
                        </span>
                      </div>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-slate-400">⋯</span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedPriceIndex != null ? (
              <div className="mt-4 rounded-2xl border-2 border-violet-300 bg-violet-50/50 p-4 shadow-inner">
                <p className="text-sm font-bold text-slate-900 text-center">
                  بكم اشتريت &ldquo;{products[selectedPriceIndex]}&rdquo;؟
                </p>
                <p className="mt-2 text-xs leading-relaxed text-amber-900 text-center">
                  💡 اكتب سعر الشراء فقط وسيتم حساب سعر البيع تلقائياً.
                  <br/>
                  للتسعير اليدوي: اكتب الشراء في السطر الأول والبيع في الثاني.
                </p>
                <textarea
                  value={pricingLinesText}
                  onChange={(e) => setPricingLinesText(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.nativeEvent.isComposing) return;
                    if (e.key !== "Enter") return;
                    if (hasCompletePriceLines(pricingLinesText)) {
                      e.preventDefault();
                      applyPricingPanel();
                    }
                  }}
                  rows={2}
                  dir="ltr"
                  placeholder={"سعر الشراء "}
                  className={`${inputClass} mt-2 font-mono text-base tabular-nums leading-relaxed text-center`}
                  inputMode="decimal"
                  autoFocus
                />
                {pricingErr ? (
                  <p className="mt-2 text-xs font-bold text-rose-700 text-center" role="alert">
                    {pricingErr}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={applyPricingPanel}
                    className="min-h-[44px] w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-violet-700"
                  >
                    حفظ السعر
                  </button>
                  <button
                    type="button"
                    onClick={cancelPricingPanel}
                    className="min-h-[44px] w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {showMainFlow && allPriced ? (
        <section className="kse-glass-dark rounded-2xl border border-indigo-200/90 p-4 shadow-sm">
          <h2 className="text-sm font-black text-indigo-950">3) كم محلاً تسوقت لهذه الطلبية؟</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPlacesCount(n)}
                className={`min-h-[44px] min-w-[44px] rounded-xl border-2 px-2 text-sm font-black transition ${
                  placesCount === n
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-indigo-200 bg-white text-indigo-950 hover:bg-indigo-50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {placesCount != null ? (
            <p className="mt-2 text-xs text-slate-700 font-bold">
              إضافة تجهيز: <span className="tabular-nums">{calculateExtraAlfFromPlacesCount(placesCount)} </span>
            </p>
          ) : null}
        </section>
      ) : null}

      {showMainFlow && allPriced && placesCount != null ? (
        <section className="kse-glass-dark rounded-2xl border border-sky-200 p-4 shadow-sm">
          <h2 className="text-sm font-black text-sky-950">4) المحل والزبون</h2>
          <label className="mt-3 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-800">المحل *</span>
            <select
              form="prep-form"
              name="shopId"
              required
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              className={inputClass}
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-800">رقم الزبون *</span>
            <input
              form="prep-form"
              name="customerPhone"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className={`${inputClass} font-mono tabular-nums`}
              inputMode="numeric"
            />
          </label>

          <label className="mt-3 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-800">وقت الطلب *</span>
            <input
              form="prep-form"
              name="orderTime"
              required
              value={orderTime}
              onChange={(e) => setOrderTime(e.target.value)}
              className={inputClass}
            />
          </label>
        </section>
      ) : null}

      {previewInvoice ? (
        <section className="kse-glass-dark rounded-2xl border border-emerald-200/90 p-4 shadow-sm">
          <h2 className="text-sm font-black text-emerald-950">5) معاينة فاتورة الزبون</h2>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-800" dir="rtl">
            {previewInvoice}
          </pre>
        </section>
      ) : null}

      <form id="prep-form" action={formAction} className="space-y-3">
        <input type="hidden" name="p" value={auth.p} />
        <input type="hidden" name="exp" value={auth.exp} />
        <input type="hidden" name="s" value={auth.s} />
        <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />
        <input type="hidden" name="shoppingPayload" value={shoppingPayloadJson} />

        {state.error ? (
          <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {state.error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending || !canSubmit}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 px-4 py-3.5 text-sm font-black text-white shadow-md transition hover:from-emerald-700 hover:to-sky-700 disabled:opacity-50"
        >
          <div className="flex items-center justify-center gap-2">
            <span>{pending ? "جارٍ الإرسال…" : "رفع الطلب للنظام"}</span>
            {!pending && (
              <DynamicIcon
                iconKey="ui_flash"
                config={icons}
                className="h-4 w-4"
                fallback={<span>🚀</span>}
              />
            )}
          </div>
        </button>
      </form>

      {blockedPhone && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border-2 border-rose-100 bg-white p-6 shadow-2xl text-center animate-in zoom-in duration-300">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <span className="text-3xl">🚫</span>
            </div>
            <h3 className="text-xl font-black text-slate-900">زبون محظور!</h3>
            <p className="mt-3 text-sm font-bold leading-relaxed text-slate-600">
              عذراً، هذا الرقم محظور من التوصيل حالياً.
              <br/>
              <span className="font-mono text-rose-600 mt-1 block" dir="ltr">{blockedPhone}</span>
            </p>
            <button
              type="button"
              onClick={() => setBlockedPhone(null)}
              className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-sm font-black text-white shadow-lg active:scale-95 transition"
            >
              فهمت ذلك
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
