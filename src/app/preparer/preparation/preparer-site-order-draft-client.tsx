"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { createPreparerShoppingDraftFromAnalysis, type PreparerActionState } from "../actions";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { parseFlexibleOrderLines } from "@/lib/flexible-order-parse";
import { extractPhoneNumberFromText, parseSiteOrderMessage } from "@/lib/site-order-parse";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { normalizeRegionNameForMatch } from "@/lib/region-name-normalize";

type RegionHit = { id: string; name: string; deliveryPrice: string };

const initial: PreparerActionState = {};
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
  const [customerLandmark, setCustomerLandmark] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [selected, setSelected] = useState<RegionHit | null>(null);
  const [regionGate, setRegionGate] = useState<"idle" | "need_pick" | "ready">("idle");
  const [showSlowSavingHint, setShowSlowSavingHint] = useState(false);

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
      setRawListText(t);
      setQ(title);
      setSelected(null);
      void resolveRegionAfterParse(t, title, site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
      return;
    }
    setParseError("لم أستطع فهم القائمة. تأكد من وجود عنوان + رقم + منتجات.");
  }

  const canSubmit = Boolean(titleLine.trim() && products.length > 0 && selected && customerPhone.trim() && orderTime.trim());

  if (state.ok && state.draftId) {
    return (
      <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-8 text-center shadow-sm">
        <p className="text-4xl" aria-hidden>✓</p>
        <h2 className="mt-3 text-xl font-bold text-emerald-800">تمت إضافة الطلب</h2>
        <div className="mt-5 flex flex-col gap-2">
          <Link href={preparerPath(`/preparer/preparation/draft/${state.draftId}`, auth)} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white">فتح الطلب للتسعير</Link>
          <Link href={preparerPath("/preparer/preparation", auth)} className="rounded-xl border border-sky-300 px-4 py-3 text-sm font-bold text-sky-900">العودة إلى الخانة</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="kse-glass-dark rounded-2xl border border-violet-200/90 p-4 shadow-sm">
        <p className="text-xs font-semibold text-amber-900">المجهز: {preparerName.trim() || "—"}</p>
        <h2 className="text-base font-black text-violet-950">1) الصق قائمة الطلب</h2>
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
          <h2 className="text-sm font-black text-amber-950">اختر المنطقة</h2>
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
                      setTitleLine(h.name);
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

      {products.length > 0 && regionGate === "ready" && selected ? (
        <>
          <section className="kse-glass-dark rounded-2xl border border-sky-200 p-4 shadow-sm">
            <h2 className="text-sm font-black text-sky-950">2) تأكيد البيانات</h2>
            <label className="mt-3 flex flex-col gap-1"><span className="text-xs font-medium text-slate-800">عنوان المنطقة</span><input value={titleLine} onChange={(ev) => setTitleLine(ev.target.value)} className={inputClass} /></label>
            <label className="mt-3 flex flex-col gap-1"><span className="text-xs font-medium text-slate-800">رقم الزبون *</span><input value={customerPhone} onChange={(ev) => setCustomerPhone(ev.target.value)} className={`${inputClass} font-mono`} /></label>
            <label className="mt-3 flex flex-col gap-1"><span className="text-xs font-medium text-slate-800">وقت الطلب *</span><input value={orderTime} onChange={(ev) => setOrderTime(ev.target.value)} className={inputClass} /></label>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-600">المنتجات ({products.length})</p>
              <div className="mt-2 max-h-40 space-y-1 overflow-auto text-sm text-slate-900">{products.map((p, i) => <p key={`${i}-${p}`}>- {p}</p>)}</div>
            </div>
          </section>

          <form action={formAction} className="space-y-3">
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
            <input type="hidden" name="orderTime" value={orderTime} />
            {state.error ? <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.error}</div> : null}
            <button type="submit" disabled={pending || !canSubmit} className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 px-4 py-3.5 text-sm font-black text-white disabled:opacity-50">{pending ? "جارٍ الحفظ…" : "إضافة إلى خانة التجهيز"}</button>
          </form>
        </>
      ) : null}
    </div>
  );
}
