"use client";

import { useEffect, useState } from "react";
import { normalizeOrderSummaryText } from "@/lib/preparation-invoice";

export function ClickableNotesCard({
  text,
  className,
  children,
  showTitleNotice = true,
}: {
  text: string;
  className?: string;
  children?: React.ReactNode;
  showTitleNotice?: boolean;
}) {
  const formatted = normalizeOrderSummaryText(text).trim();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  if (!formatted) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      title="انقر في أي مكان لنسخ الفاتورة"
      onClick={(e) => {
        e.stopPropagation();
        if (!formatted) return;
        void navigator.clipboard?.writeText(formatted).then(() => setCopied(true)).catch(() => {});
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          void navigator.clipboard?.writeText(formatted).then(() => setCopied(true)).catch(() => {});
        }
      }}
      className={
        className ??
        `group relative cursor-pointer select-none rounded-2xl border-2 transition-all active:scale-[0.99] ${
          copied
            ? "border-emerald-500 bg-emerald-50/80 text-emerald-950 shadow-md ring-2 ring-emerald-400/30"
            : "border-amber-200 bg-amber-50/40 text-slate-800 hover:border-amber-400 hover:bg-amber-100/50 shadow-sm hover:shadow-md"
        }`
      }
    >
      {/* شريط الإشعار أو التلميح السريع عند النسخ */}
      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 transition-all">
        {copied ? (
          <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white shadow-md animate-in fade-in zoom-in duration-200">
            ✓ تم نسخ الفاتورة 📋
          </span>
        ) : (
          showTitleNotice && (
            <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 opacity-70 group-hover:opacity-100 transition-opacity">
              👆 انقر في أي مكان للنسخ
            </span>
          )
        )}
      </div>

      {children ? (
        children
      ) : (
        <div className="whitespace-pre-wrap p-4 pt-9 text-sm font-bold leading-relaxed">
          {formatted}
        </div>
      )}
    </div>
  );
}
