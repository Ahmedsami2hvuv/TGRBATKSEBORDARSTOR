"use client";

import { useRef, useState } from "react";
import {
  assignFileToInput,
  compressImageForMandoubUpload,
} from "@/lib/client-image-compress";
import { uploadMandoubSecondCustomerDoorPhotoSubmit } from "./actions";

export function MandoubQuickDoorSecondCapture({
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

  const handleCamClick = () => {
    if (window.confirm("تنبيه: هل تريد التقاط صورة (ثانية) لباب الزبون؟")) {
      camInputRef.current?.click();
    }
  };

  const handleGalClick = () => {
    if (window.confirm("هل تريد اختيار صورة (ثانية) لباب الزبون من المعرض؟")) {
      galInputRef.current?.click();
    }
  };

  return (
    <div className="grid grid-cols-2 items-center gap-2">
      <form
        ref={camFormRef}
        action={uploadMandoubSecondCustomerDoorPhotoSubmit}
        encType="multipart/form-data"
        className="inline"
      >
        {hidden}
        <input
          ref={camInputRef}
          name="secondCustomerDoorPhoto"
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
          onClick={handleCamClick}
          disabled={compressing}
          className="inline-flex w-full items-center justify-center rounded-xl border-2 border-emerald-400 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900 shadow-sm hover:bg-emerald-100 disabled:opacity-60"
        >
          كاميرا الزبون 2
        </button>
      </form>

      <form
        ref={galFormRef}
        action={uploadMandoubSecondCustomerDoorPhotoSubmit}
        encType="multipart/form-data"
        className="inline"
      >
        {hidden}
        <input
          ref={galInputRef}
          name="secondCustomerDoorPhoto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={() => {
            void handleFile(galInputRef.current, galFormRef.current);
          }}
        />
        <button
          type="button"
          onClick={handleGalClick}
          disabled={compressing}
          className="inline-flex w-full items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          معرض الزبون 2
        </button>
      </form>
      {compressing ? (
        <p className="col-span-2 text-right text-[11px] font-bold text-sky-800">جارٍ تصغير الصورة…</p>
      ) : uploading ? (
        <p className="col-span-2 text-right text-[11px] font-bold text-sky-800">جارٍ رفع الصورة…</p>
      ) : null}
    </div>
  );
}
