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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-[22px] border-[2px] border-[#C9A86A] bg-[#FFFEF8] p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_1px_0_white,0_0_0_1px_#E8D5A3_inset] text-right animate-in zoom-in-95 duration-200 relative overflow-hidden my-auto max-h-[92vh] flex flex-col select-none"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* معينات الزوايا المذهبة الملكية */}
        <div className="absolute top-[8px] right-[8px] w-[6px] h-[6px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] pointer-events-none" />
        <div className="absolute top-[8px] left-[8px] w-[6px] h-[6px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] pointer-events-none" />
        <div className="absolute bottom-[8px] right-[8px] w-[6px] h-[6px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] pointer-events-none" />
        <div className="absolute bottom-[8px] left-[8px] w-[6px] h-[6px] rotate-45 bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] pointer-events-none" />

        {/* ترويسة المودال */}
        <div className="flex items-center justify-between border-b-[1.5px] border-[#E8D5A3] pb-3 mb-3 bg-gradient-to-r from-[#FFFEF8] to-[#FDF6E3] -mx-4 -mt-4 p-3.5 sm:-mx-5 sm:-mt-5 sm:p-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-b from-[#F1D99A] via-[#E8C77E] to-[#C9A86A] flex items-center justify-center shadow-sm border border-[#9C7D46]/30">
              <svg className="w-[14px] h-[14px] text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <h3 className="text-sm sm:text-base font-black text-[#0A3D2E] leading-none">تعديل الطلب</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-full bg-white border border-[#C9A86A]/40 text-slate-700 hover:text-[#0A3D2E] hover:bg-[#FDF6E3] font-bold flex items-center justify-center cursor-pointer text-xs shadow-xs transition"
            title="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto pr-0.5 max-h-[calc(92vh-135px)]">
          <PreparerOrderEditForm auth={auth} orderId={orderId} defaults={defaults} />
        </div>
      </div>
    </div>
  );
}
