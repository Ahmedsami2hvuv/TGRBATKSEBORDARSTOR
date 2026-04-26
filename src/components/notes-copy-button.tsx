"use client";

import { useEffect, useState } from "react";

export function NotesCopyButton({
  text,
  className,
  buttonLabel = "نسخ",
}: {
  text: string;
  className?: string;
  buttonLabel?: string;
}) {
  const trimmed = text.trim();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <button
      type="button"
      disabled={!trimmed}
      onClick={() => {
        if (!trimmed) return;
        void navigator.clipboard?.writeText(trimmed).then(() => setCopied(true)).catch(() => {});
      }}
      className={
        className ??
        "shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      }
      title={trimmed ? "نسخ محتوى الملاحظات" : "لا توجد ملاحظات للنسخ"}
    >
      {copied ? "تم النسخ" : buttonLabel}
    </button>
  );
}

