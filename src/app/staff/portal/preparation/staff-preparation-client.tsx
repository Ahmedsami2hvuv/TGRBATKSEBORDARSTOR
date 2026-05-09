"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { extractPhoneNumberFromText, parseSiteOrderMessage } from "@/lib/site-order-parse";
import { parseFlexibleOrderLines } from "@/lib/flexible-order-parse";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { submitStaffPreparationDraft, type StaffPrepState } from "../actions";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

const inputClass = "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100";

export function StaffPreparationClient({ staffName, auth, preparers, icons }: any) {
  const [state, formAction, pending] = useActionState(submitStaffPreparationDraft, {} as StaffPrepState);
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [titleLine, setTitleLine] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderTime, setOrderTime] = useState("فوري");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  // حالة تحديد المجهزين كـ مصفوفة
  const [selectedPreparerIds, setSelectedPreparerIds] = useState<string[]>([]);

  const togglePreparer = (id: string) => {
    setSelectedPreparerIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  function runSmartParse() {
    setParseError(null);
    const t = pasteText.trim();
    if (!t) { setParseError("يرجى لصق النص أولاً."); return; }

    const site = parseSiteOrderMessage(t);
    if (site && site.items.length > 0) {
      setTitleLine((site.address || site.landmark || "طلب موقع").trim());
      setProducts(site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
      setCustomerPhone(extractPhoneNumberFromText(t) ?? "");
      setQ(site.address || "");
      return;
    }

    const flex = parseFlexibleOrderLines(t);
    if (flex) {
      setTitleLine(flex.title);
      setProducts([...flex.products]);
      setCustomerPhone(flex.phone);
      setQ(flex.title);
      return;
    }
    setParseError("تعذّر تحليل النص تلقائياً. تأكد من وجود العنوان ورقم الهاتف.");
  }

  useEffect(() => {
    if (q.length < 2 || selected) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/regions/search?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      setHits(j.regions || []);
    }, 300);
    return () => clearTimeout(t);
  }, [q, selected]);

  if (state.ok) return (
    <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-6 text-center shadow-lg animate-in zoom-in">
      <h2 className="text-xl font-black text-emerald-800 flex items-center justify-center gap-2">
        <DynamicIcon icon={icons?.ui_success} className="w-6 h-6" fallback={<span>✅</span>} />
        تم الإرسال بنجاح
      </h2>
      <p className="mt-2 text-sm font-bold text-slate-600">تم توجيه القائمة للمجهزين: <br/><span className="text-emerald-700">{state.preparerName}</span></p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href={`/staff/portal?se=${auth.se}&exp=${auth.exp}&s=${auth.s}`} className="inline-flex justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-white font-bold hover:bg-slate-800">
          العودة للرئيسية
        </Link>
        <Link href={`/staff/portal/preparation?se=${auth.se}&exp=${auth.exp}&s=${auth.s}&fresh=${Date.now()}`} className="inline-flex justify-center rounded-xl border border-slate-900 px-6 py-2.5 text-slate-900 font-bold hover:bg-slate-100">
          طلب جديد
        </Link>
        {state.draftId ? (
          <Link href={`/staff/portal/submitted/${state.draftId}?se=${auth.se}&exp=${auth.exp}&s=${auth.s}`} className="inline-flex justify-center rounded-xl border border-emerald-600 px-6 py-2.5 text-emerald-900 font-bold hover:bg-emerald-50">
            تفاصيل الطلب المرفوع
          </Link>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      <section className="kse-glass-dark rounded-2xl border border-violet-200 p-5 shadow-sm">
        <h2 className="text-base font-black text-violet-950 mb-3">1) لصق الرسالة (واتساب أو موقع)</h2>
        <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6} className={`${inputClass} font-mono text-xs`} placeholder="الصق هنا..." />
        <button type="button" onClick={runSmartParse} className="mt-3 w-full rounded-xl bg-violet-600 py-3 text-sm font-black text-white shadow-md hover:bg-violet-700 flex items-center justify-center gap-2">
          <DynamicIcon icon={icons?.ui_flash} className="w-4 h-4" fallback={<span>⚡</span>} />
          تحليل البيانات استخراج
        </button>
        {parseError && (
          <p className="mt-2 text-xs font-bold text-rose-600 flex items-center gap-1">
            <DynamicIcon icon={icons?.ui_error} className="w-3 h-3" fallback={<span>⚠️</span>} />
            {parseError}
          </p>
        )}
      </section>

      {products.length > 0 && (
        <form action={formAction} className="kse-glass-dark rounded-2xl border border-sky-200 p-5 shadow-sm space-y-4">
          <input type="hidden" name="se" value={auth.se} /><input type="hidden" name="exp" value={auth.exp} /><input type="hidden" name="s" value={auth.s} />
          <input type="hidden" name="productsCsv" value={products.join("\n")} />
          <input type="hidden" name="customerRegionId" value={selected?.id || ""} />

          {selectedPreparerIds.map(id => <input key={id} type="hidden" name="preparerIds" value={id} />)}

          <h2 className="text-sm font-black text-sky-950">2) مراجعة وإرسال للمجهز</h2>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <span className="text-xs font-black text-slate-800 mb-2 block">إسناد للمجهزين (تحديد متعدد متاح) *</span>
            <div className="grid grid-cols-2 gap-2">
              {preparers.map((p: any) => {
                const isSelected = selectedPreparerIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!p.available}
                    onClick={() => togglePreparer(p.id)}
                    className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-all active:scale-95 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                        : 'border-slate-100 bg-white hover:border-sky-200'
                    } ${!p.available ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-500' : 'bg-slate-100'}`}>
                      {isSelected ? (
                        <DynamicIcon
                          icon={icons?.preparer_delegate}
                          className="w-6 h-6 brightness-0 invert"
                          fallback={<span className="text-xl">👤</span>}
                        />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-slate-300" />
                      )}
                    </div>
                    <span className={`text-xs font-black text-right leading-tight ${isSelected ? 'text-emerald-900' : 'text-slate-600'}`}>
                      {p.name}
                      {!p.available && <span className="block text-[9px] font-bold opacity-70">(غير متاح)</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedPreparerIds.length === 0 && <p className="text-[10px] text-rose-600 font-bold">يرجى اختيار مجهز واحد على الأقل.</p>}
          </div>

          <input name="titleLine" value={titleLine} onChange={e => setTitleLine(e.target.value)} placeholder="عنوان الطلب" className={inputClass} required />
          <input name="customerPhone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="رقم الزبون" className={inputClass} required />
          <div className="relative">
             <input value={q} onChange={e => {setQ(e.target.value); setSelected(null);}} placeholder="ابحث عن المنطقة للتأكيد..." className={inputClass} required />
             {hits.length > 0 && !selected && (
               <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-40 overflow-y-auto">
                 {hits.map(h => <button key={h.id} type="button" onClick={() => {setSelected(h); setQ(h.name);}} className="w-full text-right p-3 text-xs font-bold border-b hover:bg-sky-50">{h.name} ({formatDinarAsAlfWithUnit(h.deliveryPrice)})</button>)}
               </div>
             )}
          </div>
          <input name="orderTime" value={orderTime} onChange={e => setOrderTime(e.target.value)} placeholder="وقت الطلب" className={inputClass} required />

          <button type="submit" disabled={pending || !selected} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 py-4 text-white font-black shadow-xl disabled:opacity-50 mt-4 flex items-center justify-center gap-2">
             {pending ? "جاري الإرسال..." : (
               <>
                 <DynamicIcon icon={icons?.ui_success} className="w-5 h-5 brightness-0 invert" fallback={<span>✅</span>} />
                 {selectedPreparerIds.length === 0 ? "إرسال كطلب غير مسند 📝" : "تحويل الطلب للمجهز الآن"}
               </>
             )}
          </button>
        </form>
      )}
    </div>
  );
}