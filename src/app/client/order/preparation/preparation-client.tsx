"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { clientOrderHistoryPath } from "@/lib/client-order-portal-nav";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { extractPhoneNumberFromText, parseSiteOrderMessage } from "@/lib/site-order-parse";
import { parseFlexibleOrderLines } from "@/lib/flexible-order-parse";
import { normalizeRegionNameForMatch } from "@/lib/region-name-normalize";
import {
  submitEmployeePreparationDraft,
  type EmployeePreparationState,
} from "../actions";

type RegionHit = { id: string; name: string; deliveryPrice: string };
type Props = {
  employeeName: string;
  shopName: string;
  shopRegionName: string;
  shopDeliveryAlf: number;
  e: string;
  exp: string;
  sig: string;
};

const initial: EmployeePreparationState = {};
const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
const PASTE_HELP = `مثال:\nحي العسكري\n07700000000\n2 كيلو طماطة\n1 زيت\n3 خبز`;

export function EmployeePreparationClient({
  employeeName,
  shopName,
  shopRegionName,
  shopDeliveryAlf,
  e,
  exp,
  sig,
}: Props) {
  const [state, formAction, pending] = useActionState(submitEmployeePreparationDraft, initial);
  const regionSearchRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [titleLine, setTitleLine] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [rawListText, setRawListText] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderTime, setOrderTime] = useState("فوري");
  const [customerLandmark, setCustomerLandmark] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [selected, setSelected] = useState<RegionHit | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);

  const historyHref = clientOrderHistoryPath(e, exp, sig, customerPhone);

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

  async function resolveRegionAfterParse(title: string) {
    const qq = title.trim();
    if (qq.length < 2) return;
    try {
      const r = await fetch(`/api/regions/search?q=${encodeURIComponent(qq)}`);
      const j = (await r.json()) as { regions?: RegionHit[] };
      const list = j.regions ?? [];
      if (list.length === 0) return;
      if (list.length === 1) {
        setSelected(list[0]!);
        setQ(list[0]!.name);
        return;
      }
      const exact = list.find((x) => normalizeRegionNameForMatch(x.name) === normalizeRegionNameForMatch(qq));
      if (exact) {
        setSelected(exact);
        setQ(exact.name);
      }
    } catch {}
  }

  function runParse() {
    setParseError(null);
    const t = pasteText.trim();
    if (!t) {
      setParseError("الصق نص الطلب أولاً.");
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
      void resolveRegionAfterParse(flex.title);
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
      setRawListText(t);
      setQ(title);
      setSelected(null);
      void resolveRegionAfterParse(title);
      return;
    }
    setParseError("تعذّر تحليل النص. تأكد من وجود عنوان ورقم زبون ومنتجات.");
  }

  function removeProduct(i: number) {
    setProducts((p) => p.filter((_, idx) => idx !== i));
  }

  if (state.ok) {
    return (
      <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-6 text-center">
        <h2 className="text-xl font-black text-emerald-800">تم إنشاء طلب التجهيز</h2>
        <p className="mt-2 text-sm text-slate-700">
          تم توجيه الطلب إلى المجهّز المناسب:
          <span className="font-black text-slate-900"> {state.preparerName ?? "—"}</span>
        </p>
        <div className="mt-4 grid gap-2">
          <Link
            href={historyHref}
            className="rounded-xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-bold text-sky-900 hover:bg-sky-50"
          >
            سجل الطلبات (للتعديل لاحقاً)
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="kse-glass-dark rounded-2xl border border-violet-200 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-black text-slate-900">إنشاء طلبات (قسم الموظفين)</h1>
          <div className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-bold text-sky-900">{employeeName}</div>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          المحل: <strong>{shopName}</strong> | المنطقة: {shopRegionName} | توصيل المحل:{" "}
          <strong>{shopDeliveryAlf.toFixed(2)} ألف</strong>
        </p>
        <textarea
          value={pasteText}
          onChange={(ev) => setPasteText(ev.target.value)}
          rows={8}
          placeholder={PASTE_HELP}
          className={`${inputClass} mt-3 min-h-[10rem] resize-y font-mono`}
        />
        <button
          type="button"
          onClick={runParse}
          className="mt-3 w-full rounded-xl border-2 border-violet-500 bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-700"
        >
          تحليل
        </button>
        {parseError ? <p className="mt-2 text-sm font-semibold text-rose-700">{parseError}</p> : null}
      </section>

      {products.length > 0 ? (
        <section className="kse-glass-dark rounded-2xl border border-sky-200 p-4 shadow-sm">
          <h2 className="text-sm font-black text-sky-950">تعديل المنتجات قبل التحويل للمجهّز</h2>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddProduct((v) => !v);
                setDeleteMode(false);
              }}
              className="flex-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900"
            >
              إضافة منتج
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteMode((v) => !v);
                setShowAddProduct(false);
              }}
              className="flex-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900"
            >
              مسح منتج
            </button>
          </div>
          {showAddProduct ? (
            <textarea
              rows={3}
              placeholder="سطر لكل منتج"
              className={`${inputClass} mt-2 font-mono`}
              onBlur={(ev) => {
                const lines = ev.target.value
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean);
                if (lines.length) setProducts((prev) => [...prev, ...lines]);
                ev.target.value = "";
              }}
            />
          ) : null}
          <div className="mt-3 space-y-2">
            {products.map((line, i) => (
              <button
                key={`${i}-${line}`}
                type="button"
                onClick={() => deleteMode && removeProduct(i)}
                className={`w-full rounded-xl border px-3 py-2 text-start text-sm font-bold ${
                  deleteMode ? "border-rose-300 bg-rose-50 text-rose-900" : "border-slate-200 bg-white text-slate-900"
                }`}
              >
                {line}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <form action={formAction} className="kse-glass-dark rounded-2xl border border-indigo-200 p-4 shadow-sm">
        <input type="hidden" name="e" value={e} />
        <input type="hidden" name="exp" value={exp} />
        <input type="hidden" name="s" value={sig} />
        <input type="hidden" name="rawListText" value={rawListText} />
        <input type="hidden" name="productsCsv" value={products.join("\n")} />
        <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />

        <h2 className="text-sm font-black text-indigo-950">بيانات التحويل للمجهّز</h2>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">عنوان المنطقة *</span>
          <input name="titleLine" value={titleLine} onChange={(ev) => setTitleLine(ev.target.value)} className={inputClass} required />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">رقم الزبون *</span>
          <input
            name="customerPhone"
            value={customerPhone}
            onChange={(ev) => setCustomerPhone(ev.target.value)}
            className={`${inputClass} font-mono`}
            required
          />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">اسم الزبون (اختياري)</span>
          <input name="customerName" value={customerName} onChange={(ev) => setCustomerName(ev.target.value)} className={inputClass} />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">وقت الطلب *</span>
          <input name="orderTime" value={orderTime} onChange={(ev) => setOrderTime(ev.target.value)} className={inputClass} required />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">أقرب نقطة دالة</span>
          <input
            name="customerLandmark"
            value={customerLandmark}
            onChange={(ev) => setCustomerLandmark(ev.target.value)}
            className={inputClass}
          />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">بحث المنطقة واختيارها *</span>
          <input
            ref={regionSearchRef}
            value={q}
            onChange={(ev) => {
              setQ(ev.target.value);
              setSelected(null);
            }}
            className={inputClass}
            placeholder="ابحث بالمنطقة"
          />
        </label>
        {hits.length > 0 && !selected ? (
          <ul className="mt-2 max-h-40 overflow-auto rounded-xl border border-sky-200 bg-white text-sm shadow-md">
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
                  {h.name} <span className="text-xs text-slate-500">({formatDinarAsAlfWithUnit(h.deliveryPrice)})</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {selected ? (
          <p className="mt-2 text-xs font-bold text-emerald-800">تم اختيار المنطقة: {selected.name}</p>
        ) : null}
        {state.error ? <p className="mt-3 text-sm font-semibold text-rose-700">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending || products.length === 0}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
        >
          {pending ? "جارٍ التوجيه..." : "إنشاء طلبات وتحويلها للمجهّز المناسب"}
        </button>
      </form>
    </div>
  );
}
