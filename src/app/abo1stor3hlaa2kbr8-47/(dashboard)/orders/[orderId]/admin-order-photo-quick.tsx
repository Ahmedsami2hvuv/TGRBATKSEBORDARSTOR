"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import {
  uploadOrderImageFromView,
  uploadShopDoorPhotoFromView,
  deleteOrderImageAction,
  deleteShopDoorPhotoAction,
  revertShopDoorPhotoToOriginal,
  type CustomerDoorPhotoState,
} from "./customer-door-photo-actions";

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
  const fileRef = useRef<HTMLInputElement>(null);
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
    } finally {
      setDeleting(false);
    }
  }

  async function handleRevert() {
    if (!confirm("هل أنت متأكد من الرجوع إلى الصورة الأصلية؟")) return;
    setReverting(true);
    try {
      await revertShopDoorPhotoToOriginal(orderId);
    } finally {
      setReverting(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <form action={formAction} method="post" encType="multipart/form-data" className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          name={inputName}
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) e.currentTarget.form?.requestSubmit();
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
        {kind === "shop" && hasImage && (
          <button
            type="button"
            disabled={pending || deleting || reverting}
            onClick={handleRevert}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
          >
            {reverting ? "جارٍ الرجوع..." : "الرجوع للأصل"}
          </button>
        )}
      </form>
      {state.error ? <p className="text-xs font-medium text-rose-600">{state.error}</p> : null}
      {state.ok ? <p className="text-xs font-medium text-emerald-700">{okText}</p> : null}
    </div>
  );
}
