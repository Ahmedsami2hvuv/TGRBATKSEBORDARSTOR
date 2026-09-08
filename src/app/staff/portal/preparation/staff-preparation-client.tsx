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
  const [blockedPhone, setBlockedPhone] = useState<string | null>(null);
  const [noProfit, setNoProfit] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  // حالة تحديد المجهزين كـ مصفوفة
  const [selectedPreparerIds, setSelectedPreparerIds] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<"all" | "preparers" | "suppliers">("all");

  const togglePreparer = (id: string) => {
    setSelectedPreparerIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  async function runSmartParse() {
    setParseError(null);
    const t = pasteText.trim();
    if (!t) { setParseError("يرجى لصق النص أولاً."); return; }

    let phone = "";
    const site = parseSiteOrderMessage(t);
    if (site && site.items.length > 0) {
      phone = extractPhoneNumberFromText(t) ?? "";
    } else {
      const flex = parseFlexibleOrderLines(t);
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
      setTitleLine((site.address || site.landmark || "طلب موقع").trim());
      setProducts(site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
      setCustomerPhone(phone);
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
      <p className="mt-2 text-sm font-bold text-slate-600">تم توجيه القائمة إلى: <br/><span className="text-emerald-700">{state.preparerName}</span></p>
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
      {state.error && (
        <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-800 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <DynamicIcon icon={icons?.ui_error} className="h-5 w-5 shrink-0" fallback={<span>⚠️</span>} />
            {state.error}
          </div>
        </div>
      )}

      <section className="kse-glass-dark rounded-2xl border border-violet-200 p-5 shadow-sm">
        <h2 className="text-base font-black text-violet-950 mb-3">1) لصق الرسالة (واتساب أو موقع)</h2>
        <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6} className={`${inputClass} font-mono text-xs`} placeholder="الصق هنا..." />
        <div className="mt-3 flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-white/5 cursor-pointer select-none transition hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => setNoProfit(p => !p)}>
          <div className="flex flex-col text-right">
            <span className="text-xs font-black text-slate-800 dark:text-slate-200">إيقاف الربح 🚫</span>
            <span className="text-[10px] font-bold text-slate-400">جعل سعر البيع مساوياً لسعر الشراء تماماً</span>
          </div>
          <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${noProfit ? 'bg-rose-600' : 'bg-slate-200 dark:bg-slate-800'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${noProfit ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
        </div>
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
          <input type="hidden" name="rawListText" value={pasteText} />
          <input type="hidden" name="customerRegionId" value={selected?.id || ""} />
          <input type="hidden" name="noProfit" value={noProfit ? "true" : "false"} />

          {selectedPreparerIds.map(id => <input key={id} type="hidden" name="preparerIds" value={id} />)}

          <h2 className="text-sm font-black text-sky-950">2) مراجعة وإرسال للمجهز أو المورد</h2>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 block">إسناد للمجهزين أو الموردين (اختياري)</span>
              {selectedPreparerIds.length > 0 && (
                <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  تم تحديد: {selectedPreparerIds.length}
                </span>
              )}
            </div>

            {/* أزرار التصفية السريعة بين المجهزين والموردين */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 text-[11px] font-black">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`flex-1 py-1.5 rounded-lg transition active:scale-95 text-center ${
                  filterType === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                الكل ({preparers.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("preparers")}
                className={`flex-1 py-1.5 rounded-lg transition active:scale-95 text-center ${
                  filterType === "preparers" ? "bg-white text-emerald-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🛵 المجهزون ({preparers.filter((p: any) => !p.isSupplier).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("suppliers")}
                className={`flex-1 py-1.5 rounded-lg transition active:scale-95 text-center ${
                  filterType === "suppliers" ? "bg-white text-amber-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📦 الموردون ({preparers.filter((p: any) => p.isSupplier).length})
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-0.5">
              {preparers
                .filter((p: any) => {
                  if (filterType === "preparers") return !p.isSupplier;
                  if (filterType === "suppliers") return p.isSupplier;
                  return true;
                })
                .map((p: any) => {
                  const isSelected = selectedPreparerIds.includes(p.id);
                  const isSup = p.isSupplier;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!p.available}
                      onClick={() => togglePreparer(p.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-2xl border-2 transition-all active:scale-95 text-right ${
                        isSelected
                          ? isSup
                            ? 'border-amber-500 bg-amber-50 shadow-sm'
                            : 'border-emerald-500 bg-emerald-50 shadow-sm'
                          : 'border-slate-100 bg-white hover:border-sky-200'
                      } ${!p.available ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? isSup ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                          : isSup ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isSelected ? (
                          <span className="text-sm font-black">✓</span>
                        ) : isSup ? (
                          <span className="text-sm">📦</span>
                        ) : (
                          <DynamicIcon
                            icon={icons?.preparer_delegate}
                            className="w-4 h-4"
                            fallback={<span className="text-sm">🛵</span>}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`text-xs font-black block truncate ${
                          isSelected
                            ? isSup ? 'text-amber-950' : 'text-emerald-950'
                            : 'text-slate-800'
                        }`}>
                          {p.name}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                            isSup
                              ? 'bg-amber-100/80 text-amber-800 border border-amber-200'
                              : 'bg-sky-100/80 text-sky-800 border border-sky-200'
                          }`}>
                            {isSup ? 'مورد' : 'مجهز'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
            {selectedPreparerIds.length === 0 && (
              <p className="text-[10px] text-amber-600 font-bold">
                💡 يمكنك عدم الاختيار وسيتم إرسال الطلب كـ "غير مسند" ليقوم المسؤول بتوزيعه لاحقاً.
              </p>
            )}
          </div>

          <input type="hidden" name="titleLine" value={titleLine || selected?.name || "طلب زبون"} />
          <input type="hidden" name="customerPhone" value={customerPhone} />
          <input type="hidden" name="orderTime" value={orderTime || "فوري"} />

          {/* معلومات مستخرجة سريعة كملخص فقط */}
          {customerPhone && (
            <div className="flex items-center justify-between rounded-xl bg-slate-100/80 px-3.5 py-2 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <span>📱</span>
                <span>رقم الزبون المستخرج:</span>
              </span>
              <span className="font-mono font-black text-slate-800" dir="ltr">{customerPhone}</span>
            </div>
          )}

          {/* حقل اختيار وتأكيد منطقة الزبون */}
          <div className="space-y-1 relative">
             <label className="text-xs font-black text-slate-800 mr-1 block">
               منطقة الزبون للتوصيل *
             </label>
             <input
               value={q}
               onChange={e => {
                 setQ(e.target.value);
                 setSelected(null);
               }}
               placeholder="اكتب اسم المنطقة للبحث والاختيار..."
               className={`${inputClass} !py-3 font-bold`}
               required
             />
             {hits.length > 0 && !selected && (
               <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl mt-1 max-h-48 overflow-y-auto divide-y divide-slate-100 animate-in fade-in">
                 {hits.map(h => (
                   <button
                     key={h.id}
                     type="button"
                     onClick={() => {
                       setSelected(h);
                       setQ(h.name);
                     }}
                     className="w-full text-right p-3 text-xs font-bold hover:bg-sky-50 flex items-center justify-between transition"
                   >
                     <span className="font-black text-slate-800">{h.name}</span>
                     <span className="text-[11px] font-black text-sky-700 bg-sky-50 px-2 py-1 rounded-lg border border-sky-100">
                       {formatDinarAsAlfWithUnit(h.deliveryPrice)}
                     </span>
                   </button>
                 ))}
               </div>
             )}
             {selected && (
               <div className="mt-1.5 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-900">
                 <span>✅ المنطقة المعتمدة: {selected.name}</span>
                 <span className="text-[11px] text-emerald-700">توصيل: {formatDinarAsAlfWithUnit(selected.deliveryPrice)}</span>
               </div>
             )}
             {!selected && q.length > 2 && hits.length === 0 && (
                <p className="mt-1 text-[11px] font-bold text-rose-600">لم يتم العثور على منطقة بهذا الاسم. يرجى اختيار منطقة من القائمة.</p>
             )}
          </div>

          <button type="submit" disabled={pending || !selected} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 py-4 text-white font-black shadow-xl disabled:opacity-50 mt-4 flex items-center justify-center gap-2">
             {pending ? "جاري الإرسال..." : (
               <>
                 <DynamicIcon icon={icons?.ui_success} className="w-5 h-5 brightness-0 invert" fallback={<span>✅</span>} />
                 {selectedPreparerIds.length === 0 ? "إرسال كطلب غير مسند 📝" : "تحويل الطلب للمجهزين / الموردين الآن 🚀"}
               </>
             )}
          </button>
        </form>
      )}

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