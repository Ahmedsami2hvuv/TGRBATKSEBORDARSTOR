"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { useRouter } from "next/navigation";

const initial: UploadDoorPhotoState = {};

/** أزرار أنيقة مع أيقونات */
const btnCam = "inline-flex w-full items-center justify-center gap-1 rounded-lg border border-sky-400 bg-sky-50 py-1 text-[10px] font-black text-sky-900 shadow-sm transition hover:bg-sky-100 active:scale-95 disabled:opacity-60";
const btnGal = "inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white py-1 text-[10px] font-black text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-60";
const btnUndo = "inline-flex items-center justify-center gap-1 rounded-lg border border-amber-400 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-900 shadow-sm transition hover:bg-amber-100 active:scale-95 disabled:opacity-60";

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
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const router = useRouter();

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const busy = compressing || pending || revertPending;

  return (
    <div className="space-y-2">
      <form
        ref={formRef}
        action={formAction}
        encType="multipart/form-data"
        className="space-y-2"
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

        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const el = inputRef.current;
              if (!el) return;
              el.setAttribute("capture", "environment");
              el.click();
            }}
            className={btnCam}
          >
            <DynamicIcon iconKey="ui_camera" config={icons} fallback="📷" className="h-3.5 w-3.5" />
            كاميرا
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const el = inputRef.current;
              if (!el) return;
              el.removeAttribute("capture");
              el.click();
            }}
            className={btnGal}
          >
            <DynamicIcon iconKey="ui_gallery" config={icons} fallback="🖼️" className="h-3.5 w-3.5" />
            معرض
          </button>
        </div>
      </form>

      {/* نموذج الرجوع للأصل منفصل ومستقل لمنع تداخل النماذج في HTML */}
      <form action={revertFormAction} className="flex justify-center pt-0.5">
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
          className={btnUndo}
        >
          <DynamicIcon iconKey="ui_undo" config={icons} fallback="↩️" className="h-3.5 w-3.5" />
          الرجوع للأصل
        </button>
      </form>

      {(compressing || pending || revertPending) && (
        <div className="flex items-center justify-center gap-2 py-1 text-xs font-black text-sky-800">
          <span className="h-2 w-2 animate-ping rounded-full bg-sky-500"></span>
          {compressing ? "جارٍ تحسين الصورة..." : revertPending ? "جارٍ الرجوع..." : "جارٍ الرفع..."}
        </div>
      )}

      {(state.error || revertState.error) && (
        <p className="rounded-lg bg-rose-50 p-2 text-center text-xs font-bold text-rose-600" role="alert">
          {state.error || revertState.error}
        </p>
      )}
    </div>
  );
}
