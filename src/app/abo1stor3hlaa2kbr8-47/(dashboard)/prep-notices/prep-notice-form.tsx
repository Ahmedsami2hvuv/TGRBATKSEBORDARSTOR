"use client";

import { useActionState } from "react";
import { ad } from "@/lib/admin-ui";
import { createAdminPrepNotices, type PrepNoticeAdminState } from "./actions";

const initial: PrepNoticeAdminState = {};

type PreparerOpt = { id: string; name: string };

export function PrepNoticeForm({ preparers }: { preparers: PreparerOpt[] }) {
  const [state, formAction, pending] = useActionState(createAdminPrepNotices, initial);

  if (state.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
        تم إنشاء الإشعار وإسناده للمجهزين المحددين.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <label className="flex flex-col gap-1">
        <span className={ad.label}>عنوان الإشعار *</span>
        <input name="title" required maxLength={200} className={ad.input} placeholder="مثال: طلب تجهيز عاجل" />
      </label>
      <label className="flex flex-col gap-1">
        <span className={ad.label}>تفاصيل (اختياري)</span>
        <textarea
          name="body"
          rows={5}
          maxLength={8000}
          className={`${ad.input} min-h-[8rem] resize-y`}
          placeholder="وصف المطلوب من المجهز…"
        />
      </label>
      <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
        <legend className={`px-1 ${ad.label}`}>إسناد إلى مجهزين *</legend>
        {preparers.length === 0 ? (
          <p className="text-sm text-amber-800">لا يوجد مجهزون مفعّلون. أضف مجهزين من «المجهزين» أولاً.</p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {preparers.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="preparerId" value={p.id} className="h-4 w-4 rounded border-slate-300" />
                  <span>{p.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      {state.error ? (
        <p className="text-sm font-semibold text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending || preparers.length === 0} className={ad.btnPrimary}>
        {pending ? "جارٍ الإرسال…" : "إنشاء وإرسال الإشعار"}
      </button>
    </form>
  );
}
