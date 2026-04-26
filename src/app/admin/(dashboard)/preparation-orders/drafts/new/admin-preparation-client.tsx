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
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

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

  function runParse() {
    setParseError(null);
    const t = pasteText.trim();
    if (!t) {
      setParseError("الصق نص الطلب أولاً.");
      return;
    }
    const site = parseSiteOrderMessage(t);
    if (site && site.items.length > 0) {
      const title = (site.address || site.landmark || "طلب موقع").trim();
      const phone = extractPhoneNumberFromText(t) ?? "";
      setTitleLine(title);
      setProducts(site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
      setCustomerPhone(phone);
      setRawListText(t);
      setQ(title);
      setSelected(null);
      void resolveRegionAfterParse(t, title, site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
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
      <div className="rounded-2xl border border-emerald-300 bg-white p-6 text-center shadow-lg">
        <h2 className="text-xl font-black text-emerald-800">تم إنشاء وإرسال المسودات بنجاح</h2>
        <p className="mt-2 text-sm text-slate-700">
          تم إرسال المسودة إلى المجهّزين:
          <span className="font-black text-slate-900 block mt-1"> 
             {state.preparerNames?.join("، ") ?? "—"}
          </span>
        </p>
        <Link
          href="/admin/orders/pending"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition"
        >
          العودة للطلبات الجديدة
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-black text-slate-900">إنشاء مسودة تجهيز طلبات متعددة</h1>
        <p className="mt-1 text-sm text-slate-500">
          الصق طلب المتجر ليتم تحليله، ثم اختر المجهزين الذين سيتم إرسال المسودة لهم.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-black text-slate-800">1) الصق الطلب هنا</h2>
        <textarea
          value={pasteText}
          onChange={(ev) => setPasteText(ev.target.value)}
          rows={7}
          placeholder={PASTE_HELP}
          dir="rtl"
          className={`${inputClass} font-mono leading-relaxed`}
        />
        <button
          type="button"
          onClick={runParse}
          className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-violet-700 transition"
        >
          تحليل النص (استخراج البيانات)
        </button>
        {parseError ? <p className="mt-2 text-sm font-semibold text-rose-600">{parseError}</p> : null}
      </section>

      <form action={formAction} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <input type="hidden" name="rawListText" value={rawListText} />
        <input type="hidden" name="productsCsv" value={products.join("\n")} />
        <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />
        {selectedPreparerIds.map(id => (
            <input key={id} type="hidden" name="preparerIds" value={id} />
        ))}

        <h2 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2">2) مراجعة البيانات وإرسال المسودة</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">عنوان الطلب *</span>
            <input
                name="titleLine"
                value={titleLine}
                onChange={(ev) => setTitleLine(ev.target.value)}
                className={inputClass}
                required
            />
            </label>

            <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">رقم الزبون *</span>
            <input
                name="customerPhone"
                value={customerPhone}
                onChange={(ev) => setCustomerPhone(ev.target.value)}
                className={`${inputClass} font-mono`}
                required
            />
            </label>

            <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">اسم الزبون (اختياري)</span>
            <input
                name="customerName"
                className={inputClass}
            />
            </label>

            <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">وقت الطلب *</span>
            <input
                name="orderTime"
                value={orderTime}
                onChange={(ev) => setOrderTime(ev.target.value)}
                className={inputClass}
                required
            />
            </label>
        </div>

        <div className="mt-2">
            <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">منطقة أقرب نقطة دالة (اختياري)</span>
            <input
                name="customerLandmark"
                className={inputClass}
            />
            </label>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
            <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">بحث المنطقة والتأكيد *</span>
            <input
                ref={regionSearchRef}
                value={q}
                onChange={(ev) => {
                setQ(ev.target.value);
                setSelected(null);
                }}
                className={inputClass}
                placeholder="ابحث بالمنطقة..."
            />
            </label>
            {hits.length > 0 && !selected ? (
            <ul className="mt-1 max-h-40 overflow-auto rounded-xl border border-slate-200 bg-white text-sm shadow-md">
                {hits.map((h) => (
                <li key={h.id}>
                    <button
                    type="button"
                    className="w-full px-3 py-2 text-start text-slate-800 hover:bg-slate-50"
                    onClick={() => {
                        setSelected(h);
                        setQ(h.name);
                        setHits([]);
                    }}
                    >
                    {h.name} <span className="text-xs text-slate-500 mr-2">({formatDinarAsAlfWithUnit(h.deliveryPrice)})</span>
                    </button>
                </li>
                ))}
            </ul>
            ) : null}
            {selected ? (
            <p className="mt-2 text-xs font-bold text-emerald-600 bg-emerald-50 w-fit px-3 py-1 rounded-md">✓ منطقة معتمدة: {selected.name}</p>
            ) : null}
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4">
            <span className="text-sm font-semibold text-slate-800 mb-2 block">اختر المجهزين (متعدد متوفر) *</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {preparers.map((p) => {
                    const isSelected = selectedPreparerIds.includes(p.id);
                    return (
                        <label 
                            key={p.id} 
                            className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition select-none
                            ${isSelected ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}
                            ${!p.available ? 'opacity-50' : ''}`}
                        >
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={isSelected}
                                onChange={() => togglePreparer(p.id)}
                            />
                            <span className="text-sm font-medium text-slate-800">
                                {p.name} {!p.available && "(غير متاح)"}
                            </span>
                        </label>
                    );
                })}
            </div>
            {selectedPreparerIds.length === 0 && (
                <p className="text-xs text-rose-500 mt-2">يرجى اختيار مجهز واحد على الأقل.</p>
            )}
        </div>

        {state.error ? <p className="mt-4 text-sm font-semibold text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending || products.length === 0 || selectedPreparerIds.length === 0}
          className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-black text-white shadow-md hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "جارٍ الإرسال..." : "إرسال المسودة للمجهزين المحددين"}
        </button>
        {products.length === 0 ? (
          <p className="mt-2 text-center text-xs font-semibold text-slate-400">حلّل القائمة أولاً لتفعيل الإرسال.</p>
        ) : null}
      </form>
    </div>
  );
}
