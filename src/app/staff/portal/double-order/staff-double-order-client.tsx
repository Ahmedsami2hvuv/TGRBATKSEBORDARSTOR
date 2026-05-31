"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { submitStaffDoubleOrder, type StaffDoubleOrderState } from "../actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { ClientVoiceNoteField } from "@/app/client/order/client-voice-note-field";

const inputClass = "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100";

export function StaffDoubleOrderClient({ auth, icons }: any) {
  const [state, formAction, pending] = useActionState(submitStaffDoubleOrder, {} as StaffDoubleOrderState);

  const [sellerPhone, setSellerPhone] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [orderTime, setOrderTime] = useState("");
  const [orderType, setOrderType] = useState("");

  const [sellerAmount, setSellerAmount] = useState(0);
  const [profit, setProfit] = useState(0);
  const [deliveryPrice, setDeliveryPrice] = useState(0);

  // Region Search States
  const [sellerQ, setSellerQ] = useState("");
  const [sellerHits, setSellerHits] = useState<any[]>([]);
  const [selectedSellerRegion, setSelectedSellerRegion] = useState<any | null>(null);

  const [buyerQ, setBuyerQ] = useState("");
  const [buyerHits, setBuyerHits] = useState<any[]>([]);
  const [selectedBuyerRegion, setSelectedBuyerRegion] = useState<any | null>(null);

  // Profile data for seller and buyer
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);

  // Auto-search Seller Region
  useEffect(() => {
    if (sellerQ.length < 2 || selectedSellerRegion) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/regions/search?q=${encodeURIComponent(sellerQ)}`);
      const j = await r.json();
      setSellerHits(j.regions || []);
    }, 300);
    return () => clearTimeout(t);
  }, [sellerQ, selectedSellerRegion]);

  // Fetch Seller Profile
  useEffect(() => {
    if (!selectedSellerRegion?.id || sellerPhone.length < 10) {
      setSellerProfile(null);
      return;
    }
    const t = setTimeout(async () => {
      const qs = new URLSearchParams({
        se: auth.se,
        exp: auth.exp,
        s: auth.s,
        phone: sellerPhone,
        regionId: selectedSellerRegion.id
      });
      const res = await fetch(`/api/customer-phone-profile?${qs.toString()}`);
      const data = await res.json();
      if (data.profile) setSellerProfile(data.profile);
    }, 500);
    return () => clearTimeout(t);
  }, [sellerPhone, selectedSellerRegion, auth]);

  // Auto-search Buyer Region
  useEffect(() => {
    if (buyerQ.length < 2 || selectedBuyerRegion) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/regions/search?q=${encodeURIComponent(buyerQ)}`);
      const j = await r.json();
      setBuyerHits(j.regions || []);
    }, 300);
    return () => clearTimeout(t);
  }, [buyerQ, selectedBuyerRegion]);

  // Fetch Buyer Profile
  useEffect(() => {
    if (!selectedBuyerRegion?.id || buyerPhone.length < 10) {
      setBuyerProfile(null);
      return;
    }
    const t = setTimeout(async () => {
      const qs = new URLSearchParams({
        se: auth.se,
        exp: auth.exp,
        s: auth.s,
        phone: buyerPhone,
        regionId: selectedBuyerRegion.id
      });
      const res = await fetch(`/api/customer-phone-profile?${qs.toString()}`);
      const data = await res.json();
      if (data.profile) setBuyerProfile(data.profile);
    }, 500);
    return () => clearTimeout(t);
  }, [buyerPhone, selectedBuyerRegion, auth]);

  const [orderNoteText, setOrderNoteText] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const commonOrderTypes = ["توصيل فقط", "تجهيز وتسوق", "نقل بضائع", "أخرى"];

  if (state.ok) return (
    <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-6 text-center shadow-lg animate-in zoom-in">
      <h2 className="text-xl font-black text-emerald-800 flex items-center justify-center gap-2">
        <DynamicIcon icon={icons?.ui_success} className="w-6 h-6" fallback={<span>✅</span>} />
        تم رفع الطلب بنجاح
      </h2>
      <p className="mt-2 text-sm font-bold text-slate-600">رقم الطلب: <span className="text-emerald-700">#{state.orderNumber}</span></p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href={`/staff/portal?se=${auth.se}&exp=${auth.exp}&s=${auth.s}`} className="inline-flex justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-white font-bold hover:bg-slate-800">
          العودة للرئيسية
        </Link>
        <button onClick={() => window.location.reload()} className="inline-flex justify-center rounded-xl border border-slate-900 px-6 py-2.5 text-slate-900 font-bold hover:bg-slate-100">
          طلب جديد
        </button>
      </div>
    </div>
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="se" value={auth.se} />
      <input type="hidden" name="exp" value={auth.exp} />
      <input type="hidden" name="s" value={auth.s} />
      <input type="hidden" name="sellerRegionId" value={selectedSellerRegion?.id || ""} />
      <input type="hidden" name="buyerRegionId" value={selectedBuyerRegion?.id || ""} />
      <input type="hidden" name="sellerAmount" value={sellerAmount} />
      <input type="hidden" name="profit" value={profit} />
      <input type="hidden" name="deliveryPrice" value={deliveryPrice} />

      <input type="hidden" name="sellerLandmark" value={sellerProfile?.landmark || ""} />
      <input type="hidden" name="sellerLocationUrl" value={sellerProfile?.locationUrl || ""} />
      <input type="hidden" name="buyerLandmark" value={buyerProfile?.landmark || ""} />
      <input type="hidden" name="buyerLocationUrl" value={buyerProfile?.locationUrl || ""} />

      {state.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800">
          {state.error}
        </div>
      )}

      {/* بيانات البائع */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">بيانات البائع (المرسل)</h2>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 mr-1">رقم هاتف البائع *</label>
          <input
            name="sellerPhone"
            value={sellerPhone}
            onChange={e => setSellerPhone(e.target.value)}
            placeholder="07XXXXXXXXX"
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-1 relative">
           <label className="text-[11px] font-bold text-slate-500 mr-1">منطقة البائع *</label>
           <input
             value={sellerQ}
             onChange={e => {setSellerQ(e.target.value); setSelectedSellerRegion(null);}}
             placeholder="ابحث عن منطقة البائع..."
             className={inputClass}
             required
           />
           {sellerHits.length > 0 && !selectedSellerRegion && (
             <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-40 overflow-y-auto">
               {sellerHits.map(h => (
                 <button
                   key={h.id}
                   type="button"
                   onClick={() => {setSelectedSellerRegion(h); setSellerQ(h.name);}}
                   className="w-full text-right p-3 text-xs font-bold border-b hover:bg-sky-50"
                 >
                   {h.name}
                 </button>
               ))}
             </div>
           )}
        </div>

        {sellerProfile && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 animate-in fade-in slide-in-from-top-1">
            <p className="text-[10px] font-black text-emerald-800 mb-1">بيانات البائع المحفوظة:</p>
            <p className="text-xs font-bold text-slate-700">{sellerProfile.landmark || "لا توجد ملاحظات دالة"}</p>
            {sellerProfile.isBlocked && <p className="text-[10px] text-rose-600 font-black mt-1">⚠️ هذا الرقم محظور في هذه المنطقة!</p>}
          </div>
        )}
      </section>

      {/* بيانات المشتري */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">بيانات المشتري (المستلم)</h2>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 mr-1">رقم هاتف المشتري *</label>
          <input
            name="buyerPhone"
            value={buyerPhone}
            onChange={e => setBuyerPhone(e.target.value)}
            placeholder="07XXXXXXXXX"
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-1 relative">
           <label className="text-[11px] font-bold text-slate-500 mr-1">منطقة المشتري *</label>
           <input
             value={buyerQ}
             onChange={e => {setBuyerQ(e.target.value); setSelectedBuyerRegion(null);}}
             placeholder="ابحث عن منطقة المشتري..."
             className={inputClass}
             required
           />
           {buyerHits.length > 0 && !selectedBuyerRegion && (
             <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-40 overflow-y-auto">
               {buyerHits.map(h => (
                 <button
                   key={h.id}
                   type="button"
                   onClick={() => {
                     setSelectedBuyerRegion(h);
                     setBuyerQ(h.name);
                     setDeliveryPrice(parseFloat(h.deliveryPrice));
                   }}
                   className="w-full text-right p-3 text-xs font-bold border-b hover:bg-sky-50"
                 >
                   {h.name} ({formatDinarAsAlfWithUnit(h.deliveryPrice)})
                 </button>
               ))}
             </div>
           )}
        </div>

        {buyerProfile && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 animate-in fade-in slide-in-from-top-1">
            <p className="text-[10px] font-black text-emerald-800 mb-1">بيانات المشتري المحفوظة:</p>
            <p className="text-xs font-bold text-slate-700">{buyerProfile.landmark || "لا توجد ملاحظات دالة"}</p>
            {buyerProfile.isBlocked && <p className="text-[10px] text-rose-600 font-black mt-1">⚠️ هذا الرقم محظور في هذه المنطقة!</p>}
          </div>
        )}
      </section>

      {/* الحسابات */}
      <section className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/30 p-4">
        <h2 className="text-xs font-black text-sky-700 uppercase tracking-widest">تفاصيل المبلغ والتوقيت</h2>

        <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 mr-1">نوع الطلب *</label>
                <div className="flex flex-wrap gap-2">
                  {commonOrderTypes.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOrderType(t)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        orderType === t
                        ? "bg-sky-600 text-white shadow-md scale-105"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-sky-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                    name="orderType"
                    value={orderType}
                    onChange={e => setOrderType(e.target.value)}
                    placeholder="أو اكتب نوعاً مخصصاً هنا..."
                    className={inputClass}
                    required
                />
            </div>
            <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 mr-1">وقت الطلب *</label>
                <input
                    name="orderTime"
                    value={orderTime}
                    onChange={e => setOrderTime(e.target.value)}
                    placeholder="فوري، غداً، الساعة ٤..."
                    className={inputClass}
                    required
                />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 mr-1">المبلغ للبائع</label>
                <input
                    type="number"
                    value={sellerAmount || ""}
                    onChange={e => setSellerAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={inputClass}
                />
            </div>
            <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 mr-1">الربح</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={profit || ""}
                    onChange={e => setProfit(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={`${inputClass} flex-1`}
                  />
                  <button
                      type="button"
                      onClick={() => setProfit(prev => Math.max(0, prev - 1))}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-rose-500 font-bold active:scale-90 shadow-sm"
                  >
                      -1
                  </button>
                  <button
                      type="button"
                      onClick={() => setProfit(prev => prev + 1)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-sky-100 text-sky-700 font-bold active:scale-90 shadow-sm"
                  >
                      +1
                  </button>
                </div>
            </div>
        </div>

        <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 mr-1">سعر التوصيل</label>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={deliveryPrice || ""}
                    onChange={e => setDeliveryPrice(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={`${inputClass} flex-1 text-sky-900`}
                />
                <button
                    type="button"
                    onClick={() => {
                      const basePrice = parseFloat(selectedBuyerRegion?.deliveryPrice || "0");
                      setDeliveryPrice(prev => Math.max(basePrice, prev - 1));
                    }}
                    className="w-12 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-rose-500 font-bold active:scale-90 shadow-sm disabled:opacity-30"
                    disabled={deliveryPrice <= parseFloat(selectedBuyerRegion?.deliveryPrice || "0")}
                >
                    -1
                </button>
                <button
                    type="button"
                    onClick={() => setDeliveryPrice(prev => prev + 1)}
                    className="w-12 h-10 flex items-center justify-center rounded-xl bg-sky-600 text-white font-bold active:scale-90 shadow-lg"
                >
                    +1
                </button>
            </div>
            <p className="text-[9px] font-bold text-slate-400 italic">* يمكنك زيادة سعر التوصيل، ولا يمكن تقليله عن السعر الأصلي للمنطقة ({formatDinarAsAlfWithUnit(selectedBuyerRegion?.deliveryPrice || 0)}).</p>
        </div>

        <div className="mt-4 p-4 rounded-2xl bg-slate-900 text-white">
            <div className="flex justify-between items-center">
                <span className="text-xs font-bold opacity-70">المبلغ الكلي المطلوب من المشتري:</span>
                <span className="text-xl font-black text-sky-400">{formatDinarAsAlfWithUnit(totalAmount)}</span>
            </div>
            <p className="text-[10px] mt-1 opacity-50 text-center">(مبلغ البائع + الربح + التوصيل)</p>
        </div>
      </section>

      {/* وسائط وملاحظات إضافية */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">المرفقات والملاحظات (اختياري)</h2>

        {/* ملاحظة نصية */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 mr-1">ملاحظات الطلب</label>
          <textarea
            name="orderNoteText"
            value={orderNoteText}
            onChange={e => setOrderNoteText(e.target.value)}
            placeholder="مثلاً: المحل بجانب الصيدلية، أو أي ملاحظات أخرى..."
            className={`${inputClass} min-h-[80px] py-3 resize-none`}
          />
        </div>

        {/* رفع صورة */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
            <DynamicIcon iconKey="ui_image" config={icons} className="w-3 h-3" fallback={<span>🖼️</span>} />
            صورة الطلب / القائمة
          </label>
          <div className="flex flex-col gap-3">
            <input
              type="file"
              name="imageFile"
              accept="image/*"
              className="hidden"
              ref={imageInputRef}
              onChange={handleImageChange}
            />
            {!imagePreview ? (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-slate-500 transition hover:border-sky-400 hover:bg-sky-50 active:scale-95"
              >
                <DynamicIcon iconKey="ui_plus" config={icons} className="w-8 h-8 opacity-20" />
                <span className="text-xs font-bold">اضغط لإضافة صورة</span>
              </button>
            ) : (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-black shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Preview" className="h-full w-full object-contain" />
                <button
                  type="button"
                  onClick={() => {setImagePreview(null); if(imageInputRef.current) imageInputRef.current.value="";}}
                  className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg active:scale-90"
                >
                  <DynamicIcon iconKey="ui_close" config={icons} className="w-4 h-4" fallback={<span>✕</span>} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ملاحظة صوتية */}
        <ClientVoiceNoteField
          fieldName="voiceFile"
          title="تسجيل صوتي للملاحظات"
          wrapperClassName="mt-2"
        />
      </section>

      <button
        type="submit"
        disabled={pending || !selectedSellerRegion || !selectedBuyerRegion}
        className="w-full rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 py-4 text-white font-black shadow-xl disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
      >
        {pending ? "جاري الحفظ..." : "رفع الطلب الآن 🚀"}
      </button>
    </form>
  );
}
