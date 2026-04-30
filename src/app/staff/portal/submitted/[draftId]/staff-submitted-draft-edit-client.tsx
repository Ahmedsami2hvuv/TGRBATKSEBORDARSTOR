"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { updateStaffPreparationDraft, type StaffDraftEditState } from "../../actions";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

type RegionHit = { id: string; name: string; deliveryPrice: string };

const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

const initial: StaffDraftEditState = {};

type Draft = {
  id: string;
  status: string;
  titleLine: string;
  rawListText: string;
  customerRegionId: string | null;
  customerRegion: { id: string; name: string; deliveryPrice: string } | null;
  customerPhone: string;
  customerName: string;
  customerLandmark: string;
  orderTime: string;
  data: unknown;
  preparer: { name: string } | null;
};

function extractProductsCsv(draft: Draft): string {
  const d = draft.data;
  if (!d || typeof d !== "object") return "";
  const o = d as Record<string, unknown>;
  const products = o.products;
  if (!Array.isArray(products)) return "";
  const lines: string[] = [];
  for (const p of products) {
    if (!p || typeof p !== "object") continue;
    const line = String((p as Record<string, unknown>).line ?? "").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

export function StaffSubmittedDraftEditClient({
  auth,
  staffName,
  draft,
}: {
  auth: { se: string; exp: string; s: string };
  staffName: string;
  draft: Draft;
}) {
  const [state, formAction, pending] = useActionState(updateStaffPreparationDraft, initial);
  const regionSearchRef = useRef<HTMLInputElement>(null);

  const [titleLine, setTitleLine] = useState(draft.titleLine || "");
  const [customerPhone, setCustomerPhone] = useState(draft.customerPhone || "");
  const [orderTime, setOrderTime] = useState(draft.orderTime || "فوري");
  const [rawListText, setRawListText] = useState(draft.rawListText || "");
  const [productsCsv, setProductsCsv] = useState(extractProductsCsv(draft));

  const [q, setQ] = useState(draft.customerRegion?.name ?? "");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [selected, setSelected] = useState<RegionHit | null>(
    draft.customerRegion ? { ...draft.customerRegion } : null,
  );
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const canEdit = draft.status !== "sent" && draft.status !== "archived";

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/regions/search?q=${encodeURIComponent(q.trim())}`);
          const j = (await r.json()) as { regions?: RegionHit[] };
          setHits(j.regions ?? []);
        } catch {
          setHits([]);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const err = state.error?.trim();
    if (!err) return;
    if (err.includes("منطقة")) regionSearchRef.current?.focus();
  }, [state.error]);

  const productsCount = useMemo(() => {
    return productsCsv
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean).length;
  }, [productsCsv]);

  function translateDraftStatus(status: string): string {
    switch (status) {
      case "draft": return "مسودة";
      case "priced": return "مُسعّرة";
      case "sent": return "مُرسلة";
      case "archived": return "مؤرشفة";
      default: return status;
    }
  }

  return (
    <div className="space-y-4">
      <header className="kse-glass-dark rounded-2xl border border-sky-200 p-5">
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <DynamicIcon icon={icons?.ui_edit} className="w-5 h-5" fallback={<span>✏️</span>} />
          تعديل الطلب المرفوع
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          الموظف: <span className="font-black text-sky-900">{staffName}</span> — المجهّز:{" "}
          <span className="font-black text-slate-900">{draft.preparer?.name ?? "غير معروف"}</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          الحالة: <span className="font-bold">{translateDraftStatus(draft.status)}</span>
        </p>
      </header>

      {!canEdit ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 flex items-center gap-2">
          <DynamicIcon icon={icons?.ui_warning} className="w-4 h-4" fallback={<span>⚠️</span>} />
          هذه المسودة لا يمكن تعديلها حالياً (تم إرسالها أو أرشفتها).
        </p>
      ) : null}

      <form action={formAction} className="kse-glass-dark rounded-2xl border border-indigo-200 p-4 shadow-sm">
        <input type="hidden" name="se" value={auth.se} />
        <input type="hidden" name="exp" value={auth.exp} />
        <input type="hidden" name="s" value={auth.s} />
        <input type="hidden" name="draftId" value={draft.id} />
        <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />
        <input type="hidden" name="customerName" value={""} />
        <input type="hidden" name="customerLandmark" value={""} />

        <label className="mt-1 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">عنوان المنطقة *</span>
          <input
            name="titleLine"
            value={titleLine}
            onChange={(e) => setTitleLine(e.target.value)}
            className={inputClass}
            required
            disabled={!canEdit}
          />
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">بحث المنطقة واختيارها *</span>
          <input
            ref={regionSearchRef}
            value={q}
            onChange={(ev) => {
              setQ(ev.target.value);
              setSelected(null);
            }}
            className={inputClass}
            placeholder="ابحث بالمنطقة"
            disabled={!canEdit}
          />
        </label>
        {hits.length > 0 && !selected && canEdit ? (
          <ul className="mt-2 max-h-40 overflow-auto rounded-xl border border-sky-200 bg-white text-sm shadow-md">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-end text-slate-800 hover:bg-sky-50"
                  onClick={() => {
                    setSelected(h);
                    setQ(h.name);
                    setHits([]);
                  }}
                >
                  {h.name}{" "}
                  <span className="text-xs text-slate-500">({formatDinarAsAlfWithUnit(h.deliveryPrice)})</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {selected ? (
          <p className="mt-2 text-xs font-bold text-emerald-800">تم اختيار المنطقة: {selected.name}</p>
        ) : null}

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">رقم الزبون *</span>
          <input
            name="customerPhone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className={`${inputClass} font-mono`}
            required
            disabled={!canEdit}
          />
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">وقت الطلب *</span>
          <input
            name="orderTime"
            value={orderTime}
            onChange={(e) => setOrderTime(e.target.value)}
            className={inputClass}
            required
            disabled={!canEdit}
          />
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">
            المنتجات * <span className="text-slate-500">({productsCount})</span>
          </span>
          <textarea
            name="productsCsv"
            value={productsCsv}
            onChange={(e) => setProductsCsv(e.target.value)}
            className={`${inputClass} min-h-[10rem] resize-y font-mono`}
            placeholder="سطر لكل منتج"
            disabled={!canEdit}
            required
          />
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">نص القائمة الخام (اختياري)</span>
          <textarea
            name="rawListText"
            value={rawListText}
            onChange={(e) => setRawListText(e.target.value)}
            className={`${inputClass} min-h-[6rem] resize-y font-mono`}
            placeholder="الصق النص الأصلي إن تحب"
            disabled={!canEdit}
          />
        </label>

        {state.error ? (
          <p className="mt-3 text-sm font-semibold text-rose-700 flex items-center gap-1">
            <DynamicIcon icon={icons?.ui_error} className="w-4 h-4" fallback={<span>❌</span>} />
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="mt-3 text-sm font-semibold text-emerald-800 flex items-center gap-1">
            <DynamicIcon icon={icons?.ui_success} className="w-4 h-4" fallback={<span>✅</span>} />
            تم حفظ التعديلات.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !canEdit}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {pending ? "جارٍ الحفظ..." : (
            <>
              <DynamicIcon icon={icons?.ui_success} className="w-4 h-4 brightness-0 invert" fallback={<span>✅</span>} />
              حفظ التعديلات
            </>
          )}
        </button>
      </form>
    </div>
  );
}
