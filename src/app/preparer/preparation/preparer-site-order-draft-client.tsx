"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { createPreparerShoppingDraftFromAnalysis, type PreparerActionState } from "../actions";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { parseFlexibleOrderLines } from "@/lib/flexible-order-parse";
import { extractPhoneNumberFromText, parseSiteOrderMessage } from "@/lib/site-order-parse";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { normalizeRegionNameForMatch } from "@/lib/region-name-normalize";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";

type RegionHit = { id: string; name: string; deliveryPrice: string };

const initial: PreparerActionState = {};

function sanitizePhone(value: string): string {
  const arabicDigits = /[٠١٢٣٤٥٦٧٨٩]/g;
  const persianDigits = /[۰۱۲۳۴۵۶٧٨٩]/g;
  let clean = value
    .replace(arabicDigits, (d) => String(d.charCodeAt(0) - 1632))
    .replace(persianDigits, (d) => String(d.charCodeAt(0) - 1776));
  return clean.replace(/\D/g, "");
}

function handlePhoneBlur(value: string, setter: (v: string) => void) {
  let clean = sanitizePhone(value);
  while (clean.startsWith("00")) {
    clean = clean.slice(2);
  }
  if (clean.startsWith("964")) {
    clean = clean.slice(3);
  }
  while (clean.startsWith("0")) {
    clean = clean.slice(1);
  }
  if (clean.length === 10 && clean.startsWith("7")) {
    setter(`0${clean}`);
  } else if (clean.length === 11 && clean.startsWith("07")) {
    setter(clean);
  } else {
    setter(clean);
  }
}

const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

const PASTE_HELP = `مثال:
شيخ ابراهيم
07718285825
٢ كيلو بطاطا
٢ كيلو طماطة
خبز`;

