"use client";

import { useEffect, useRef, useState } from "react";
import {
  assignFileToInput,
  compressImageForMandoubUpload,
} from "@/lib/client-image-compress";
import { uploadMandoubSecondCustomerDoorPhotoSubmit } from "./actions";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

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

  const handleCamClick = () => {
    camInputRef.current?.click();
  };

  const handleGalClick = () => {
    galInputRef.current?.click();
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
          id={`mandoub-quick-cam2-${orderId}`}
          ref={camInputRef}
          name="secondCustomerDoorPhoto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-[1px] h-[1px]"
          onChange={() => {
            void handleFile(camInputRef.current, camFormRef.current);
          }}
        />
        <label
          htmlFor={`mandoub-quick-cam2-${orderId}`}
          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900 shadow-sm hover:bg-emerald-100 ${
            compressing || uploading ? "opacity-60 pointer-events-none" : "cursor-pointer"
          }`}
        >
          <DynamicIcon iconKey="ui_camera" config={icons} fallback="📷" className="h-5 w-5 shrink-0" />
          كاميرا الزبون 2
        </label>
      </form>

      <form
        ref={galFormRef}
        action={uploadMandoubSecondCustomerDoorPhotoSubmit}
        encType="multipart/form-data"
        className="inline"
      >
        {hidden}
        <input
          id={`mandoub-quick-gal2-${orderId}`}
          ref={galInputRef}
          name="secondCustomerDoorPhoto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none w-[1px] h-[1px]"
          onChange={() => {
            void handleFile(galInputRef.current, galFormRef.current);
          }}
        />
        <label
          htmlFor={`mandoub-quick-gal2-${orderId}`}
          className={`inline-flex w-full items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 ${
            compressing || uploading ? "opacity-60 pointer-events-none" : "cursor-pointer"
          }`}
        >
          <DynamicIcon iconKey="ui_gallery" config={icons} fallback="🖼️" className="h-5 w-5 shrink-0" />
          معرض الزبون 2
        </label>
      </form>
      {compressing ? (
        <p className="col-span-2 text-right text-[11px] font-bold text-sky-800">جارٍ تصغير الصورة…</p>
      ) : uploading ? (
        <p className="col-span-2 text-right text-[11px] font-bold text-sky-800">جارٍ رفع الصورة…</p>
      ) : null}
    </div>
  );
}
