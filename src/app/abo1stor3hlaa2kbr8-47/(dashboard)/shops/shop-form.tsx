"use client";

import { useActionState, useRef, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { createShop, type ShopFormState } from "./actions";
import { AdminRegionSearchPicker, type AdminRegionOption } from "@/components/admin-region-search-picker";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

const initial: ShopFormState = {};

export function ShopForm({
  regions,
  icons,
}: {
  regions: AdminRegionOption[];
  icons: GlobalIconsConfig | null;
}) {
  const [state, formAction, pending] = useActionState(createShop, initial);
  
  // المتغيرات الجديدة للتحكم بالكاميرا والمعرض
  const shopPhotoRef = useRef<HTMLInputElement>(null);
  const [shopPhotoName, setShopPhotoName] = useState<string | null>(null);

  const [regionId, setRegionId] = useState<string>("");
  const [name, setName] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");

  if (regions.length === 0) {
    return (
      <p className={ad.warn}>
        أضف منطقة واحدة على الأقل من صفحة «المناطق» قبل إنشاء محل.
      </p>
    );
  }

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-4">
      <div className="flex flex-col gap-4">
        {/* 1. اسم المحل */}
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>اسم المحل</span>
          <input
            name="name"
            required
            className={ad.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: محل النور"
          />
        </label>

        {/* 2. لكيشن المحل */}
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>لكيشن المحل (رابط الخريطة)</span>
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

        {/* 3. منطقة المحل */}
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>منطقة المحل</span>
          <AdminRegionSearchPicker
            name="regionId"
            regions={regions}
            value={regionId}
            onValueChange={setRegionId}
            allowEmpty={false}
            placeholder="ابحث عن المنطقة..."
          />
        </label>

        {/* 4. صورة باب المحل */}
        <div className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>صورة باب المحل (اختياري)</span>
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
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              className="inline-flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-xl border border-sky-400 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
              onClick={() => {
                shopPhotoRef.current?.setAttribute("capture", "environment");
                shopPhotoRef.current?.click();
              }}
            >
              <DynamicIcon iconKey="ui_camera" config={icons} fallback="📷" className="w-4 h-4" /> كاميرا
            </button>
            <button
              type="button"
              className="inline-flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
              onClick={() => {
                shopPhotoRef.current?.removeAttribute("capture");
                shopPhotoRef.current?.click();
              }}
            >
              <DynamicIcon iconKey="ui_image" config={icons} fallback="🖼" className="w-4 h-4" /> معرض
            </button>
          </div>
          {shopPhotoName ? (
            <p className="mt-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">✅ تم اختيار: {shopPhotoName}</p>
          ) : null}
        </div>
        {/* خيار إيقاف إظهار الديون */}
        <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
          <input
            name="hideDebts"
            type="checkbox"
            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
          />
          <span className="font-bold text-slate-700">عدم احتساب دين هذا المحل</span>
        </label>

        <div className="mt-2 pt-4 border-t border-sky-100 space-y-4">
          <p className="text-xs font-black text-sky-700">بيانات العميل الأول للمحل</p>

          {/* 5. رقم العميل الأول */}
          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>رقم العميل الأول</span>
            <input
              name="customerPhone"
              required
              inputMode="numeric"
              className={ad.input}
              placeholder="07xxxxxxxxx"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </label>

          {/* 6. اسم العميل الأول */}
          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>اسم العميل الأول (اختياري)</span>
            <input
              name="customerName"
              className={ad.input}
              placeholder="مثال: الإدارة أو اسم الموظف"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </label>
        </div>
      </div>

      {state.error ? (
        <p className={`${ad.error} mt-2`} role="alert">
          {state.error}
        </p>
      ) : null}

      {state.ok ? <p className={`${ad.success} mt-2`}>✅ تمت إضافة المحل والعميل بنجاح.</p> : null}

      <button
        type="submit"
        disabled={pending}
        className={`${ad.btnPrimary} w-full mt-4 min-h-[48px]`}
      >
        {pending ? "جارٍ الحفظ..." : "إضافة المحل والعميل"}
      </button>
    </form>
  );
}
