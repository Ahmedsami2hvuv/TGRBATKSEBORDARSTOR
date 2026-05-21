"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { AdminRegionSearchPicker, type AdminRegionOption } from "@/components/admin-region-search-picker";
import {
  updateCustomerPhoneProfile,
  type CustomerProfileFormState,
} from "./actions";

const initial: CustomerProfileFormState = {};

export function CustomerProfileEditForm({
  profileId,
  defaultPhone,
  defaultRegionId,
  defaultLocationUrl,
  defaultLandmark,
  defaultAlternatePhone,
  defaultNotes,
  defaultPhotoUrl,
  defaultIsBlocked,
  regions,
}: {
  profileId: string;
  defaultPhone: string;
  defaultRegionId: string;
  defaultLocationUrl: string;
  defaultLandmark: string;
  defaultAlternatePhone: string;
  defaultNotes: string;
  defaultPhotoUrl: string;
  defaultIsBlocked: boolean;
  regions: AdminRegionOption[];
}) {
  const [state, formAction, pending] = useActionState(
    updateCustomerPhoneProfile,
    initial,
  );
  const [regionId, setRegionId] = useState(defaultRegionId);

  if (regions.length === 0) {
    return (
      <p className={ad.warn}>
        أضف منطقة واحدة على الأقل من صفحة «المناطق».
      </p>
    );
  }

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-3"
    >
      <input type="hidden" name="id" value={profileId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>رقم هاتف الزبون</span>
          <input
            value={defaultPhone}
            readOnly
            className={`${ad.input} font-mono tabular-nums bg-slate-50 text-slate-600`}
          />
        </label>
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
          <span className={ad.label}>رابط اللوكيشن (اختياري)</span>
          <input
            name="locationUrl"
            type="text"
            inputMode="url"
            defaultValue={defaultLocationUrl}
            placeholder="https://maps.app.goo.gl/…"
            className={ad.input}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>أقرب نقطة دالة (اختياري)</span>
          <input
            name="landmark"
            type="text"
            defaultValue={defaultLandmark}
            className={ad.input}
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2 bg-red-50 p-3 rounded-xl border border-red-100">
          <input
            type="checkbox"
            name="isBlocked"
            defaultChecked={defaultIsBlocked}
            className="w-5 h-5 text-red-600 border-red-300 rounded focus:ring-red-500"
          />
          <div className="flex flex-col">
            <span className="font-bold text-red-700">حظر الزبون في هذه المنطقة</span>
            <span className="text-xs text-red-600">سيتم إضافة علامة تحذير للمناديب ومنع الطلبات الجديدة لهذا الرقم في هذه المنطقة.</span>
          </div>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>رقم هاتف ثانٍ (اختياري)</span>
          <input
            name="alternatePhone"
            inputMode="numeric"
            defaultValue={defaultAlternatePhone}
            className={`${ad.input} font-mono tabular-nums`}
            placeholder="07xxxxxxxx"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>ملاحظات (اختياري)</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={defaultNotes}
            className={`${ad.input} min-h-[5rem] resize-y`}
          />
        </label>
        {defaultPhotoUrl ? (
          <div className="sm:col-span-2">
            <span className={ad.label}>الصورة الحالية</span>
            <div className="mt-2 flex flex-wrap items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={defaultPhotoUrl}
                alt=""
                className="max-h-40 max-w-full rounded-xl border border-sky-200 object-contain"
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="removePhoto" className="rounded border-sky-300" />
                إزالة الصورة الحالية
              </label>
            </div>
          </div>
        ) : null}
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={ad.label}>
            {defaultPhotoUrl ? "استبدال صورة الباب (اختياري)" : "صورة باب الزبون (اختياري)"}
          </span>
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={ad.input}
          />
          <span className="text-xs text-slate-500">
            JPG أو PNG أو Webp — حتى 10 ميجابايت
          </span>
        </label>
      </div>
      {state.error ? (
        <p className={ad.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className={ad.success}>تم حفظ التعديلات.</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={ad.btnPrimary}>
          {pending ? "جارٍ الحفظ…" : "حفظ التعديلات"}
        </button>
        <Link href="/abo1stor3hlaa2kbr8-47/customers/profiles" className={ad.btnDark}>
          رجوع للقائمة
        </Link>
      </div>
    </form>
  );
}
