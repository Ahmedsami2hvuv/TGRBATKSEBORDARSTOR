"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import {
  compressImageForMandoubUpload,
  assignFileToInput,
} from "@/lib/client-image-compress";
import {
  uploadCustomerDoorPhotoFromView,
  deleteCustomerDoorPhotoAction,
  type CustomerDoorPhotoState,
} from "./customer-door-photo-actions";

const initial: CustomerDoorPhotoState = {};

export function CustomerDoorPhotoQuick({
  orderId,
  hasImage,
}: {
  orderId: string;
  hasImage?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    uploadCustomerDoorPhotoFromView.bind(null, orderId),
    initial,
  );
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("هل أنت متأكد من مسح صورة باب الزبون؟")) return;
    setDeleting(true);
    try {
      await deleteCustomerDoorPhotoAction(orderId);
    } finally {
      setDeleting(false);
    }
  }

  async function handleFileInputChange() {
    const file = fileRef.current?.files?.[0];
    if (!(file instanceof File) || file.size <= 0) return;

    let photoToUpload = file;
    try {
      photoToUpload = await compressImageForMandoubUpload(file);
      assignFileToInput(fileRef.current, photoToUpload);
    } catch (err) {
      console.error("خطأ في ضغط الصورة:", err);
      // متابعة برفع الصورة الأصلية إن فشل الضغط
    }

    const fd = new FormData();
    fd.set("customerDoorPhoto", photoToUpload);
    await formAction(fd);

    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          name="customerDoorPhoto"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={() => {
            void handleFileInputChange();
          }}
        />
        <button
          type="button"
          disabled={pending || deleting}
          className="rounded-lg border border-sky-400 bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-200 disabled:opacity-60"
          onClick={() => {
            const el = fileRef.current;
            if (!el) return;
            el.setAttribute("capture", "environment");
            el.click();
          }}
        >
          {pending ? "جارٍ الرفع..." : "كاميرا"}
        </button>
        <button
          type="button"
          disabled={pending || deleting}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          onClick={() => {
            const el = fileRef.current;
            if (!el) return;
            el.removeAttribute("capture");
            el.click();
          }}
        >
          {pending ? "جارٍ الرفع..." : "معرض"}
        </button>
        {hasImage && (
          <button
            type="button"
            disabled={pending || deleting}
            onClick={handleDelete}
            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          >
            {deleting ? "جارٍ المسح..." : "مسح الصورة"}
          </button>
        )}
      </div>
      {pending ? (
        <p className="text-xs font-bold text-sky-800">جارٍ رفع الصورة…</p>
      ) : state.error ? (
        <p className="text-xs font-medium text-rose-600">{state.error}</p>
      ) : state.ok ? (
        <p className="text-xs font-medium text-emerald-700">تم تحديث صورة الباب</p>
      ) : null}
    </div>
  );
}
