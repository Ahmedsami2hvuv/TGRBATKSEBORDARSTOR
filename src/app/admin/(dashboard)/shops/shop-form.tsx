"use client";

import { useActionState, useRef, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { createShop, type ShopFormState } from "./actions";
import { AdminRegionSearchPicker, type AdminRegionOption } from "@/components/admin-region-search-picker";

const initial: ShopFormState = {};

export function ShopForm({
  regions,
}: {
  regions: AdminRegionOption[];
}) {
  const [state, formAction, pending] = useActionState(createShop, initial);
  
  // المتغيرات الجديدة للتحكم بالكاميرا والمعرض
  const shopPhotoRef = useRef<HTMLInputElement>(null);
  const [shopPhotoName, setShopPhotoName] = useState<string | null>(null);

  const [regionId, setRegionId] = useState<string>("");
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [locationUrl, setLocationUrl] = useState("");

  if (regions.length === 0) {
    return (
      <p className={ad.warn}>
        أضف منطقة واحدة على الأقل من صفحة «المناطق» قبل إنشاء محل.
      </p>
    );
  }

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>اسم المحل</span>
          <input
            name="name"
            required
            className={ad.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>اسم صاحب المحل (يظهر في صفحة رفع الطلب)</span>
          <input
            name="ownerName"
            className={ad.input}
            placeholder="مثال: مصطفى"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>هاتف المحل (للمندوب — 11 رقماً، اختياري)</span>
          <input
            name="phone"
            inputMode="numeric"
            className={ad.input}
            placeholder="07xxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        
        {/* بداية التعديل: أزرار الكاميرا والمعرض */}
        <div className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>صورة المحل (اختياري)</span>
          <input
            ref={shopPhotoRef}
            name="shopPhoto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.[0]) setShopPhotoName(e.target.files[0].name);
            }}
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-sky-400 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
              onClick={() => {
                shopPhotoRef.current?.setAttribute("capture", "environment");
                shopPhotoRef.current?.click();
              }}
            >
              📷 كاميرا
            </button>
            <button
              type="button"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
              onClick={() => {
                shopPhotoRef.current?.removeAttribute("capture");
                shopPhotoRef.current?.click();
              }}
            >
              🖼 معرض
            </button>
          </div>
          {shopPhotoName ? (
            <p className="mt-1 text-xs font-bold text-emerald-700">تم اختيار: {shopPhotoName}</p>
          ) : null}
          <span className="mt-1 text-xs text-slate-500">
            JPG أو PNG أو Webp — حتى 10 ميجابايت
          </span>
        </div>
        {/* نهاية التعديل */}

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>المنطقة</span>
          <AdminRegionSearchPicker
            name="regionId"
            regions={regions}
            value={regionId}
            onValueChange={setRegionId}
            allowEmpty={false}
            placeholder="اكتب جزءاً من اسم المنطقة للبحث…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>رابط الموقع / اللوكيشن</span>
          <input
            name="locationUrl"
            type="text"
            inputMode="url"
            required
            placeholder="https://maps.app.goo.gl/..."
            className={ad.input}
            value={locationUrl}
            onChange={(e) => setLocationUrl(e.target.value)}
          />
        </label>
      </div>
      {state.error ? (
        <p className={ad.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className={ad.success}>تمت إضافة المحل.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className={ad.btnPrimary}
      >
        {pending ? "جارٍ الحفظ…" : "إضافة محل"}
      </button>
    </form>
  );
}
