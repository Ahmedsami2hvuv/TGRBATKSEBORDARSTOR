"use client";

import { useTransition } from "react";
import { compressR2ImageAction, deleteR2ImageAction } from "./actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { toast } from "sonner";

export function ImageActionButtons({
  imageKey,
  icons,
}: {
  imageKey: string;
  icons: GlobalIconsConfig | null;
}) {
  const [isCompressing, startCompress] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const handleCompress = () => {
    startCompress(async () => {
      const res = await compressR2ImageAction(imageKey);
      if (res.ok) {
        toast.success("تم تقليص حجم الصورة بنجاح بنسبة تتجاوز 95%!");
      } else {
        toast.error(res.error || "فشل تقليص الصورة");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("هل أنت متأكد من حذف هذه الصورة تماماً من R2؟\nلا يمكن استعادتها بعد الحذف.")) return;

    startDelete(async () => {
      const res = await deleteR2ImageAction(imageKey);
      if (res.ok) {
        toast.success("تم حذف الصورة من R2 بنجاح!");
      } else {
        toast.error(res.error || "فشل حذف الصورة");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 justify-center items-center">
      <button
        onClick={handleCompress}
        disabled={isCompressing || isDeleting}
        className="bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 w-28 shadow-sm cursor-pointer select-none"
      >
        {isCompressing ? (
          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
        ) : (
          <span>🔧 تقليص الحجم</span>
        )}
      </button>

      <button
        onClick={handleDelete}
        disabled={isCompressing || isDeleting}
        className="bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-50 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 w-28 shadow-sm cursor-pointer select-none"
      >
        {isDeleting ? (
          <span className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></span>
        ) : (
          <span className="flex items-center gap-1">
            <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-3.5 h-3.5" />
            <span>حذف</span>
          </span>
        )}
      </button>
    </div>
  );
}
