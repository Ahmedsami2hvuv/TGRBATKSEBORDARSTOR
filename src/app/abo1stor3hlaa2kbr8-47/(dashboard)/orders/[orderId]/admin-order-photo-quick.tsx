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
          className="rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#0F4D3A] to-[#164E3D] px-3 py-1.5 text-xs font-black text-[#F5D77F] hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
          onClick={() => {
            cameraFileRef.current?.click();
          }}
        >
          <span>📷</span>
          <span>{pending ? "جارٍ الرفع..." : "كاميرا"}</span>
        </button>
        <button
          type="button"
          disabled={pending || deleting}
          className="rounded-xl border border-[#C9A86A]/70 bg-gradient-to-r from-[#06281D] to-[#0A3D2E] px-3 py-1.5 text-xs font-black text-[#FFF8F0] hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
          onClick={() => {
            galleryFileRef.current?.click();
          }}
        >
          <span>🖼️</span>
          <span>{pending ? "جارٍ الرفع..." : "معرض"}</span>
        </button>

        {kind === "shop" && hasImage && (
          <button
            type="button"
            disabled={pending || deleting || reverting}
            onClick={() => void handleRevert()}
            className="rounded-xl border border-[#C9A86A] bg-gradient-to-r from-[#B45309] to-[#78350F] px-3 py-1.5 text-xs font-black text-[#F5D77F] hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
          >
            <span>🔄</span>
            <span>{reverting ? "جارٍ الرجوع..." : "الرجوع للأصل"}</span>
          </button>
        )}
      </div>
      {state.error ? <p className="text-xs font-black text-rose-400 bg-rose-950/60 p-1.5 rounded-lg border border-rose-500/40 text-center">{state.error}</p> : null}
      {state.ok ? <p className="text-xs font-black text-emerald-400 bg-emerald-950/60 p-1.5 rounded-lg border border-emerald-500/40 text-center">{okText}</p> : null}
    </div>
  );
}
