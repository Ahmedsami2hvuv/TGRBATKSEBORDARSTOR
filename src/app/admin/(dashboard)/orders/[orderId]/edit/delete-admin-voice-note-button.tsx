"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ad } from "@/lib/admin-ui";
import { deleteAdminVoiceNote } from "./voice-note-actions";

export function DeleteAdminVoiceNoteButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={ad.dangerLink}
      onClick={() => {
        if (!window.confirm("حذف الملاحظة الصوتية من الإدارة لهذا الطلب؟")) return;
        start(async () => {
          const r = await deleteAdminVoiceNote(orderId);
          if (r.error) {
            window.alert(r.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? "جارٍ الحذف…" : "حذف تسجيل الإدارة"}
    </button>
  );
}
