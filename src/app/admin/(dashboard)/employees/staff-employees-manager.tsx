"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useEffect } from "react";
import { ad } from "@/lib/admin-ui";
import { buildStaffEmployeeShareMessage, whatsappAppUrl } from "@/lib/whatsapp";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import {
  createStaffEmployee,
  deleteStaffEmployee,
  renewStaffEmployeePortalToken,
  toggleStaffEmployeeActive,
  type StaffEmployeeActionState,
} from "./actions";

type Row = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  canSubmitOrders: boolean;
  canViewArchived: boolean;
  canManageStore: boolean;
  createdAt: Date;
  portalUrl: string;
};

const initial: StaffEmployeeActionState = {};

export function StaffEmployeesManager({ initialEmployees, icons }: { initialEmployees: Row[], icons: GlobalIconsConfig | null }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return initialEmployees;
    return initialEmployees.filter(
      (e) => e.name.toLowerCase().includes(t) || (e.phone || "").toLowerCase().includes(t),
    );
  }, [q, initialEmployees]);

  const [createState, createAction, createPending] = useActionState(createStaffEmployee, initial);
  const [toggleState, toggleAction, togglePending] = useActionState(toggleStaffEmployeeActive, initial);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteStaffEmployee, initial);
  const [renewState, renewAction, renewPending] = useActionState(renewStaffEmployeePortalToken, initial);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className={`${ad.btnPrimary} flex items-center gap-2`}>
            <DynamicIcon iconKey="ui_plus" config={icons} fallback="➕" className="w-4 h-4" />
            إنشاء موظف جديد
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {open ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className={ad.h2}>إنشاء موظف</h2>
              <button type="button" onClick={() => setOpen(false)} className={ad.btnDark}>إلغاء</button>
            </div>
            <form action={createAction} className="space-y-3">
              <label className="block">
                <span className={ad.label}>الاسم *</span>
                <input name="name" required className={ad.input} placeholder="مثال: أحمد" />
              </label>
              <label className="block">
                <span className={ad.label}>الهاتف (اختياري)</span>
                <input name="phone" className={ad.input} placeholder="07..." />
              </label>

              <div className="space-y-2 p-3 bg-white rounded-lg border border-sky-100">
                <p className="text-xs font-bold text-sky-700 mb-2">الصلاحيات:</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="canSubmitOrders" defaultChecked className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500" />
                  <span className="text-sm font-medium">رفع طلبات تجهيز</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="canViewArchived" className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500" />
                  <span className="text-sm font-medium">فتح الطلبات المؤرشفة</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="canManageStore" className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500" />
                  <span className="text-sm font-medium">إدارة المتجر (إضافة وتعديل)</span>
                </label>
              </div>

              {createState.error ? <p className="text-sm font-bold text-rose-700">{createState.error}</p> : null}
              {createState.ok ? <p className="text-sm font-bold text-emerald-700">تم إنشاء الموظف بنجاح.</p> : null}
              <button type="submit" disabled={createPending} className={`${ad.btnPrimary} w-full`}>
                {createPending ? "جارٍ الإنشاء..." : "حفظ الموظف"}
              </button>
            </form>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className={ad.h2}>بحث</h2>
          <label className="mt-3 block">
            <span className={ad.label}>ابحث بالاسم أو الهاتف</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} className={ad.input} placeholder="..." />
          </label>
          <p className="mt-2 text-sm text-slate-600">
            العدد: <strong className="tabular-nums text-slate-900">{filtered.length}</strong>
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className={ad.h2}>القائمة</h2>
        {filtered.length === 0 ? (
          <p className={`mt-3 ${ad.muted}`}>لا يوجد موظفون حالياً.</p>
        ) : (
          <ul className={`${ad.listDivide} mt-3`}>
            {filtered.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className={ad.listTitle}>
                    {e.name}{" "}
                    {!e.active ? (
                      <span className="ms-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-black text-rose-800">
                        موقوف
                      </span>
                    ) : null}
                  </p>
                  <p className={`${ad.listMuted} tabular-nums`}>{e.phone || "—"}</p>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {e.canSubmitOrders && (
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100">
                        رفع طلبات
                      </span>
                    )}
                    {e.canViewArchived && (
                      <span className="bg-sky-50 text-sky-700 text-[10px] font-bold px-2 py-0.5 rounded border border-sky-100">
                        فتح المؤرشف
                      </span>
                    )}
                    {e.canManageStore && (
                      <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-100">
                        إدارة المتجر
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={e.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 transition hover:bg-sky-100"
                    >
                      <DynamicIcon iconKey="ui_external_link" config={icons} fallback="↗" className="w-4 h-4" />
                      فتح رابط الموظف
                    </a>
                    <a
                      href={whatsappAppUrl(
                        e.phone,
                        buildStaffEmployeeShareMessage({
                          staffEmployeeName: e.name,
                          staffPortalUrl: e.portalUrl,
                        }),
                      )}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-400 to-emerald-500 px-3 py-1.5 text-xs font-black text-slate-900 shadow-md ring-1 ring-emerald-300/50 transition hover:from-emerald-300 hover:to-emerald-400"
                      title="واتساب: إرسال رابط الموظف"
                    >
                      <DynamicIcon iconKey="ui_whatsapp" config={icons} fallback="💬" className="w-4 h-4" />
                      إرسال عبر واتساب
                    </a>
                    <Link
                      href={`/admin/employees/${e.id}/edit`}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
                    >
                      <DynamicIcon iconKey="ui_edit" config={icons} fallback="✏️" className="w-3.5 h-3.5" />
                      تعديل الموظف
                    </Link>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={renewAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      type="submit"
                      disabled={renewPending}
                      className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-900 hover:bg-violet-100 disabled:opacity-60"
                      title="تجديد الرابط: إبطال كل الروابط السابقة لهذا الموظف"
                    >
                      <DynamicIcon iconKey="ui_refresh" config={icons} fallback="🔄" className="w-3.5 h-3.5" />
                      تجديد رابط الموظف
                    </button>
                  </form>
                  <form action={toggleAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="active" value={String(!e.active)} />
                    <button
                      type="submit"
                      disabled={togglePending}
                      className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                    >
                      {e.active ? "إيقاف" : "تفعيل"}
                    </button>
                  </form>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <button
                      type="submit"
                      disabled={deletePending}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-900 hover:bg-rose-100 disabled:opacity-60"
                    >
                      <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-3.5 h-3.5" />
                      حذف
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {toggleState.error || deleteState.error || renewState.error ? (
          <p className="mt-3 text-sm font-bold text-rose-700">
            {toggleState.error || deleteState.error || renewState.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
