"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { extractPhoneNumberFromText, parseSiteOrderMessage } from "@/lib/site-order-parse";
import { parseFlexibleOrderLines } from "@/lib/flexible-order-parse";
import { normalizeRegionNameForMatch } from "@/lib/region-name-normalize";
import { submitAdminPreparationDraft, type AdminPrepState } from "./actions";

type RegionHit = { id: string; name: string; deliveryPrice: string };

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white";

const initial: AdminPrepState = {};

const PASTE_HELP = `مثال رسالة الموقع:
اسم الزبون: علي
العنوان: شيخ ابراهيم
اقرب نقطة دالة: مقابل المسجد
الاسم: ٢ كيلو بطاطا
الكمية: 1
السعر: 2000
السعر الكلي: 2000`;

export function AdminPreparationClient({
  preparers,
}: {
  preparers: Array<{ id: string; name: string; available: boolean }>;
}) {
  const [state, formAction, pending] = useActionState(submitAdminPreparationDraft, initial);
  const regionSearchRef = useRef<HTMLInputElement>(null);

  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [titleLine, setTitleLine] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [rawListText, setRawListText] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderTime, setOrderTime] = useState("فوري");

  const [blockedPhone, setBlockedPhone] = useState<string | null>(null);

  const [selectedPreparerIds, setSelectedPreparerIds] = useState<string[]>([]);

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [selected, setSelected] = useState<RegionHit | null>(null);

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
    const err = state.error?.trim();
    if (!err) return;
    if (err.includes("منطقة")) regionSearchRef.current?.focus();
  }, [state.error]);

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
          return;
        }
        const normTitle = normalizeRegionNameForMatch(qq);
        const exact = list.find((x) => normalizeRegionNameForMatch(x.name) === normTitle);
        if (exact) {
          setSelected(exact);
          setQ(exact.name);
          setTitleLine(exact.name);
          return;
        }
      } catch {
      }
    }
  }

  async function runParse() {
    setParseError(null);
    const t = pasteText.trim();
    if (!t) {
      setParseError("الصق نص الطلب أولاً.");
      return;
    }

    let phone = "";
    let site = parseSiteOrderMessage(t);
    let flex = null;

    if (site && site.items.length > 0) {
      phone = extractPhoneNumberFromText(t) ?? "";
    } else {
      flex = parseFlexibleOrderLines(t);
      if (flex) {
        phone = flex.phone;
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

    if (site && site.items.length > 0) {
      const title = (site.address || site.landmark || "طلب موقع").trim();
      setTitleLine(title);
      setProducts(site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
      setCustomerPhone(phone);
      setRawListText(t);
      setQ(title);
      setSelected(null);
      void resolveRegionAfterParse(t, title, site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
      return;
    }

    if (flex) {
      setTitleLine(flex.title);
      setProducts([...flex.products]);
      setCustomerPhone(flex.phone);
      setRawListText(t);
      setQ(flex.title);
      setSelected(null);
      void resolveRegionAfterParse(t, flex.title, flex.products);
      return;
    }
    setParseError("تعذّر تحليل النص. تأكد من وجود عنوان ورقم زبون ومنتجات.");
  }

  function togglePreparer(id: string) {
    setSelectedPreparerIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  if (state.ok) {
    return (
      <div className="rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-slate-900">تم إنشاء المسودة بنجاح</h2>
        <p className="mt-3 text-slate-600">
          تم إرسال المسودة إلى المجهّزين:
          <span className="font-black text-indigo-600 block mt-2 text-lg">
             {state.preparerNames?.join("، ") ?? "—"}
          </span>
        </p>
        <Link
          href="/abo1stor3hlaa2kbr8-47/orders/pending"
          className="mt-8 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-8 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-indigo-600 transition-all hover:scale-[1.02] active:scale-95"
        >
          العودة للطلبات الجديدة
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            </div>
            <div>
                <h1 className="text-xl font-black text-slate-900">إنشاء مسودة تجهيز طلبات</h1>
                <p className="text-xs font-bold text-slate-500">نظام تحليل الطلبات الذكي</p>
            </div>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-slate-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs">1</span>
            الصق الطلب هنا
        </h2>
        <textarea
          value={pasteText}
          onChange={(ev) => setPasteText(ev.target.value)}
          rows={7}
          placeholder={PASTE_HELP}
          dir="rtl"
          className={`${inputClass} font-mono leading-relaxed min-h-[180px]`}
        />
        <button
          type="button"
          onClick={runParse}
          className="mt-4 w-full rounded-2xl bg-indigo-600 px-4 py-4 text-sm font-black text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.01] active:scale-[0.98] transition-all"
        >
          تحليل النص (استخراج البيانات)
        </button>
        {parseError ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600 border border-rose-100">
                <span>⚠️</span>
                {parseError}
            </div>
        ) : null}
      </section>

      <form action={formAction} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <input type="hidden" name="rawListText" value={rawListText} />
        <input type="hidden" name="productsCsv" value={products.join("\n")} />
        <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />
        {selectedPreparerIds.map(id => (
            <input key={id} type="hidden" name="preparerIds" value={id} />
        ))}

        <h2 className="flex items-center gap-2 text-sm font-black text-slate-800 border-b border-slate-100 pb-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs">2</span>
            مراجعة البيانات وإرسال المسودة
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1">عنوان الطلب *</span>
                <input
                    name="titleLine"
                    value={titleLine}
                    onChange={(ev) => setTitleLine(ev.target.value)}
                    className={inputClass}
                    required
                    placeholder="مثلاً: المنصور - شارع 14 رمضان"
                />
            </div>

            <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1">رقم الزبون *</span>
                <input
                    name="customerPhone"
                    value={customerPhone}
                    onChange={(ev) => setCustomerPhone(ev.target.value)}
                    className={`${inputClass} font-mono`}
                    required
                    placeholder="07XXXXXXXXX"
                />
            </div>

            <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1">اسم الزبون (اختياري)</span>
                <input
                    name="customerName"
                    className={inputClass}
                    placeholder="الاسم الثلاثي إن وجد"
                />
            </div>

            <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1">وقت الطلب *</span>
                <input
                    name="orderTime"
                    value={orderTime}
                    onChange={(ev) => setOrderTime(ev.target.value)}
                    className={inputClass}
                    required
                />
            </div>
        </div>

        <div className="space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1">منطقة أقرب نقطة دالة (اختياري)</span>
            <input
                name="customerLandmark"
                className={inputClass}
                placeholder="مثال: قرب صيدلية، مدرسة، محل معروف..."
            />
        </div>

        <div className="rounded-2xl bg-slate-50 p-5 space-y-4 border border-slate-100">
            <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1">بحث المنطقة والتأكيد *</span>
                <div className="relative">
                    <input
                        ref={regionSearchRef}
                        value={q}
                        onChange={(ev) => {
                            setQ(ev.target.value);
                            setSelected(null);
                        }}
                        className={`${inputClass} pr-10`}
                        placeholder="ابحث بالمنطقة لتحديد سعر التوصيل..."
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
            </div>

            {hits.length > 0 && !selected ? (
            <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                {hits.map((h) => (
                <li key={h.id} className="border-b last:border-0 border-slate-50">
                    <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-start text-slate-800 hover:bg-indigo-50 transition-colors"
                    onClick={() => {
                        setSelected(h);
                        setQ(h.name);
                        setHits([]);
                    }}
                    >
                    <span className="font-bold">{h.name}</span>
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                        {formatDinarAsAlfWithUnit(h.deliveryPrice)}
                    </span>
                    </button>
                </li>
                ))}
            </ul>
            ) : null}

            {selected ? (
            <div className="flex items-center gap-2 rounded-xl bg-indigo-600 p-3 text-xs font-bold text-white shadow-md shadow-indigo-100 animate-in zoom-in duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
                <span>تم تأكيد المنطقة: {selected.name} - سعر التوصيل ({formatDinarAsAlfWithUnit(selected.deliveryPrice)})</span>
            </div>
            ) : (
                <p className="text-[10px] font-bold text-slate-400 italic">يجب اختيار منطقة من القائمة لتحديد سعر التوصيل بدقة.</p>
            )}
        </div>

        <div className="space-y-4">
            <span className="text-sm font-black text-slate-800 block">اختر المجهزين (متعدد متوفر) *</span>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {preparers.map((p) => {
                    const isSelected = selectedPreparerIds.includes(p.id);
                    return (
                        <label 
                            key={p.id} 
                            className={`group relative flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all
                            ${isSelected ? 'border-indigo-500 bg-indigo-50/50 ring-4 ring-indigo-500/10' : 'border-slate-100 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50'}
                            ${!p.available ? 'opacity-40 grayscale pointer-events-none' : 'active:scale-95'}`}
                        >
                            <div className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-colors
                                ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white group-hover:border-indigo-400'}`}>
                                {isSelected && (
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                            <input
                                type="checkbox" 
                                className="hidden"
                                checked={isSelected}
                                onChange={() => togglePreparer(p.id)}
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800">
                                    {p.name}
                                </span>
                                {!p.available && <span className="text-[10px] text-rose-500 font-bold">غير متاح حالياً</span>}
                            </div>
                        </label>
                    );
                })}
            </div>
            {selectedPreparerIds.length === 0 && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-rose-500">
                    <span className="animate-pulse">●</span>
                    يرجى اختيار مجهز واحد على الأقل للمتابعة.
                </div>
            )}
        </div>

        {state.error ? (
            <div className="animate-bounce-in flex items-center gap-3 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-600 border border-rose-100">
                <span className="text-xl">🛑</span>
                {state.error}
            </div>
        ) : null}

        <div className="sticky bottom-4 pt-2">
            <button
                type="submit"
                disabled={pending || products.length === 0 || selectedPreparerIds.length === 0}
                className="w-full rounded-2xl bg-slate-900 px-4 py-5 text-base font-black text-white shadow-2xl shadow-slate-200 hover:bg-indigo-600 hover:-translate-y-1 transition-all disabled:opacity-30 disabled:pointer-events-none disabled:translate-y-0"
            >
                {pending ? (
                    <div className="flex items-center justify-center gap-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        <span>جارٍ إرسال الطلب...</span>
                    </div>
                ) : "إرسال المسودة للمجهزين"}
            </button>
            {products.length === 0 && (
                <p className="mt-3 text-center text-[11px] font-black uppercase tracking-widest text-slate-400">حلّل القائمة في الخطوة (1) أولاً.</p>
            )}
        </div>
      </form>

      {blockedPhone && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm rounded-[40px] border-2 border-rose-100 bg-white p-8 shadow-2xl text-center animate-in zoom-in duration-300">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <span className="text-4xl">🚫</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900">زبون محظور!</h3>
            <p className="mt-4 text-sm font-bold leading-relaxed text-slate-600">
                عذراً، هذا الرقم مسجل في القائمة السوداء.
              <br/>
              <span className="mt-2 inline-block rounded-lg bg-rose-50 px-3 py-1 font-mono text-lg text-rose-600" dir="ltr">{blockedPhone}</span>
            </p>
            <button
              type="button"
              onClick={() => setBlockedPhone(null)}
              className="mt-8 w-full rounded-2xl bg-slate-900 py-4 text-sm font-black text-white shadow-xl hover:bg-rose-600 active:scale-95 transition-all"
            >
              فهمت، إغلاق التنبيه
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
