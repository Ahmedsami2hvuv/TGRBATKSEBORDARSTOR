"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ad } from "@/lib/admin-ui";
import { deleteAdminVoiceNote } from "./voice-note-actions";
import { customConfirm, customAlert } from "@/components/global-confirm-dialog";

export function DeleteAdminVoiceNoteButton({ orderId }: { orderId: string }) {
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
