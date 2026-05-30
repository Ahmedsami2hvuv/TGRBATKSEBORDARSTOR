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

  const [showPreviewModal, setShowPreviewModal] = useState(false);

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

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-24">
      <section className="kse-glass-dark overflow-hidden border border-violet-200/50 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70">
        <div className="bg-violet-600/5 px-4 py-3 border-b border-violet-100 dark:border-white/5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-violet-950 dark:text-violet-200">1) القائمة</h2>
            <p className="text-[10px] font-bold text-violet-600/70 dark:text-violet-400/70">المجهز: {preparerName.trim() || "—"}</p>
          </div>
        </div>
        <div className="p-4">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            dir="rtl"
            placeholder={PASTE_HELP}
            className={`${inputClass} min-h-[8rem] resize-y font-mono text-sm leading-relaxed dark:bg-slate-950/50 dark:border-white/10 dark:text-white`}
          />
          <button
            type="button"
            onClick={runParse}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-violet-200/50 transition hover:bg-violet-700 active:scale-95 dark:shadow-none"
          >
            <DynamicIcon iconKey="ui_search" config={icons} className="h-4 w-4" fallback={null} />
            تحليل القائمة
          </button>
          {parseError ? (
            <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-900/20 dark:text-rose-400" role="alert">
              {parseError}
            </div>
          ) : null}
        </div>
      </section>

      {products.length > 0 && regionGate === "need_pick" && !selected ? (
        <section className="kse-glass-dark overflow-hidden border border-amber-200/50 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70">
          <div className="bg-amber-500/5 px-4 py-3 border-b border-amber-100 dark:border-white/5">
            <h2 className="text-sm font-black text-amber-950 dark:text-amber-200">تحديد المنطقة</h2>
          </div>
          <div className="p-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">بحث عن المنطقة *</span>
              <input
                ref={regionSearchRef}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={`${inputClass} dark:bg-slate-950/50 dark:border-white/10 dark:text-white`}
                placeholder="ابحث واختر…"
                autoComplete="off"
              />
            </label>
            {hits.length > 0 ? (
              <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-sky-100 bg-white/80 shadow-lg dark:divide-white/5 dark:border-white/10 dark:bg-slate-950/80">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="w-full px-4 py-3.5 text-end text-sm font-bold text-slate-800 transition hover:bg-sky-50 dark:text-slate-200 dark:hover:bg-white/5"
                      onClick={() => {
                        setSelected(h);
                        setQ(h.name);
                        setHits([]);
                        setRegionGate("ready");
                      }}
                    >
                      {h.name}{" "}
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        ({formatDinarAsAlfWithUnit(h.deliveryPrice)})
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      {showMainFlow ? (
        <>
          <section className="kse-glass-dark overflow-hidden border border-orange-200/50 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70">
             <div className="bg-orange-500/5 px-4 py-3 border-b border-orange-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                  <h2 className="text-sm font-black text-orange-950 dark:text-orange-200">بيانات الطلبية</h2>
                </div>
                <span className="rounded-lg bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-700 dark:bg-orange-500/20 dark:text-orange-400">
                   {products.length} منتجات
                </span>
             </div>
             <div className="p-4 space-y-4">
                <div className="rounded-2xl border border-orange-100 bg-orange-50/30 p-3 dark:border-white/5 dark:bg-white/5">
                   <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-500">رقم الزبون:</span>
                      <span className="font-mono text-slate-900 dark:text-white" dir="ltr">محمي</span>
                   </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">تعديل عنوان المنطقة (للفاتورة)</span>
                  <input
                    value={titleLine}
                    onChange={(e) => setTitleLine(e.target.value)}
                    className={`${inputClass} dark:bg-slate-950/50 dark:border-white/10 dark:text-white`}
                  />
                </label>
             </div>
          </section>

          <section className="kse-glass-dark overflow-hidden border border-sky-200/50 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70">
            <div className="bg-sky-500/5 px-4 py-3 border-b border-sky-100 dark:border-white/5 flex items-center justify-between">
              <h2 className="text-sm font-black text-sky-950 dark:text-sky-200">2) تسعير المنتجات</h2>
              <div className="flex gap-1.5">
                 <button
                    type="button"
                    onClick={() => {
                      setShowAddProduct((v) => !v);
                      setDeleteMode(false);
                      cancelPricingPanel();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400"
                    title="إضافة منتجات"
                  >
                    <DynamicIcon iconKey="ui_add" config={icons} className="h-4 w-4" fallback={<span>+</span>} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteMode((v) => !v);
                      setShowAddProduct(false);
                      cancelPricingPanel();
                    }}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                      deleteMode
                        ? "bg-rose-600 text-white animate-pulse shadow-lg"
                        : "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-400"
                    }`}
                    title="حذف منتج"
                  >
                    <DynamicIcon iconKey="ui_delete" config={icons} className="h-4 w-4" fallback={<span>×</span>} />
                  </button>
              </div>
            </div>

            <div className="p-4">
              {showAddProduct && (
                <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 p-3 animate-in slide-in-from-top-2 dark:border-white/5 dark:bg-white/5">
                  <label className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">إضافة جماعية</label>
                  <textarea
                    rows={3}
                    value={bulkAddText}
                    onChange={(e) => setBulkAddText(e.target.value)}
                    dir="rtl"
                    placeholder="طماطة 2 كيلو&#10;خبز 2"
                    className={`${inputClass} mt-1.5 font-mono text-xs dark:bg-slate-950/50 dark:border-white/10`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v) addProductsFromTextarea(v);
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5">
                {sortedProductIndices.map((i) => {
                  const line = products[i]!;
                  const priced = isRowPriced(i);
                  const sellShow = priceRows[i]?.sell?.replace(/,/g, ".").trim();
                  return (
                    <button
                      key={`${i}-${line.slice(0, 24)}`}
                      type="button"
                      onClick={() => handleProductButton(i)}
                      className={`group relative flex min-h-[56px] w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border-2 px-4 py-3 text-start transition-all active:scale-[0.98] ${
                        selectedPriceIndex === i
                          ? "border-sky-500 bg-sky-50 shadow-md ring-4 ring-sky-500/10 dark:bg-sky-500/10"
                          : deleteMode
                            ? "border-rose-400 bg-rose-50 dark:bg-rose-500/10"
                            : priced
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-emerald-200/50 dark:shadow-none"
                              : "border-slate-100 bg-white/50 hover:border-sky-200 hover:bg-white dark:border-white/5 dark:bg-slate-950/40 dark:hover:bg-slate-950"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                         {priced ? (
                           <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                             <DynamicIcon iconKey="ui_success" config={icons} className="h-3 w-3 text-white" fallback={null} />
                           </div>
                         ) : (
                           <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 group-hover:bg-sky-400 dark:bg-slate-700" />
                         )}
                         <span className={`truncate text-sm font-bold ${priced ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>
                           {line}
                         </span>
                      </div>

                      {priced && sellShow ? (
                        <div className="flex flex-col items-end shrink-0">
                          <span className="font-mono text-[9px] font-black text-emerald-100/80" dir="ltr">
                             {priceRows[i]?.buy}
                          </span>
                          <span className="font-mono text-sm font-black tabular-nums" dir="ltr">
                             {sellShow}
                          </span>
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5">
                           <span className="text-lg text-slate-400 group-hover:text-sky-500">💰</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedPriceIndex != null && (
                <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300">
                  <div className="mx-auto max-w-lg">
                    <div className="kse-glass-dark m-4 overflow-hidden border border-sky-200 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/90">
                      <div className="bg-sky-600 px-4 py-3 text-white">
                        <p className="text-xs font-bold opacity-80">تسعير المنتج:</p>
                        <p className="truncate text-sm font-black">{products[selectedPriceIndex]}</p>
                      </div>
                      <div className="p-5">
                        <p className="text-center text-[11px] font-bold text-slate-500 dark:text-slate-400">
                           اكتب سعر الشراء فقط وسيتم حساب سعر البيع تلقائياً.
                        </p>
                        <textarea
                          value={pricingLinesText}
                          onChange={(e) => setPricingLinesText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && hasCompletePriceLines(pricingLinesText)) {
                              e.preventDefault();
                              applyPricingPanel();
                            }
                          }}
                          rows={2}
                          dir="ltr"
                          placeholder="سعر الشراء"
                          className="mt-3 w-full rounded-2xl border-2 border-sky-100 bg-slate-50 px-4 py-4 text-center font-mono text-2xl font-black tabular-nums text-sky-950 outline-none transition focus:border-sky-500 focus:bg-white dark:border-white/5 dark:bg-black/20 dark:text-white"
                          inputMode="decimal"
                          autoFocus
                        />
                        {pricingErr && (
                          <p className="mt-2 text-center text-xs font-bold text-rose-600">{pricingErr}</p>
                        )}
                        <div className="mt-5 grid grid-cols-2 gap-3">
                           <button
                             type="button"
                             onClick={cancelPricingPanel}
                             className="rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-white/5 dark:bg-white/5 dark:text-slate-300"
                           >
                             إلغاء
                           </button>
                           <button
                             type="button"
                             onClick={applyPricingPanel}
                             className="rounded-2xl bg-sky-600 py-3.5 text-sm font-black text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 active:scale-95 dark:shadow-none"
                           >
                             حفظ السعر
                           </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {showMainFlow && allPriced ? (
        <section className="kse-glass-dark overflow-hidden border border-indigo-200/50 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70">
          <div className="bg-indigo-500/5 px-4 py-3 border-b border-indigo-100 dark:border-white/5">
            <h2 className="text-sm font-black text-indigo-950 dark:text-indigo-200">3) عدد المحلات</h2>
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
      ) : null}

      {showMainFlow && allPriced && placesCount != null ? (
        <section className="kse-glass-dark overflow-hidden border border-emerald-200/50 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70">
           <div className="bg-emerald-500/5 px-4 py-3 border-b border-emerald-100 dark:border-white/5">
              <h2 className="text-sm font-black text-emerald-950 dark:text-emerald-200">4) بيانات الشحن</h2>
           </div>
           <div className="p-4 space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">المحل *</span>
                <select
                  form="prep-form"
                  name="shopId"
                  required
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  className={`${inputClass} dark:bg-slate-950/50 dark:border-white/10 dark:text-white`}
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">رقم الزبون *</span>
                <input
                  form="prep-form"
                  name="customerPhone"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={`${inputClass} font-mono tabular-nums dark:bg-slate-950/50 dark:border-white/10 dark:text-white`}
                  inputMode="numeric"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">وقت الطلب *</span>
                <input
                  form="prep-form"
                  name="orderTime"
                  required
                  value={orderTime}
                  onChange={(e) => setOrderTime(e.target.value)}
                  className={`${inputClass} dark:bg-slate-950/50 dark:border-white/10 dark:text-white`}
                />
              </label>
           </div>
        </section>
      ) : null}

      {/* Sticky Action Bar */}
      {showMainFlow && allPriced && placesCount != null && (
        <div className="fixed inset-x-0 bottom-0 z-40 animate-in slide-in-from-bottom duration-300">
           <div className="kse-glass-dark mx-auto max-w-lg rounded-t-3xl border-t border-sky-200 bg-white/80 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/90">
              <div className="flex gap-3">
                 <button
                    type="button"
                    onClick={() => setShowPreviewModal(true)}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                 >
                    <span className="text-xl">📄</span>
                 </button>
                 <form id="prep-form" action={formAction} className="flex-1">
                    <input type="hidden" name="p" value={auth.p} />
                    <input type="hidden" name="exp" value={auth.exp} />
                    <input type="hidden" name="s" value={auth.s} />
                    <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />
                    <input type="hidden" name="shoppingPayload" value={shoppingPayloadJson} />

                    <button
                      type="submit"
                      disabled={pending || !canSubmit}
                      className="group flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 px-6 text-sm font-black text-white shadow-xl shadow-emerald-200/50 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 dark:shadow-none"
                    >
                      <span>{pending ? "جارٍ الإرسال…" : "رفع الطلب للنظام"}</span>
                      {!pending && (
                        <DynamicIcon iconKey="ui_flash" config={icons} className="h-5 w-5 transition-transform group-hover:translate-x-1" fallback={null} />
                      )}
                    </button>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewInvoice && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-md animate-in fade-in duration-300 sm:items-center">
           <div className="kse-glass-dark w-full max-w-md overflow-hidden border border-emerald-200 shadow-2xl animate-in zoom-in-95 duration-300 dark:border-white/10 dark:bg-slate-900">
              <div className="bg-emerald-600 px-5 py-4 flex items-center justify-between text-white">
                 <h3 className="font-black">معاينة فاتورة الزبون</h3>
                 <button onClick={() => setShowPreviewModal(false)} className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 transition">✕</button>
              </div>
              <div className="p-5">
                 <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs font-bold leading-relaxed text-slate-800 shadow-inner dark:bg-black/20 dark:text-slate-200" dir="rtl">
                    {previewInvoice}
                 </pre>
                 <button
                    onClick={() => setShowPreviewModal(false)}
                    className="mt-6 w-full rounded-2xl bg-slate-900 py-4 text-sm font-black text-white shadow-lg dark:bg-emerald-600"
                 >
                    إغلاق المعاينة
                 </button>
              </div>
           </div>
        </div>
      )}

      {state.error && (
        <div className="fixed bottom-24 left-4 right-4 z-30 animate-in slide-in-from-bottom duration-300">
           <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800 shadow-xl dark:border-rose-500/30 dark:bg-rose-950/90 dark:text-rose-200">
              {state.error}
           </div>
        </div>
      )}

      {blockedPhone && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-rose-100 bg-white p-6 shadow-2xl text-center animate-in zoom-in duration-300 dark:border-white/10 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/10">
              <span className="text-3xl">🚫</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">زبون محظور!</h3>
            <p className="mt-3 text-sm font-bold leading-relaxed text-slate-600 dark:text-slate-400">
              عذراً، هذا الرقم محظور من التوصيل حالياً.
              <br/>
              <span className="font-mono text-rose-600 mt-1 block" dir="ltr">{blockedPhone}</span>
            </p>
            <button
              type="button"
              onClick={() => setBlockedPhone(null)}
              className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-sm font-black text-white shadow-lg active:scale-95 transition dark:bg-rose-600"
            >
              فهمت ذلك
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
