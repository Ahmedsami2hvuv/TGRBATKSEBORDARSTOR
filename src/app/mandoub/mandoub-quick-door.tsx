"use client";

import { useEffect, useRef, useState } from "react";
import {
  assignFileToInput,
  compressImageForMandoubUpload,
} from "@/lib/client-image-compress";
import { uploadMandoubCustomerDoorPhotoSubmit } from "./actions";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

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
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

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
          <DynamicIcon iconKey="ui_camera" config={icons} fallback="📷" className="h-5 w-5 shrink-0" />
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
          <DynamicIcon iconKey="ui_gallery" config={icons} fallback="🖼️" className="h-5 w-5 shrink-0" />
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
