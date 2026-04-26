"use client";

import { useActionState, useRef, useState } from "react";
import {
  assignFileToInput,
  compressImageForMandoubUpload,
} from "@/lib/client-image-compress";
import {
  uploadShopDoorPhoto,
  revertShopDoorPhotoToOriginal,
  type UploadDoorPhotoState,
  type RevertShopDoorPhotoState,
} from "./actions";

const initial: UploadDoorPhotoState = {};

/** أزرار أنيقة مع أيقونات */
const btnCam = "inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-sky-400 bg-sky-50 px-3 py-3 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100 active:scale-95 disabled:opacity-60";
const btnGal = "inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-60";

export function MandoubDoorPhotoForm({
  orderId,
  nextUrl,
  c,
  exp,
  s,
}: {
  orderId: string;
  nextUrl: string;
  c: string;
  exp: string;
  s: string;
}) {
  const [state, formAction, pending] = useActionState(uploadShopDoorPhoto, initial);
  const [revertState, revertFormAction, revertPending] = useActionState(revertShopDoorPhotoToOriginal, {});
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const busy = compressing || pending || revertPending;

  return (
    <form
      ref={formRef}
      action={formAction}
      encType="multipart/form-data"
      className="space-y-3"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="next" value={nextUrl} />
      <input type="hidden" name="c" value={c} />
      <input type="hidden" name="exp" value={exp} />
      <input type="hidden" name="s" value={s} />

      <input
        ref={inputRef}
        name="doorPhoto"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={async () => {
          const input = inputRef.current;
          const form = formRef.current;
          if (!input?.files?.length || !form) return;
          const raw = input.files[0];
          setCompressing(true);
          try {
            const out = await compressImageForMandoubUpload(raw);
            assignFileToInput(input, out);
          } catch {
            /* يبقى الملف الأصلي */
          } finally {
            setCompressing(false);
          }
          form.requestSubmit();
        }}
      />

      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm("هل تريد التقاط صورة لباب المحل حقاً؟")) {
              const el = inputRef.current;
              if (!el) return;
              el.setAttribute("capture", "environment");
              el.click();
            }
          }}
          className={btnCam}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          كاميرا
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm("هل تريد تحديث صورة باب المحل حقاً؟")) {
              const el = inputRef.current;
              if (!el) return;
              el.removeAttribute("capture");
              el.click();
            }
          }}
          className={btnGal}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          معرض
        </button>
      </div>

      <form action={revertFormAction} className="flex justify-center">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="next" value={nextUrl} />
        <input type="hidden" name="c" value={c} />
        <input type="hidden" name="exp" value={exp} />
        <input type="hidden" name="s" value={s} />
        <button
          type="submit"
          disabled={busy}
          onClick={(e) => {
            if (!window.confirm("هل تريد الرجوع إلى الصورة الأصلية؟")) {
              e.preventDefault();
            }
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-3 text-sm font-bold text-amber-900 shadow-sm transition hover:bg-amber-100 active:scale-95 disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          الرجوع للأصل
        </button>
      </form>

      {(compressing || pending || revertPending) && (
        <div className="flex items-center justify-center gap-2 py-1 text-xs font-black text-sky-800">
          <span className="h-2 w-2 animate-ping rounded-full bg-sky-500"></span>
          {compressing ? "جارٍ تحسين الصورة..." : revertPending ? "جارٍ الرجوع..." : "جارٍ الرفع..."}
        </div>
      )}

      {state.error || revertState.error ? (
        <p className="rounded-lg bg-rose-50 p-2 text-center text-xs font-bold text-rose-600" role="alert">
          {state.error || revertState.error}
        </p>
      ) : null}
    </form>
  );
}
