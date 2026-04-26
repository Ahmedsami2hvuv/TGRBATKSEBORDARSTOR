"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { assignFileToInput, compressImageFileForUpload } from "@/lib/client-image-compress";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { submitPreparerOrder, type PreparerActionState } from "./actions";

const initial: PreparerActionState = {};

type RegionOpt = { id: string; name: string };
type ShopOpt = { id: string; name: string; deliveryAlf: number };

export function PreparerOrderNewForm({
  auth,
  shops,
  regions,
}: {
  auth: { p: string; exp: string; s: string };
  shops: ShopOpt[];
  regions: RegionOpt[];
}) {
  const [state, formAction, pending] = useActionState(submitPreparerOrder, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [shopId, setShopId] = useState(shops[0]?.id ?? "");
  const shop = shops.find((s) => s.id === shopId);
  const [shopQuery, setShopQuery] = useState(shop?.name ?? "");
  const [shopPickerOpen, setShopPickerOpen] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);

  const shopHits =
    shopQuery.trim().length < 2
      ? []
      : shops
          .filter((s) => s.name.toLowerCase().includes(shopQuery.trim().toLowerCase()))
          .slice(0, 12);

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

  function copyNotesToClipboard() {
    const t = notesRef.current?.value?.trim() ?? "";
    if (!t) return;
    void navigator.clipboard?.writeText(t).catch(() => {});
  }

  useEffect(() => {
    if (state?.ok && formRef.current) {
      formRef.current.reset();
      setShopId(shops[0]?.id ?? "");
      setShopQuery(shops[0]?.name ?? "");
      setShopPickerOpen(false);
      setShopError(null);
    }
  }, [state?.ok, shops]);

  const homeHref = preparerPath("/preparer", auth);

  if (shops.length === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-950">
        لا يوجد محل مفعّل لك «صلاحية رفع الطلب». اطلب من الإدارة تفعيلها من قسم المجهزين.
      </p>
    );
  }

  if (state?.ok) {
    return (
      <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-8 text-center">
        <p className="text-4xl" aria-hidden>
          ✓
        </p>
        <h2 className="mt-3 text-xl font-bold text-emerald-800">تم رفع الطلب</h2>
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
    <form
      ref={formRef}
      action={formAction}
      encType="multipart/form-data"
      className="space-y-4"
      onSubmit={(e) => {
        if (!shopId) {
          e.preventDefault();
          setShopError("اختر المحل من القائمة.");
        }
      }}
    >
      <input type="hidden" name="p" value={auth.p} />
      <input type="hidden" name="exp" value={auth.exp} />
      <input type="hidden" name="s" value={auth.s} />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">المحل *</span>
        <div className="relative">
          <input
            type="text"
            required
            value={shopQuery}
            onChange={(e) => {
              const t = e.target.value;
              setShopQuery(t);
              setShopPickerOpen(true);
              const exact = shops.find((x) => x.name.trim() === t.trim());
              setShopId(exact?.id ?? "");
              setShopError(null);
            }}
            onFocus={() => setShopPickerOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setShopPickerOpen(false), 140);
            }}
            placeholder="اكتب اسم المحل..."
            className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm outline-none"
          />

          <input type="hidden" name="shopId" value={shopId} />

          {shopPickerOpen && shopHits.length > 0 ? (
            <ul
              className="absolute left-0 right-0 z-10 mt-2 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm"
              role="listbox"
            >
              {shopHits.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-end text-sm font-semibold text-slate-800 hover:bg-sky-50"
                    onMouseDown={(ev) => {
                      // لمنع onBlur من إغلاق القائمة قبل التحديد
                      ev.preventDefault();
                      setShopId(s.id);
                      setShopQuery(s.name);
                      setShopPickerOpen(false);
                      setShopError(null);
                    }}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {shopError ? <p className="text-xs font-bold text-rose-700">{shopError}</p> : null}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">نوع الطلب *</span>
        <input name="orderType" required className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">وقت الطلب *</span>
        <input name="orderTime" required className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">منطقة الزبون *</span>
        <select name="customerRegionId" required className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm">
          <option value="">— اختر —</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">هاتف الزبون *</span>
        <input name="customerPhone" required inputMode="numeric" className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">اسم الزبون</span>
        <input name="customerName" className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">رقم ثانٍ</span>
        <input name="alternatePhone" inputMode="numeric" className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">سعر الطلب (بالألف) — اختياري</span>
        <input name="orderSubtotal" className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm animate-placeholder" placeholder="اكتب السعر هنا" />
      </label>

      <p className="text-xs text-slate-500">
        أقل أجر توصيل من منطقة المحل (بالألف، للمرجع):{" "}
        {shop ? `${shop.deliveryAlf.toFixed(2)} ألف` : "—"}
      </p>

      <label className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-slate-800">ملاحظات</span>
          <button
            type="button"
            onClick={copyNotesToClipboard}
            className="shrink-0 rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-sky-50"
            title="نسخ محتوى الملاحظات"
          >
            نسخ
          </button>
        </div>
        <textarea
          ref={notesRef}
          name="notes"
          rows={2}
          className="rounded-xl border border-sky-200 px-3 py-2 text-sm"
          onPointerDown={copyNotesToClipboard}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">لوكيشن (رابط)</span>
        <input name="customerLocationUrl" className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">دليل / أقرب نقطة</span>
        <input name="customerLandmark" className="rounded-xl border border-sky-200 px-3 py-2.5 text-sm" />
      </label>

      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input type="checkbox" name="prepaidAll" />
        كل المبلغ واصل (بدون كاش عند الباب)
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">صورة الطلبية</span>
        <input
          name="orderImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm"
          onChange={onPickImageFile}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-slate-800">صورة باب المحل</span>
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
        {pending ? "جارٍ الإرسال…" : "إرسال الطلب"}
      </button>
      {pending ? (
        <p className="text-center text-xs leading-relaxed text-slate-500">
          قد يستغرق الإرسال وقتاً أطول مع الصور؛ انتظر ولا تغلق الصفحة.
        </p>
      ) : null}
    </form>
  );
}
