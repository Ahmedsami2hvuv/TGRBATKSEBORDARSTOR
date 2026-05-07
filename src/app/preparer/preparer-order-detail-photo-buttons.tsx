"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import {
  uploadPreparerPortalOrderImage,
  uploadPreparerPortalShopDoorPhoto,
} from "./actions";

const ACCEPT = "image/jpeg,image/png,image/webp";

type Auth = { p: string; exp: string; s: string };

export function PreparerDetailPhotoUploadRow({
  auth,
  orderId,
  field,
}: {
  auth: Auth;
  orderId: string;
  field: "orderImage" | "shopDoorPhoto";
}) {
  const router = useRouter();
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      let toSend = file;
      try {
        toSend = await compressImageFileForUpload(file);
      } catch {
        /* الملف الأصلي */
      }
      const fd = new FormData();
      fd.set("p", auth.p);
      fd.set("exp", auth.exp);
      fd.set("s", auth.s);
      fd.set("orderId", orderId);
      if (field === "orderImage") fd.set("orderImage", toSend);
      else fd.set("shopDoorPhoto", toSend);

      const res =
        field === "orderImage"
          ? await uploadPreparerPortalOrderImage({}, fd)
          : await uploadPreparerPortalShopDoorPhoto({}, fd);

      if (res?.error) setError(res.error);
      else router.refresh();
    } finally {
      setBusy(false);
      if (camRef.current) camRef.current.value = "";
      if (galRef.current) galRef.current.value = "";
    }
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await submitFile(f);
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
        كاميرا أو معرض لرفع {field === "orderImage" ? "صورة الطلبية" : "صورة باب المحل"}
      </p>
      <input
        ref={camRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={busy}
        onChange={onPick}
      />
      <input
        ref={galRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={busy}
        onChange={onPick}
      />
      <div className="flex flex-wrap items-stretch gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => camRef.current?.click()}
          aria-label="التقاط صورة بالكاميرا"
          className="inline-flex min-h-[44px] min-w-[8rem] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-sky-400 bg-sky-50 px-3 py-2.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100 disabled:opacity-50 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-900/50"
        >
          <span className="text-lg" aria-hidden>
            📷
          </span>
          كاميرا
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => galRef.current?.click()}
          aria-label="اختيار صورة من المعرض"
          className="inline-flex min-h-[44px] min-w-[8rem] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-sky-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <span className="text-lg" aria-hidden>
            🖼
          </span>
          المعرض
        </button>
      </div>
      {busy ? <p className="text-center text-xs font-bold text-sky-700 dark:text-sky-300">جارٍ الرفع…</p> : null}
      {error ? <p className="text-center text-sm font-bold text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  );
}
