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
          className="group relative transition-transform active:scale-90 flex items-center justify-center p-0 border-0 bg-transparent cursor-pointer disabled:opacity-60"
          onClick={() => {
            cameraFileRef.current?.click();
          }}
          title="التقاط صورة بالكاميرا"
        >
          <img
            src="/images/order-luxury/btn-door.webp"
            alt="كاميرا"
            className="h-9 sm:h-10 w-auto object-contain drop-shadow-md group-hover:scale-105 transition"
          />
        </button>
        <button
          type="button"
          disabled={pending || deleting}
          className="rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#06281D] to-[#0A3D2E] px-3 py-1.5 text-xs font-black text-[#F5D77F] hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
          onClick={() => {
            galleryFileRef.current?.click();
          }}
          title="رفع من المعرض"
        >
          <span>🖼️</span>
          <span>{pending ? "جارٍ الرفع..." : "معرض"}</span>
        </button>
      </div>
      {pending ? (
        <p className="text-xs font-bold text-[#F5D77F] bg-[#0A3D2E]/80 p-1.5 rounded-lg border border-[#C9A86A]/40 text-center animate-pulse">جارٍ رفع صورة الباب…</p>
      ) : state.error ? (
        <p className="text-xs font-black text-rose-400 bg-rose-950/60 p-1.5 rounded-lg border border-rose-500/40 text-center">{state.error}</p>
      ) : state.ok ? (
        <p className="text-xs font-black text-emerald-400 bg-emerald-950/60 p-1.5 rounded-lg border border-emerald-500/40 text-center">تم تحديث صورة الباب بنجاح</p>
      ) : null}
    </div>
  );
}
