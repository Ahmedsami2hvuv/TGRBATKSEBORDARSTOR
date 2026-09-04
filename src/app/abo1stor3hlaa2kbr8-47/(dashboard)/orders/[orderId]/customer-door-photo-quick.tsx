"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
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
  isSecondCustomer = false,
}: {
  orderId: string;
  hasImage?: boolean;
  isSecondCustomer?: boolean;
}) {
  const router = useRouter();
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    uploadCustomerDoorPhotoFromView.bind(null, orderId),
    initial,
  );
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("هل أنت متأكد من مسح صورة باب الزبون؟")) return;
    setDeleting(true);
    try {
      await deleteCustomerDoorPhotoAction(orderId, isSecondCustomer);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleFileSelected(file: File | undefined, inputEl: HTMLInputElement | null) {
    if (!(file instanceof File) || file.size <= 0) return;

    let photoToUpload = file;
    try {
      photoToUpload = await compressImageForMandoubUpload(file);
      assignFileToInput(inputEl, photoToUpload);
    } catch (err) {
      console.error("خطأ في ضغط الصورة:", err);
    }

    const fd = new FormData();
    fd.set("customerDoorPhoto", photoToUpload);
    if (isSecondCustomer) {
      fd.set("target", "second");
    }
    await formAction(fd);

    if (inputEl) {
      inputEl.value = "";
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* مدخل الكاميرا المباشر */}
        <input
          ref={cameraFileRef}
          type="file"
          name="customerDoorPhotoCamera"
          accept="image/*"
          capture="environment"
          className="sr-only hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            void handleFileSelected(file, cameraFileRef.current);
          }}
        />
        {/* مدخل المعرض المباشر */}
        <input
          ref={galleryFileRef}
          type="file"
          name="customerDoorPhotoGallery"
          accept="image/*"
          className="sr-only hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            void handleFileSelected(file, galleryFileRef.current);
          }}
        />

        <button
          type="button"
          disabled={pending || deleting}
          className="rounded-lg border border-sky-400 bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-200 disabled:opacity-60 cursor-pointer active:scale-95"
          onClick={() => {
            cameraFileRef.current?.click();
          }}
        >
          {pending ? "جارٍ الرفع..." : "كاميرا"}
        </button>
        <button
          type="button"
          disabled={pending || deleting}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60 cursor-pointer active:scale-95"
          onClick={() => {
            galleryFileRef.current?.click();
          }}
        >
          {pending ? "جارٍ الرفع..." : "معرض"}
        </button>
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
