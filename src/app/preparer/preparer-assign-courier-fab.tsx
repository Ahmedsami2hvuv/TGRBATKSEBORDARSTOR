"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PREPARER_ORDER_EDIT_PANEL_EVT } from "@/lib/preparer-edit-panel-events";
import {
  assignOrderByPreparer,
  type PreparerActionState,
} from "./actions";

const assignInitial: PreparerActionState = {};

export function PreparerAssignCourierFab({
  auth,
  orderId,
  couriers,
  defaultCourierId,
}: {
  auth: { p: string; exp: string; s: string };
  orderId: string;
  couriers: { id: string; name: string }[];
  defaultCourierId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    assignOrderByPreparer,
    assignInitial,
  );
  const prevPending = useRef(false);
  const [editPanelOpen, setEditPanelOpen] = useState(false);

  useEffect(() => {
    const onEvt = (e: Event) => {
      const d = (e as CustomEvent<{ open?: boolean }>).detail;
      const next = Boolean(d?.open);
      setEditPanelOpen(next);
      if (next) setOpen(false);
    };
    window.addEventListener(PREPARER_ORDER_EDIT_PANEL_EVT, onEvt);
    return () => window.removeEventListener(PREPARER_ORDER_EDIT_PANEL_EVT, onEvt);
  }, []);

  // عند الوصول مع hash الخاص بالإسناد، افتح نافذة الإسناد مباشرة.
  useEffect(() => {
    const openIfHash = () => {
      if (window.location.hash === "#preparer-assign") setOpen(true);
    };
    openIfHash();
    window.addEventListener("hashchange", openIfHash);
    return () => window.removeEventListener("hashchange", openIfHash);
  }, []);

  useEffect(() => {
    if (prevPending.current && !pending && state.ok) {
      setOpen(false);
      router.refresh();
    }
    prevPending.current = pending;
  }, [pending, state.ok, router]);

  return (
    <>
      <div
        id="preparer-assign"
        className={`pointer-events-none fixed bottom-20 left-1/2 z-[100] flex w-full max-w-lg -translate-x-1/2 justify-center px-3 sm:bottom-24 ${editPanelOpen ? "hidden" : ""}`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="pointer-events-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-emerald-600 text-2xl font-black text-white shadow-xl ring-2 ring-emerald-300/80 transition hover:bg-emerald-700 hover:ring-emerald-400"
          title="إسناد أو تحويل لمندوب"
          aria-expanded={open}
        >
          🚚
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="إسناد المندوب"
        >
          <div className="kse-glass-dark w-full max-w-md rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-lg font-black text-emerald-950">إسناد / تحويل لمندوب</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                إغلاق
              </button>
            </div>
            <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="p" value={auth.p} />
              <input type="hidden" name="exp" value={auth.exp} />
              <input type="hidden" name="s" value={auth.s} />
              <input type="hidden" name="orderId" value={orderId} />
              {state.error ? (
                <p className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
                  {state.error}
                </p>
              ) : null}
              <label className="min-w-0 flex-1 text-sm font-bold text-slate-700">
                المندوب
                <select
                  name="courierId"
                  required
                  defaultValue={defaultCourierId ?? ""}
                  disabled={pending}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 disabled:opacity-60"
                >
                  <option value="" disabled>
                    — اختر —
                  </option>
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {pending ? "جاري التطبيق…" : "تطبيق ✓"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
