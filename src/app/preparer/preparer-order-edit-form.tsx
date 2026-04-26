"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, type ChangeEvent } from "react";
import { assignFileToInput, compressImageFileForUpload } from "@/lib/client-image-compress";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { updatePreparerOrderFields, type PreparerActionState } from "./actions";

const initial: PreparerActionState = {};

export function PreparerOrderEditForm({
  auth,
  orderId,
  defaults,
}: {
  auth: { p: string; exp: string; s: string };
  orderId: string;
  defaults: {
    orderType: string;
    customerPhone: string;
    orderSubtotalAlf: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updatePreparerOrderFields, initial);
  const formRef = useRef<HTMLFormElement>(null);

  async function onPickImageFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const out = await compressImageFileForUpload(f);
      assignFileToInput(input, out);
    } catch {
      assignFileToInput(input, f);
    }
  }

  useEffect(() => {
    if (state?.ok && formRef.current) {
      formRef.current.reset();
    }
  }, [state?.ok]);

  const homeHref = preparerPath("/preparer", auth);

  if (state?.ok) {
    return (
      <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-8 text-center">
        <p className="text-4xl" aria-hidden>
          ✓
        </p>
        <h2 className="mt-3 text-xl font-bold text-emerald-800">تم حفظ التعديلات</h2>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href={homeHref}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            العودة للطلبات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="p" value={auth.p} />
      <input type="hidden" name="exp" value={auth.exp} />
      <input type="hidden" name="s" value={auth.s} />
      <input type="hidden" name="orderId" value={orderId} />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">نوع الطلب *</span>
        <input
          name="orderType"
          required
          defaultValue={defaults.orderType}
          className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">هاتف الزبون *</span>
        <input
          name="customerPhone"
          required
          inputMode="numeric"
          defaultValue={defaults.customerPhone}
          className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">سعر الطلب (بالألف)</span>
        <input
          name="orderSubtotal"
          defaultValue={defaults.orderSubtotalAlf}
          className="rounded-xl border-2 border-slate-400 bg-amber-50/50 px-3 py-2.5 text-base font-bold text-slate-900 shadow-inner focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="اتركه فارغاً لعدم التغيير"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">صورة الطلبية (استبدال)</span>
        <input
          name="orderImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm"
          onChange={onPickImageFile}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">صورة باب المحل (استبدال)</span>
        <input
          name="shopDoorPhoto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="text-sm"
          onChange={onPickImageFile}
        />
      </label>

      {state?.error ? <p className="text-sm font-bold text-rose-700">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {pending ? "جارٍ الحفظ…" : "حفظ التعديلات"}
      </button>
      {pending ? (
        <p className="text-center text-xs leading-relaxed text-slate-500">
          قد يستغرق الحفظ وقتاً أطول مع الصور؛ انتظر ولا تغلق الصفحة.
        </p>
      ) : null}
    </form>
  );
}
