"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ad } from "@/lib/admin-ui";
import { deleteOrderVoiceNote } from "./voice-note-actions";
import { customConfirm, customAlert } from "@/components/global-confirm-dialog";

export function DeleteVoiceNoteButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const handleClick = async () => {
    const confirmed = await customConfirm({
      title: "تأكيد حذف التسجيل الصوتي",
      message: "هل أنت متأكد من حذف الملاحظة الصوتية لهذا الطلب؟",
      confirmText: "حذف التسجيل",
      cancelText: "إلغاء الأمر",
      type: "danger",
    });

    if (!confirmed) return;

    start(async () => {
      const r = await deleteOrderVoiceNote(orderId);
      if (r.error) {
        await customAlert(r.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      disabled={pending}
      className={`${ad.dangerLink} cursor-pointer`}
      onClick={handleClick}
    >
      {pending ? "جارٍ الحذف…" : "حذف التسجيل الصوتي"}
    </button>
  );
}
