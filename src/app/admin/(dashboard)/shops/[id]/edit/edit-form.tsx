"use client";

import { useActionState, useRef, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { resolvePublicImageSrc } from "@/lib/image-url";
import { updateShop, type ShopFormState } from "../../actions";
import {
  AdminRegionSearchPicker,
  type AdminRegionOption,
} from "@/components/admin-region-search-picker";

const initial: ShopFormState = {};

export function ShopEditForm({
  id,
  defaultName,
  defaultOwnerName,
  defaultPhotoUrl,
  defaultPhone,
  defaultUrl,
  defaultRegionId,
  regions,
}: {
  id: string;
  defaultName: string;
  defaultOwnerName: string;
  defaultPhotoUrl: string;
  defaultPhone: string;
  defaultUrl: string;
  defaultRegionId: string;
  regions: AdminRegionOption[];
}) {
  const [state, formAction, pending] = useActionState(updateShop, initial);
  
  // المتغيرات الجديدة للتحكم بالكاميرا والمعرض
  const shopPhotoRef = useRef<HTMLInputElement>(null);
  const [shopPhotoName, setShopPhotoName] = useState<string | null>(null);

  const currentPhotoSrc = resolvePublicImageSrc(defaultPhotoUrl);
  const [regionId, setRegionId] = useState<string>(defaultRegionId);

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="photoUrlKeep" value={defaultPhotoUrl} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>اسم المحل</span>
          <input
            name="name"
            required
            defaultValue={defaultName}
            className={ad.input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>اسم صاحب المحل (صفحة رفع الطلب)</span>
          <input
            name="ownerName"
            defaultValue={defaultOwnerName}
            className={ad.input}
            placeholder="مثال: مصطفى"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>هاتف المحل (للمندوب — 11 رقماً، اختياري)</span>
          <input
            name="phone"
            inputMode="numeric"
            defaultValue={defaultPhone}
            className={ad.input}
            placeholder="07xxxxxxxxx"
          />
        </label>
        {currentPhotoSrc ? (
          <div className="sm:col-span-2">
            <p className={`mb-1 ${ad.label}`}>الصورة الحالية</p>
            <img
              src={currentPhotoSrc}
              alt=""
              className="max-h-40 rounded-xl border border-sky-200 object-contain"
            />
          </div>
        ) : null}
        
        {/* بداية التعديل: أزرار الكاميرا والمعرض */}
        <div className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>صورة محل جديدة (اختياري)</span>
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
            <p className="mt-1 text-xs font-bold text-emerald-700">سيتم استبدال الصورة بـ: {shopPhotoName}</p>
          ) : null}
          <span className="mt-1 text-xs text-slate-500">
            JPG أو PNG أو Webp — حتى 10 ميجابايت. اترك فارغاً للإبقاء على الصورة الحالية.
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
            defaultValue={defaultUrl}
            className={ad.input}
          />
        </label>
      </div>
      {state.error ? (
        <p className={ad.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className={ad.success}>تم حفظ التعديلات.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className={ad.btnPrimary}
      >
        {pending ? "جارٍ الحفظ…" : "حفظ"}
      </button>
    </form>
  );
}
