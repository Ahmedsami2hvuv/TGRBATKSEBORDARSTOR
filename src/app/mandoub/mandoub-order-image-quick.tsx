"use client";

import { useEffect, useRef, useState } from "react";
import {
  assignFileToInput,
  compressImageForMandoubUpload,
} from "@/lib/client-image-compress";
import { uploadMandoubOrderImageSubmit } from "./actions";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { deletePendingAction, getPendingActions, savePendingAction, type PendingWalletAction } from "@/lib/mandoub-offline-db";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

/** نفس أزرار كاميرا/معرض `MandoubQuickDoorCapture` — حرفياً لتطابق الشكل والقياس */
const btnCam =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-400 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900 shadow-sm hover:bg-sky-100 disabled:opacity-60";
const btnGal =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60";

export function MandoubOrderImageQuick({
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
  const router = useRouter();

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  const syncNow = async () => {
    const pendingActions = await getPendingActions();
    const myPending = pendingActions.filter(a => a.formData.orderId === orderId && a.actionType === 'upload_order_image');
    if (myPending.length === 0) return;

    for (const action of myPending) {
      try {
        const formData = new FormData();
        Object.entries(action.formData).forEach(([k, v]) => formData.append(k, v));
        if (action.fileData) {
          const file = new File([action.fileData.blob], action.fileData.name, { type: action.fileData.type });
          formData.append('orderImage', file);
        }
        await uploadMandoubOrderImageSubmit(formData);
        await deletePendingAction(action.id);
      } catch (e) {
        console.error("Sync failed for order image", e);
      }
    }
    router.refresh();
  };

  useEffect(() => {
    const handleOnline = () => syncNow();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const handleOfflineUpload = async (file: File) => {
    const id = `local-order-img-${Date.now()}`;
    const newAction: PendingWalletAction = {
      id,
      actionType: 'upload_order_image',
      formData: {
        orderId,
        next: nextUrl,
        c: auth.c,
        exp: auth.exp,
        s: auth.s,
      },
      fileData: {
        name: file.name,
        type: file.type,
        blob: file,
      },
      timestamp: Date.now(),
      retryCount: 0,
    };

    await savePendingAction(newAction);
    toast.info("تم حفظ صورة الطلب محلياً.. سيتم رفعها فور توفر الإنترنت");
  };

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

      if (!navigator.onLine) {
        await handleOfflineUpload(out);
        setCompressing(false);
        return;
      }
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
        action={uploadMandoubOrderImageSubmit}
        encType="multipart/form-data"
        className="inline min-w-0"
      >
        {hidden}
        <input
          ref={camInputRef}
          name="orderImage"
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
          className={btnCam}
        >
          <DynamicIcon iconKey="ui_camera" config={icons} fallback="📷" className="h-5 w-5 shrink-0" />
          كاميرا
        </button>
      </form>

      <form
        ref={galFormRef}
        action={uploadMandoubOrderImageSubmit}
        encType="multipart/form-data"
        className="inline min-w-0"
      >
        {hidden}
        <input
          ref={galInputRef}
          name="orderImage"
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
          className={btnGal}
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
