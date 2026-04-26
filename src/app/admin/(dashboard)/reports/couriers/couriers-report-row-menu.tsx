"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { whatsappAppUrl } from "@/lib/whatsapp";

type Props = {
  courierId: string;
  courierName: string;
  courierPhone: string;
  delegatePortalUrl: string;
  shareMessage: string;
};

export function CouriersReportRowMenu({
  courierId,
  courierName,
  courierPhone,
  delegatePortalUrl,
  shareMessage,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const waHref = whatsappAppUrl(courierPhone, shareMessage);

  return (
    <div ref={wrapRef} className="relative inline-block text-right">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex min-h-[2.25rem] items-center justify-center rounded-lg border border-sky-400 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900 transition hover:bg-sky-100`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`خيارات ${courierName}`}
      >
        خيارات
      </button>
      {open ? (
        <div
          className="absolute left-0 z-20 mt-1 min-w-[14rem] rounded-xl border border-sky-200 bg-white py-1 shadow-lg"
          role="menu"
          dir="rtl"
        >
          <Link
            href={`/admin/couriers/${courierId}/edit`}
            className="block px-3 py-2 text-sm font-bold text-slate-800 hover:bg-sky-50"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            تعديل المندوب
          </Link>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-50"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            إرسال رابط اللوحة (واتساب)
          </a>
          <a
            href={delegatePortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2 text-sm font-bold text-sky-900 hover:bg-sky-50"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            معاينة لوحة المندوب
          </a>
        </div>
      ) : null}
    </div>
  );
}
