"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  uploadOrderImageFromView,
  uploadShopDoorPhotoFromView,
  deleteOrderImageAction,
  deleteShopDoorPhotoAction,
  revertShopDoorPhotoToOriginal,
  type CustomerDoorPhotoState,
} from "./customer-door-photo-actions";

import {
  compressImageForMandoubUpload,
  assignFileToInput,
} from "@/lib/client-image-compress";

const initial: CustomerDoorPhotoState = {};

export function AdminOrderPhotoQuick({
  orderId,
  kind,
  hasImage,
}: {
  orderId: string;
  kind: "shop" | "order";
  hasImage?: boolean;
}) {
  const router = useRouter();
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const action =
    kind === "shop"
      ? uploadShopDoorPhotoFromView.bind(null, orderId)
      : uploadOrderImageFromView.bind(null, orderId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [deleting, setDeleting] = useState(false);
  const [reverting, setReverting] = useState(false);

  const inputName = kind === "shop" ? "shopDoorPhoto" : "orderPhoto";
  const okText = kind === "shop" ? "تم تحديث صورة المحل" : "تم تحديث صورة الطلب";

  async function handleDelete() {
    const label = kind === "shop" ? "صورة المحل" : "صورة الطلب";
    if (!confirm(`هل أنت متأكد من مسح ${label}؟`)) return;
    setDeleting(true);
    try {
      if (kind === "shop") {
        await deleteShopDoorPhotoAction(orderId);
      } else {
        await deleteOrderImageAction(orderId);
      }
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleRevert() {
    if (!confirm("هل أنت متأكد من الرجوع إلى الصورة الأصلية؟")) return;
    setReverting(true);
    try {
      await revertShopDoorPhotoToOriginal(orderId);
      router.refresh();
    } finally {
      setReverting(false);
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
    fd.set(inputName, photoToUpload);
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
          name={`${inputName}Camera`}
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
          name={`${inputName}Gallery`}
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

        {kind === "shop" && hasImage && (
          <button
            type="button"
            disabled={pending || deleting || reverting}
            onClick={() => void handleRevert()}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-60 cursor-pointer active:scale-95"
          >
            {reverting ? "جارٍ الرجوع..." : "الرجوع للأصل"}
          </button>
        )}
      </div>
      {state.error ? <p className="text-xs font-medium text-rose-600">{state.error}</p> : null}
      {state.ok ? <p className="text-xs font-medium text-emerald-700">{okText}</p> : null}
    </div>
  );
}
