"use client";

import { useEffect, useState } from "react";
import { MANDOUB_ORDER_EDIT_TOGGLE } from "@/app/mandoub/mandoub-order-detail-actions";
import { PREPARER_ORDER_EDIT_PANEL_EVT } from "@/lib/preparer-edit-panel-events";
import { PreparerOrderEditForm } from "./preparer-order-edit-form";

export function PreparerOrderEditPanel({
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener(MANDOUB_ORDER_EDIT_TOGGLE, onToggle);
    return () => window.removeEventListener(MANDOUB_ORDER_EDIT_TOGGLE, onToggle);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(PREPARER_ORDER_EDIT_PANEL_EVT, { detail: { open } }));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById("preparer-order-edit")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  return (
    <div
      id="preparer-order-edit"
      className="scroll-mt-20 mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
        <p className="text-lg font-bold text-emerald-900">تعديل الطلب</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-bold text-slate-600 underline decoration-slate-400 underline-offset-2 hover:text-slate-900"
        >
          إخفاء
        </button>
      </div>

      <PreparerOrderEditForm auth={auth} orderId={orderId} defaults={defaults} />
    </div>
  );
}

