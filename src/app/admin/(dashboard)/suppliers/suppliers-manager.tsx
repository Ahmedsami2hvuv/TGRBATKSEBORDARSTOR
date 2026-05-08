"use client";

import { useActionState, useEffect, useState } from "react";
import { ad } from "@/lib/admin-ui";
import {
  createStoreSupplier,
  updateStoreSupplier,
  deleteStoreSupplier,
  renewSupplierPortalToken,
  assignProductsToSupplier,
  toggleSupplierChat,
  type SupplierFormState,
} from "./actions";
import { whatsappMeUrl } from "@/lib/whatsapp";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { SupplierChatToggle } from "./supplier-chat-toggle";

const initial: SupplierFormState = {};

export type SupplierManagerRow = {
  id: string;
  name: string;
  phone: string;
  profitMargin: number;
  active: boolean;
  chatDisabled: boolean;
  portalUrl: string;
  productIds: string[];
};

export type ProductOption = { id: string; name: string };

function AddSupplierForm({ icons }: { icons: GlobalIconsConfig | null }) {
  const [state, formAction, pending] = useActionState(createStoreSupplier, initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [margin, setMargin] = useState("0.25");

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setName("");
      setPhone("");
      setMargin("0.25");
    }
  }, [state?.ok]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${ad.btnPrimary} flex items-center gap-2`}>
        <DynamicIcon iconKey="ui_plus" config={icons} fallback="➕" className="w-4 h-4" /> إضافة مورد جديد
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className={ad.h2}>إضافة مورد بضاعة</h2>
        <button type="button" onClick={() => setOpen(false)} className={ad.btnDark}>إلغاء</button>
      </div>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className={ad.label}>اسم المورد *</span>
            <input name="name" required className={ad.input} value={name} onChange={e => setName(e.target.value)} placeholder="مثلاً: صاحب الخضروات" />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ad.label}>الهاتف</span>
            <input name="phone" className={ad.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="07..." />
          </label>
          <label className="flex flex-col gap-1">
            <span className={ad.label}>هامش الربح </span>
            <input name="profitMargin" type="number" step="0.05" className={ad.input} value={margin} onChange={e => setMargin(e.target.value)} />
          </label>
        </div>
        {state?.error && <p className={ad.error}>{state.error}</p>}
        <button type="submit" disabled={pending} className={ad.btnPrimary}>
          {pending ? "جارٍ الحفظ..." : "إضافة المورد"}
        </button>
      </form>
    </div>
  );
}

function SupplierCard({ row, allProducts, icons }: { row: SupplierManagerRow; allProducts: ProductOption[]; icons: GlobalIconsConfig | null }) {
  const [activeTab, setActiveTab] = useState<"products" | "edit" | null>(null);
  const [uState, updateAction, uPending] = useActionState(updateStoreSupplier, initial);
  const [pState, productsAction, pPending] = useActionState(assignProductsToSupplier, initial);
  const [dState, deleteAction, dPending] = useActionState(deleteStoreSupplier, initial);
  const [copied, setCopied] = useState(false);

  const linked = new Set(row.productIds);

  return (
    <div className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-xl font-black">
              {row.name[0]}
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">{row.name}</h3>
              <p className="text-sm font-bold text-slate-500">الربح: {row.profitMargin}  | {row.phone || "بدون هاتف"}</p>
            </div>
          </div>

          <div className="flex gap-2">
             <button onClick={() => setActiveTab(activeTab === "products" ? null : "products")} className="px-4 py-2 bg-sky-50 text-sky-700 rounded-xl text-xs font-black hover:bg-sky-100 transition flex items-center gap-1.5">
               <DynamicIcon iconKey="ui_tasks" config={icons} fallback="📦" className="w-3.5 h-3.5" /> المنتجات ({row.productIds.length})
             </button>
             <button onClick={() => setActiveTab(activeTab === "edit" ? null : "edit")} className="px-4 py-2 bg-slate-50 text-slate-700 rounded-xl text-xs font-black hover:bg-slate-100 transition flex items-center gap-1.5">
               <DynamicIcon iconKey="ui_settings" config={icons} fallback="⚙️" className="w-3.5 h-3.5" /> تعديل
             </button>
             <form action={deleteAction} onSubmit={e => !confirm("حذف المورد؟") && e.preventDefault()}>
                <input type="hidden" name="id" value={row.id} />
                <button type="submit" disabled={dPending} className="p-2 text-rose-400 hover:text-rose-600 transition">
                  <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-5 h-5" />
                </button>
             </form>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-50 flex flex-wrap items-center gap-3">
           <div>
             <SupplierChatToggle supplierId={row.id} initialDisabled={row.chatDisabled} icons={icons!} />
           </div>
           <a href={row.portalUrl} target="_blank" className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2">
             <DynamicIcon iconKey="ui_globe" config={icons} fallback="🌐" className="w-3.5 h-3.5 text-sky-400" /> فتح البوابة
           </a>
           <button
             onClick={() => {
                navigator.clipboard.writeText(row.portalUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
             }}
             className="bg-sky-600 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2"
           >
             <DynamicIcon iconKey="ui_copy" config={icons} fallback="📋" className="w-3.5 h-3.5" />
             {copied ? "تم النسخ!" : "نسخ الرابط"}
           </button>
           <a
             href={whatsappMeUrl(row.phone, `رابط بوابة التسعير الخاصة بك:\n${row.portalUrl}`)}
             target="_blank"
             className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2"
           >
             <DynamicIcon iconKey="ui_whatsapp" config={icons} fallback="💬" className="w-3.5 h-3.5" /> واتساب
           </a>
        </div>
      </div>

      {activeTab === "products" && (
        <div className="bg-slate-50 p-6 border-t border-slate-100">
           <h4 className="font-black text-slate-800 mb-4">اختيار منتجات المورد</h4>
           <form action={productsAction} className="space-y-4">
              <input type="hidden" name="supplierId" value={row.id} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2">
                 {allProducts.map(p => (
                   <label key={p.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer hover:border-sky-500 transition">
                      <input type="checkbox" name="productIds" value={p.id} defaultChecked={linked.has(p.id)} className="w-4 h-4 rounded" />
                      <span className="text-xs font-bold truncate">{p.name}</span>
                   </label>
                 ))}
              </div>
              <button type="submit" disabled={pPending} className={ad.btnPrimary + " w-full mt-4"}>
                {pPending ? "جارٍ الحفظ..." : "حفظ قائمة المنتجات"}
              </button>
           </form>
        </div>
      )}

      {activeTab === "edit" && (
        <div className="bg-slate-50 p-6 border-t border-slate-100">
          <form action={updateAction} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="hidden" name="id" value={row.id} />
            <label className="flex flex-col gap-1">
              <span className={ad.label}>الاسم</span>
              <input name="name" defaultValue={row.name} required className={ad.input} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={ad.label}>الهاتف</span>
              <input name="phone" defaultValue={row.phone} className={ad.input} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={ad.label}>هامش الربح</span>
              <input name="profitMargin" type="number" step="0.05" defaultValue={row.profitMargin} className={ad.input} />
            </label>
            <div className="md:col-span-3 flex items-center justify-between">
              <label className="flex items-center gap-2 font-black text-slate-700">
                <input type="checkbox" name="active" value="1" defaultChecked={row.active} className="w-5 h-5" />
                مورد نشط
              </label>
              <button type="submit" disabled={uPending} className={ad.btnDark}>
                {uPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function SuppliersManager({ rows, allProducts, icons }: { rows: SupplierManagerRow[]; allProducts: ProductOption[]; icons?: GlobalIconsConfig | null }) {
  return (
    <div className="space-y-8">
      <AddSupplierForm icons={icons ?? null} />
      <div className="grid grid-cols-1 gap-6">
        {rows.map(row => (
          <SupplierCard key={row.id} row={row} allProducts={allProducts} icons={icons ?? null} />
        ))}
        {rows.length === 0 && (
          <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold">
            لا يوجد موردون حالياً
          </div>
        )}
      </div>
    </div>
  );
}
