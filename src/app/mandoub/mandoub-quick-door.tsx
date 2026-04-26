"use client";

import { useRef, useState } from "react";
import {
  assignFileToInput,
  compressImageForMandoubUpload,
} from "@/lib/client-image-compress";
import { uploadMandoubCustomerDoorPhotoSubmit } from "./actions";

export function MandoubQuickDoorCapture({
  orderId,
  nextUrl,
  auth,
}: {
  orderId: string;
  nextUrl: string;
  auth: { c: string; exp: string; s: string };
}) {
  const camFormRef = useRef<HTMLFormElement>(null);
  const galFormRef = useRef<HTMLFormElement>(null);
  const camInputRef = useRef<HTMLInputElement>(null);
  const galInputRef = useRef<HTMLInputElement>(null);

  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const hidden = (
    <>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="next" value={nextUrl} />
      <input type="hidden" name="c" value={auth.c} />
      <input type="hidden" name="exp" value={auth.exp} />
      <input type="hidden" name="s" value={auth.s} />
    </>
  );

  async function handleFile(
    input: HTMLInputElement | null,
    form: HTMLFormElement | null,
  ) {
    if (!input?.files?.length || !form) return;
    const raw = input.files[0];
    setUploading(false);
    setCompressing(true);
    try {
      const out = await compressImageForMandoubUpload(raw);
      assignFileToInput(input, out);
    } catch {
      /* الملف الأصلي */
    } finally {
      setCompressing(false);
    }
    setUploading(true);
    form.requestSubmit();
  }

  return (
    <div className="grid grid-cols-2 items-center gap-2">
      <form
        ref={camFormRef}
        action={uploadMandoubCustomerDoorPhotoSubmit}
        encType="multipart/form-data"
        className="inline"
      >
        {hidden}
        <input
          ref={camInputRef}
          name="customerDoorPhoto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={() => {
            void handleFile(camInputRef.current, camFormRef.current);
          }}
        />
        <button
          type="button"
          onClick={() => camInputRef.current?.click()}
          disabled={compressing}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-400 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900 shadow-sm hover:bg-sky-100 disabled:opacity-60"
        >
          <svg
            className="h-5 w-5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          كاميرا
        </button>
      </form>

      <form
        ref={galFormRef}
        action={uploadMandoubCustomerDoorPhotoSubmit}
        encType="multipart/form-data"
        className="inline"
      >
        {hidden}
        <input
          ref={galInputRef}
          name="customerDoorPhoto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={() => {
            void handleFile(galInputRef.current, galFormRef.current);
          }}
        />
        <button
          type="button"
          onClick={() => galInputRef.current?.click()}
          disabled={compressing}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
          معرض
        </button>
      </form>
      {compressing ? (
        <p className="col-span-2 w-full text-right text-[11px] font-bold text-sky-800">
          جارٍ تصغير الصورة…
        </p>
      ) : uploading ? (
        <p className="col-span-2 w-full text-right text-[11px] font-bold text-sky-800">
          جارٍ رفع الصورة…
        </p>
      ) : null}
    </div>
  );
}
