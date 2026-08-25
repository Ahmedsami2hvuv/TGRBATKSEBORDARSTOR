"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ad } from "@/lib/admin-ui";
import { deleteAdminVoiceNote } from "./voice-note-actions";
import { customConfirm, customAlert } from "@/components/global-confirm-dialog";

export function DeleteAdminVoiceNoteButton({
  orderId,
  compact = false,
}: {
  orderId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const handleClick = async () => {
    const confirmed = await customConfirm({
      title: "تأكيد حذف التسجيل",
      message: "هل أنت متأكد من حذف الملاحظة الصوتية الخاصة بالإدارة لهذا الطلب؟",
      confirmText: "حذف التسجيل",
      cancelText: "إلغاء الأمر",
      type: "danger",
    });

    if (!confirmed) return;

    start(async () => {
      const r = await deleteAdminVoiceNote(orderId);
      if (r.error) {
        await customAlert(r.error);
        return;
      }
      router.refresh();
    });
  };

  if (compact) {
    return (
      <button
        type="button"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-xl bg-rose-100 border border-rose-300 px-2.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-200 active:scale-95 transition-all min-h-[40px]"
        onClick={handleClick}
        title="حذف البصمة الحالية"
      >
        {pending ? "…" : "🗑️"}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      className={`${ad.dangerLink} cursor-pointer`}
      onClick={handleClick}
    >
      {pending ? "جارٍ الحذف…" : "حذف تسجيل الإدارة"}
    </button>
  );
}
