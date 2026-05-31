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
  preparerId: string | null;
  preparer: { name: string } | null;
};

type PreparerRow = {
  id: string;
  name: string;
  phone: string;
};

type ProductItem = { id: string; line: string; preparerId: string | null };

function extractProductsArray(draft: Draft): ProductItem[] {
  const d = draft.data;
  if (!d || typeof d !== "object") return [];
  const o = d as Record<string, unknown>;
  const products = o.products;
  if (!Array.isArray(products)) return [];
  
  const items: ProductItem[] = [];
  for (const p of products) {
    if (!p || typeof p !== "object") continue;
    const pObj = p as Record<string, unknown>;
    const line = String(pObj.line ?? "").trim();
    if (line) {
      items.push({
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        line,
        preparerId: (pObj.preparerId as string) || null,
      });
    }
  }
  return items;
}

export function StaffSubmittedDraftEditClient({
  auth,
  staffName,
  draft,
  preparers,
}: {
  auth: { se: string; exp: string; s: string };
  staffName: string;
  draft: Draft;
  preparers: PreparerRow[];
}) {
  const [state, formAction, pending] = useActionState(updateStaffPreparationDraft, initial);
  const regionSearchRef = useRef<HTMLInputElement>(null);

  const [titleLine, setTitleLine] = useState(draft.titleLine || "");
  const [customerPhone, setCustomerPhone] = useState(draft.customerPhone || "");
  const [orderTime, setOrderTime] = useState(draft.orderTime || "فوري");
  const [rawListText, setRawListText] = useState(draft.rawListText || "");
  const [products, setProducts] = useState<ProductItem[]>(extractProductsArray(draft));
  const [selectedPreparerId, setSelectedPreparerId] = useState(draft.preparerId || "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPreparerId, setBulkPreparerId] = useState("");

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

  const productsCount = products.length;

  const addProduct = () => {
    const newId = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    setProducts(prev => [...prev, { id: newId, line: "", preparerId: null }]);
  };

  const updateProduct = (id: string, updates: Partial<ProductItem>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => p.id));
    }
  };

  const bulkDelete = () => {
    if (!confirm("هل أنت متأكد من حذف المنتجات المحددة؟")) return;
    setProducts(products.filter(p => !selectedIds.includes(p.id)));
    setSelectedIds([]);
  };

  const bulkAssign = (prepId: string) => {
    if (!prepId) return;
    setProducts(products.map(p =>
      selectedIds.includes(p.id) ? { ...p, preparerId: prepId } : p
    ));
    setBulkPreparerId("");
    setSelectedIds([]);
  };

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
          <span className="text-xs font-medium text-slate-800">المُجهّز (الموظف المكلّف)</span>
          <select
            name="preparerId"
            value={selectedPreparerId}
            onChange={(e) => setSelectedPreparerId(e.target.value)}
            className={inputClass}
            disabled={!canEdit}
          >
            <option value="">-- غير مسند (طلب عام للمسؤول) --</option>
            {preparers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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

        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-800">
              المنتجات * <span className="text-slate-500">({productsCount})</span>
            </span>
            <button
              type="button"
              onClick={addProduct}
              disabled={!canEdit}
              className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded hover:bg-sky-100 transition disabled:opacity-50"
            >
              + إضافة منتج
            </button>
          </div>
          
          <input type="hidden" name="productsJson" value={JSON.stringify(products)} />

          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
            {selectedIds.length > 0 && canEdit && (
              <div className="sticky top-0 z-10 bg-white p-3 rounded-xl border-2 border-indigo-100 shadow-sm flex flex-col gap-3 mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-900">التحكم بالمحدد ({selectedIds.length})</span>
                  <button
                    type="button"
                    onClick={bulkDelete}
                    className="text-[10px] font-black bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition"
                  >
                    حذف المحددة
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    className={`${inputClass} !py-1.5 flex-1 text-xs`}
                    value={bulkPreparerId}
                    onChange={(e) => bulkAssign(e.target.value)}
                  >
                    <option value="">تخصيص مجهز للمحدد...</option>
                    {preparers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {products.map((p, idx) => {
              const isSelected = selectedIds.includes(p.id);
              return (
                <div key={p.id} className={`flex flex-col gap-2 bg-white p-3 rounded-2xl border-2 transition-all ${isSelected ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-100'}`}>
                  {/* شريط الأدوات فوق المنتج */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-50 pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(p.id)}
                        disabled={!canEdit}
                        className="w-5 h-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-[10px] font-black text-slate-400"># {idx + 1}</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <select
                        value={p.preparerId || ""}
                        onChange={(e) => updateProduct(p.id, { preparerId: e.target.value || null })}
                        className="text-[10px] font-bold bg-sky-50 text-sky-800 border-none rounded-lg px-2 py-1 outline-none cursor-pointer"
                        disabled={!canEdit}
                      >
                        <option value="">(المجهز الافتراضي)</option>
                        {preparers.map((prep) => (
                          <option key={prep.id} value={prep.id}>
                            {prep.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => removeProduct(p.id)}
                        disabled={!canEdit}
                        className="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition disabled:opacity-50"
                        title="حذف المنتج"
                      >
                        <DynamicIcon icon={icons?.ui_delete || icons?.ui_error} className="w-4 h-4" fallback={<span>❌</span>} />
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={p.line}
                    onChange={(e) => updateProduct(p.id, { line: e.target.value })}
                    placeholder={`اكتب تفاصيل المنتج ${idx + 1}...`}
                    className={`${inputClass} !border-none !shadow-none !bg-transparent !px-1 font-bold text-sm`}
                    disabled={!canEdit}
                    required
                  />
                </div>
              );
            })}

            {products.length === 0 && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-3 rounded-xl border border-rose-200 text-center">لا توجد منتجات، يرجى إضافة منتج واحد على الأقل.</p>
            )}
          </div>
        </div>

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