export function PreparerSiteOrderDraftClient({
  auth,
  preparerName,
  homeHref,
}: {
  auth: { p: string; exp: string; s: string };
  preparerName: string;
  homeHref: string;
}) {
  const [state, formAction, pending] = useActionState(createPreparerShoppingDraftFromAnalysis, initial);
  const regionSearchRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [titleLine, setTitleLine] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [rawListText, setRawListText] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderTime, setOrderTime] = useState("فوري");
  const [orderType, setOrderType] = useState("تجهيز تسوق");
  const [orderSubtotal, setOrderSubtotal] = useState("");
  const [customerLandmark, setCustomerLandmark] = useState("");
  const [deliveryPrice, setDeliveryPrice] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [selected, setSelected] = useState<RegionHit | null>(null);
  const [regionGate, setRegionGate] = useState<"idle" | "need_pick" | "ready">("idle");
  const [showSlowSavingHint, setShowSlowSavingHint] = useState(false);
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const [noProfit, setNoProfit] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      setIsFormOpen(true);
      setTimeout(() => {
        const el = document.getElementById("add-new-order-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
    };
    window.addEventListener("open-add-order-form", handleOpen);
    return () => window.removeEventListener("open-add-order-form", handleOpen);
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
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const err = state.error?.trim();
    if (!err) return;
    if (err.includes("منطقة")) regionSearchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.error]);

  useEffect(() => {
    if (!pending) {
      setShowSlowSavingHint(false);
      return;
    }
    const t = setTimeout(() => setShowSlowSavingHint(true), 4000);
    return () => clearTimeout(t);
  }, [pending]);

  function extractRegionCandidates(rawText: string, knownProducts?: string[]) {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const productSet = new Set((knownProducts ?? []).map((x) => x.trim()).filter(Boolean));

    return lines.filter((line) => {
      if (line.length < 2) return false;
      if (/\d/.test(line)) return false;
      if (productSet.has(line)) return false;
      if (line.includes("كيلو") || line.includes("قطعة") || line.includes("حبة")) return false;
      return true;
    });
  }

  async function resolveRegionAfterParse(rawText: string, fallbackTitle: string, knownProducts?: string[]) {
    const candidates = extractRegionCandidates(rawText, knownProducts);
    const fallback = fallbackTitle.trim();
    if (fallback && fallback.length >= 2 && !candidates.includes(fallback)) candidates.unshift(fallback);
    const limited = candidates.slice(0, 6);

    for (const cand of limited) {
      const qq = cand.trim();
      if (qq.length < 2) continue;
      try {
        const r = await fetch(`/api/regions/search?q=${encodeURIComponent(qq)}`);
        const j = (await r.json()) as { regions?: RegionHit[] };
        const list = j.regions ?? [];
        if (list.length === 1) {
          setSelected(list[0]!);
          setQ(list[0]!.name);
          setTitleLine(list[0]!.name);
          setRegionGate("ready");
          return;
        }
        const normTitle = normalizeRegionNameForMatch(qq);
        const exact = list.find((x) => normalizeRegionNameForMatch(x.name) === normTitle);
        if (exact) {
          setSelected(exact);
          setQ(exact.name);
          setTitleLine(exact.name);
          setRegionGate("ready");
          return;
        }
      } catch {
      }
    }

    setQ("");
    setSelected(null);
    setTitleLine("");
    setRegionGate("need_pick");
  }

  function runParse() {
    setParseError(null);
    setRegionGate("idle");
    const t = pasteText.trim();
    if (!t) {
      setParseError("الصق نص القائمة أولاً.");
      return;
    }
    const flex = parseFlexibleOrderLines(t);
    if (flex) {
      setTitleLine(flex.title);
      setProducts([...flex.products]);
      setCustomerPhone(flex.phone);
      setRawListText(t);
      setQ(flex.title);
      setSelected(null);
      setIsFormOpen(false);
      void resolveRegionAfterParse(t, flex.title, flex.products);
      return;
    }
    const site = parseSiteOrderMessage(t);
    if (site && site.items.length > 0) {
      const title = (site.address || site.landmark || "طلب موقع").trim();
      const phone = extractPhoneNumberFromText(t) ?? "";
      setTitleLine(title);
      setProducts(site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
      setCustomerPhone(phone);
      setCustomerName(site.customerName.trim());
      setCustomerLandmark(site.landmark.trim());
      setOrderSubtotal(site.totalPrice ? site.totalPrice.toString() : "");
      setRawListText(t);
      setQ(title);
      setSelected(null);
      setIsFormOpen(false);
      void resolveRegionAfterParse(t, title, site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
      return;
    }
    setParseError("لم أستطع فهم القائمة. تأكد من وجود عنوان + رقم + منتجات.");
  }

  const canSubmit = Boolean(titleLine.trim() && products.length > 0 && selected && customerPhone.trim() && orderTime.trim());

  if (state.ok && state.draftId) {
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
          <h2 className="mt-4 text-xl font-black text-emerald-800 dark:text-emerald-400">تمت إضافة الطلب بنجاح</h2>
          <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-400">يمكنك الآن البدء بتسعير المنتجات في قائمة التجهيز.</p>
          <div className="mt-8 flex flex-col gap-3">
            <Link href={preparerPath(`/preparer/preparation/draft/${state.draftId}`, auth)} className="flex h-12 items-center justify-center rounded-2xl bg-violet-600 text-sm font-black text-white shadow-lg transition hover:bg-violet-700">
               فتح الطلب للتسعير
            </Link>
            <Link href={preparerPath("/preparer/preparation", auth)} className="flex h-12 items-center justify-center rounded-2xl border-2 border-sky-200 text-sm font-bold text-sky-900 dark:border-white/10 dark:text-sky-400">
               العودة لقائمة التجهيز
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-24">
      <section id="add-new-order-section" className="kse-glass-dark overflow-hidden border border-violet-200/50 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70">
        <div
          onClick={() => setIsFormOpen((prev) => !prev)}
          className={`bg-violet-600/5 px-4 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-violet-600/10 transition ${
            isFormOpen ? "border-b border-violet-100 dark:border-white/5" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-violet-950 dark:text-violet-200">1) إضافة طلب جديد</h2>
            <span className="text-[11px] font-bold text-violet-600/70 dark:text-violet-400/70">({preparerName.trim() || "—"})</span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
          >
            <span>{isFormOpen ? "إغلاق ✕" : "فتح إضافة طلب ➕"}</span>
          </button>
        </div>
        {isFormOpen && (
          <div className="p-4 animate-in slide-in-from-top-2 duration-200">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              dir="rtl"
              placeholder={PASTE_HELP}
              className={`${inputClass} min-h-[8rem] resize-y font-mono text-sm leading-relaxed dark:bg-slate-950/50 dark:border-white/10 dark:text-white`}
            />
            <div className="mt-3 flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-white/5 cursor-pointer select-none transition hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => setNoProfit(p => !p)}>
              <div className="flex flex-col text-right">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">إيقاف الربح 🚫</span>
                <span className="text-[10px] font-bold text-slate-400">جعل سعر البيع مساوياً لسعر الشراء تماماً</span>
              </div>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${noProfit ? 'bg-rose-600' : 'bg-slate-200 dark:bg-slate-800'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${noProfit ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </div>
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
        )}
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
                        setTitleLine(h.name);
                        setDeliveryPrice(h.deliveryPrice || "");
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

      {products.length > 0 && regionGate === "ready" && selected ? (
        <>
          <section className="kse-glass-dark overflow-hidden border border-sky-200/50 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/70">
            <div className="bg-sky-500/5 px-4 py-3 border-b border-sky-100 dark:border-white/5 flex items-center justify-between">
               <h2 className="text-sm font-black text-sky-950 dark:text-sky-200">2) تأكيد البيانات</h2>
               <span className="rounded-lg bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-700 dark:bg-sky-500/20 dark:text-sky-400">
                  {products.length} منتجات
               </span>
            </div>
            <div className="p-4 space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">عنوان المنطقة</span>
                <input value={titleLine} onChange={(ev) => setTitleLine(ev.target.value)} className={`${inputClass} dark:bg-slate-950/50 dark:border-white/10 dark:text-white`} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                 <label className="flex flex-col gap-1.5">
                   <span className="text-xs font-bold text-slate-600 dark:text-slate-400">رقم الزبون *</span>
                   <input value={customerPhone} onChange={(ev) => setCustomerPhone(sanitizePhone(ev.target.value))} onBlur={(ev) => handlePhoneBlur(ev.target.value, setCustomerPhone)} className={`${inputClass} font-mono dark:bg-slate-950/50 dark:border-white/10`} />
                 </label>
                 <label className="flex flex-col gap-1.5">
                   <span className="text-xs font-bold text-slate-600 dark:text-slate-400">وقت الطلب *</span>
                   <input value={orderTime} onChange={(ev) => setOrderTime(ev.target.value)} className={`${inputClass} dark:bg-slate-950/50 dark:border-white/10`} />
                 </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">نوع الطلب</span>
                  <input value={orderType} onChange={(ev) => setOrderType(ev.target.value)} className={`${inputClass} dark:bg-slate-950/50 dark:border-white/10`} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">سعر المواد (اختياري)</span>
                  <input value={orderSubtotal} onChange={(ev) => setOrderSubtotal(ev.target.value)} className={`${inputClass} font-mono dark:bg-slate-950/50 dark:border-white/10`} placeholder="سعر المواد..." inputMode="decimal" />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">سعر التوصيل (اختياري)</span>
                <input value={deliveryPrice} onChange={(ev) => setDeliveryPrice(ev.target.value)} className={`${inputClass} font-mono dark:bg-slate-950/50 dark:border-white/10`} placeholder="تعديل سعر التوصيل..." inputMode="decimal" />
              </label>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3 dark:border-white/5 dark:bg-white/5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">قائمة المنتجات:</p>
                <div className="mt-2 max-h-32 space-y-1.5 overflow-auto pr-1">
                   {products.map((p, i) => (
                     <div key={`${i}-${p}`} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                        <div className="h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                        <span>{p}</span>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          </section>

          {/* Sticky Action Bar */}
          <div className="fixed inset-x-0 bottom-0 z-40 animate-in slide-in-from-bottom duration-300">
             <div className="kse-glass-dark mx-auto max-w-lg rounded-t-3xl border-t border-sky-200 bg-white/80 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/90">
                <form action={formAction} className="flex gap-3">
                  <input type="hidden" name="p" value={auth.p} />
                  <input type="hidden" name="exp" value={auth.exp} />
                  <input type="hidden" name="s" value={auth.s} />
                  <input type="hidden" name="titleLine" value={titleLine.trim()} />
                  <input type="hidden" name="rawListText" value={rawListText.trim()} />
                  <input type="hidden" name="productsCsv" value={products.join("\n")} />
                  <input type="hidden" name="customerRegionId" value={selected.id} />
                  <input type="hidden" name="customerPhone" value={customerPhone} />
                  <input type="hidden" name="customerName" value={customerName} />
                  <input type="hidden" name="customerLandmark" value={customerLandmark} />
                  <input type="hidden" name="deliveryPrice" value={deliveryPrice} />
                  <input type="hidden" name="orderTime" value={orderTime} />
                  <input type="hidden" name="orderType" value={orderType} />
                  <input type="hidden" name="orderSubtotal" value={orderSubtotal} />
                  <input type="hidden" name="noProfit" value={noProfit ? "true" : "false"} />

                  <button
                    type="submit"
                    disabled={pending || !canSubmit}
                    className="flex h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 px-6 text-sm font-black text-white shadow-xl shadow-emerald-200/50 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 dark:shadow-none"
                  >
                    <span>{pending ? "جارٍ الحفظ…" : "إضافة لخانة التجهيز"}</span>
                    {!pending && <DynamicIcon iconKey="ui_flash" config={icons} className="h-5 w-5" fallback={null} />}
                  </button>
                </form>
             </div>
          </div>
        </>
      ) : null}

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
